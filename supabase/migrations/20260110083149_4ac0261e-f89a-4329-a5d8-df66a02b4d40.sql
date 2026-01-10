-- Create door_step_services table
CREATE TABLE public.door_step_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id),
  assigned_staff_id UUID REFERENCES public.profiles(id),
  pickup_address TEXT NOT NULL,
  delivery_address TEXT,
  pickup_time TIMESTAMP WITH TIME ZONE,
  estimated_pickup_time TIMESTAMP WITH TIME ZONE,
  delivery_time TIMESTAMP WITH TIME ZONE,
  estimated_delivery_time TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'picking_up', 'in_service', 'delivering', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.door_step_services ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own door step services"
ON public.door_step_services FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own door step services"
ON public.door_step_services FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own door step services"
ON public.door_step_services FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own door step services"
ON public.door_step_services FOR DELETE
USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE TRIGGER update_door_step_services_updated_at
BEFORE UPDATE ON public.door_step_services
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add booking configuration columns to landing_page_config
ALTER TABLE public.landing_page_config ADD COLUMN IF NOT EXISTS booking_mode TEXT DEFAULT 'slot' CHECK (booking_mode IN ('slot', 'date_only'));
ALTER TABLE public.landing_page_config ADD COLUMN IF NOT EXISTS daily_booking_limit INTEGER DEFAULT 20;
ALTER TABLE public.landing_page_config ADD COLUMN IF NOT EXISTS slot_duration_minutes INTEGER DEFAULT 30;