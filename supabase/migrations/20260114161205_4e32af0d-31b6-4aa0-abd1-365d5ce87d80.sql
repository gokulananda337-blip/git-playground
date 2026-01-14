-- Fix the generate_customer_portal_link function to use pgcrypto properly
-- First ensure pgcrypto extension is enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Drop and recreate the function with proper syntax
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
  -- Generate a secure random token using pgcrypto
  v_token := encode(pgcrypto.gen_random_bytes(32), 'base64');
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