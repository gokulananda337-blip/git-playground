-- Enable pgcrypto extension for gen_random_bytes function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Drop and recreate the function with proper extension
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
  
  -- Return the portal URL
  RETURN '/customer-portal?token=' || v_token;
END;
$$;