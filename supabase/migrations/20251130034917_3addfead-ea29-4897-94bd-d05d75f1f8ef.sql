-- Add customer portal access
-- Create customer_portal_access table for secure customer logins
CREATE TABLE IF NOT EXISTS public.customer_portal_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL UNIQUE,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  CONSTRAINT unique_customer_access UNIQUE (customer_id)
);

-- Enable RLS on customer_portal_access
ALTER TABLE public.customer_portal_access ENABLE ROW LEVEL SECURITY;

-- Policy: Customers can view their own portal access
CREATE POLICY "Customers can view their own portal access"
ON public.customer_portal_access
FOR SELECT
USING (access_token = current_setting('request.jwt.claims', true)::json->>'access_token');

-- Update RLS policies for customers table to allow portal access
CREATE POLICY "Customers can view their own data via portal"
ON public.customers
FOR SELECT
USING (
  id IN (
    SELECT customer_id 
    FROM public.customer_portal_access 
    WHERE access_token = current_setting('request.jwt.claims', true)::json->>'access_token'
  )
);

-- Update RLS for vehicles - customers can view their vehicles via portal
CREATE POLICY "Customers can view their vehicles via portal"
ON public.vehicles
FOR SELECT
USING (
  customer_id IN (
    SELECT customer_id 
    FROM public.customer_portal_access 
    WHERE access_token = current_setting('request.jwt.claims', true)::json->>'access_token'
  )
);

-- Update RLS for job_cards - customers can view their job cards via portal
CREATE POLICY "Customers can view their job cards via portal"
ON public.job_cards
FOR SELECT
USING (
  customer_id IN (
    SELECT customer_id 
    FROM public.customer_portal_access 
    WHERE access_token = current_setting('request.jwt.claims', true)::json->>'access_token'
  )
);

-- Update RLS for invoices - customers can view their invoices via portal
CREATE POLICY "Customers can view their invoices via portal"
ON public.invoices
FOR SELECT
USING (
  customer_id IN (
    SELECT customer_id 
    FROM public.customer_portal_access 
    WHERE access_token = current_setting('request.jwt.claims', true)::json->>'access_token'
  )
);

-- Update RLS for bookings - customers can view their bookings via portal
CREATE POLICY "Customers can view their bookings via portal"
ON public.bookings
FOR SELECT
USING (
  customer_id IN (
    SELECT customer_id 
    FROM public.customer_portal_access 
    WHERE access_token = current_setting('request.jwt.claims', true)::json->>'access_token'
  )
);

-- Function to generate customer portal link
CREATE OR REPLACE FUNCTION public.generate_customer_portal_link(p_customer_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
  v_base_url TEXT;
BEGIN
  -- Generate a secure random token
  v_token := encode(gen_random_bytes(32), 'base64');
  v_token := replace(v_token, '/', '_');
  v_token := replace(v_token, '+', '-');
  v_token := replace(v_token, '=', '');
  
  -- Insert or update customer portal access
  INSERT INTO public.customer_portal_access (customer_id, access_token)
  VALUES (p_customer_id, v_token)
  ON CONFLICT (customer_id) 
  DO UPDATE SET 
    access_token = v_token,
    is_active = true;
  
  -- Return the portal URL (update with your actual domain)
  RETURN '/customer-portal?token=' || v_token;
END;
$$;