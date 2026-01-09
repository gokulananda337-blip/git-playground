-- Drop and recreate the function with proper error handling
DROP FUNCTION IF EXISTS public.generate_customer_portal_link(uuid);

CREATE OR REPLACE FUNCTION public.generate_customer_portal_link(p_customer_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
BEGIN
  -- Generate a secure random token
  v_token := encode(gen_random_bytes(32), 'base64');
  v_token := replace(v_token, '/', '_');
  v_token := replace(v_token, '+', '-');
  v_token := replace(v_token, '=', '');
  
  -- Insert or update customer portal access using SECURITY DEFINER to bypass RLS
  INSERT INTO public.customer_portal_access (customer_id, access_token, is_active)
  VALUES (p_customer_id, v_token, true)
  ON CONFLICT (customer_id) 
  DO UPDATE SET 
    access_token = v_token,
    is_active = true,
    created_at = now();
  
  -- Return the portal URL path
  RETURN '/customer-portal?token=' || v_token;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.generate_customer_portal_link(uuid) TO authenticated;

-- Drop existing insert policy if any and create new one
DROP POLICY IF EXISTS "Authenticated users can insert portal access" ON public.customer_portal_access;
CREATE POLICY "Authenticated users can insert portal access"
ON public.customer_portal_access
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create loyalty_points table for customer loyalty program
CREATE TABLE IF NOT EXISTS public.loyalty_points (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL,
  user_id UUID NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  lifetime_points INTEGER NOT NULL DEFAULT 0,
  tier TEXT DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(customer_id)
);

-- Enable RLS on loyalty_points
ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first
DROP POLICY IF EXISTS "Users can manage their loyalty points" ON public.loyalty_points;

-- RLS policies for loyalty_points
CREATE POLICY "Users can manage their loyalty points"
ON public.loyalty_points
FOR ALL
USING (auth.uid() = user_id);

-- Create loyalty_transactions table for tracking point history
CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL,
  user_id UUID NOT NULL,
  points INTEGER NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('earned', 'redeemed', 'expired', 'bonus')),
  description TEXT,
  reference_id UUID,
  reference_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on loyalty_transactions
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their loyalty transactions" ON public.loyalty_transactions;

-- RLS policies for loyalty_transactions
CREATE POLICY "Users can manage their loyalty transactions"
ON public.loyalty_transactions
FOR ALL
USING (auth.uid() = user_id);

-- Create landing_page_config table for public landing page
CREATE TABLE IF NOT EXISTS public.landing_page_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  slug TEXT UNIQUE,
  business_name TEXT NOT NULL DEFAULT 'My Car Wash',
  tagline TEXT,
  description TEXT,
  logo_url TEXT,
  hero_image_url TEXT,
  primary_color TEXT DEFAULT '#facc15',
  phone TEXT,
  email TEXT,
  address TEXT,
  whatsapp TEXT,
  facebook_url TEXT,
  instagram_url TEXT,
  google_maps_url TEXT,
  working_hours JSONB DEFAULT '{"monday": "9:00 AM - 6:00 PM", "tuesday": "9:00 AM - 6:00 PM", "wednesday": "9:00 AM - 6:00 PM", "thursday": "9:00 AM - 6:00 PM", "friday": "9:00 AM - 6:00 PM", "saturday": "9:00 AM - 6:00 PM", "sunday": "Closed"}'::jsonb,
  features JSONB DEFAULT '[]'::jsonb,
  testimonials JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  enable_online_booking BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on landing_page_config
ALTER TABLE public.landing_page_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their landing page config" ON public.landing_page_config;
DROP POLICY IF EXISTS "Public can view active landing pages" ON public.landing_page_config;

-- RLS policies for landing_page_config
CREATE POLICY "Users can manage their landing page config"
ON public.landing_page_config
FOR ALL
USING (auth.uid() = user_id);

-- Public can view active landing pages
CREATE POLICY "Public can view active landing pages"
ON public.landing_page_config
FOR SELECT
TO anon
USING (is_active = true);

-- Trigger for updated_at on loyalty_points
DROP TRIGGER IF EXISTS update_loyalty_points_updated_at ON public.loyalty_points;
CREATE TRIGGER update_loyalty_points_updated_at
BEFORE UPDATE ON public.loyalty_points
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for updated_at on landing_page_config
DROP TRIGGER IF EXISTS update_landing_page_config_updated_at ON public.landing_page_config;
CREATE TRIGGER update_landing_page_config_updated_at
BEFORE UPDATE ON public.landing_page_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();