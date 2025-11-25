-- Add inventory management tables
CREATE TABLE public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  unit TEXT NOT NULL, -- e.g., 'liters', 'pieces', 'kg'
  current_stock NUMERIC DEFAULT 0,
  min_stock NUMERIC DEFAULT 0,
  cost_per_unit NUMERIC,
  supplier TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL,
  transaction_type TEXT NOT NULL, -- 'in' or 'out' or 'adjustment'
  reference_type TEXT, -- 'job_card', 'purchase', 'manual'
  reference_id UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add WhatsApp Business API configuration to branches
ALTER TABLE public.branches 
ADD COLUMN whatsapp_phone_number_id TEXT,
ADD COLUMN whatsapp_access_token TEXT,
ADD COLUMN whatsapp_business_account_id TEXT,
ADD COLUMN whatsapp_verified BOOLEAN DEFAULT false;

-- Add materials tracking to job cards
ALTER TABLE public.job_cards
ADD COLUMN materials_used JSONB DEFAULT '[]'::jsonb;

-- Add materials requirement to services
ALTER TABLE public.services
ADD COLUMN materials_required JSONB DEFAULT '[]'::jsonb;

-- Enable RLS on new tables
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

-- RLS Policies for inventory_items
CREATE POLICY "Users can manage their own inventory items"
  ON public.inventory_items
  FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Users can view their own inventory items"
  ON public.inventory_items
  FOR SELECT
  USING (user_id = auth.uid());

-- RLS Policies for inventory_transactions
CREATE POLICY "Users can manage their own inventory transactions"
  ON public.inventory_transactions
  FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Users can view their own inventory transactions"
  ON public.inventory_transactions
  FOR SELECT
  USING (user_id = auth.uid());

-- RLS Policies for vendors
CREATE POLICY "Users can manage their own vendors"
  ON public.vendors
  FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Users can view their own vendors"
  ON public.vendors
  FOR SELECT
  USING (user_id = auth.uid());

-- Triggers for updated_at
CREATE TRIGGER update_inventory_items_updated_at
  BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vendors_updated_at
  BEFORE UPDATE ON public.vendors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to auto-deduct inventory on job completion
CREATE OR REPLACE FUNCTION public.auto_deduct_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When job status changes to 'completed', deduct materials
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Process materials_used array
    IF NEW.materials_used IS NOT NULL AND jsonb_array_length(NEW.materials_used) > 0 THEN
      INSERT INTO public.inventory_transactions (
        user_id,
        branch_id,
        item_id,
        quantity,
        transaction_type,
        reference_type,
        reference_id,
        notes
      )
      SELECT 
        NEW.user_id,
        (SELECT branch_id FROM public.profiles WHERE id = NEW.assigned_staff_id LIMIT 1),
        (material->>'item_id')::uuid,
        -(material->>'quantity')::numeric,
        'out',
        'job_card',
        NEW.id,
        'Auto-deducted from job card'
      FROM jsonb_array_elements(NEW.materials_used) AS material;

      -- Update inventory stock
      UPDATE public.inventory_items
      SET current_stock = current_stock - (material->>'quantity')::numeric
      FROM jsonb_array_elements(NEW.materials_used) AS material
      WHERE inventory_items.id = (material->>'item_id')::uuid;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_auto_deduct_inventory
  AFTER UPDATE ON public.job_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_deduct_inventory();