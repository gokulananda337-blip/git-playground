-- Grant INSERT permission for the function to work properly
-- The function is SECURITY DEFINER so it should bypass RLS, but let's ensure the table allows inserts from authenticated users/owners

-- Create a policy to allow inserts/updates from the function (which runs as the definer)
-- Since the function is SECURITY DEFINER, we need to ensure it can bypass RLS
-- First drop existing function and recreate with proper settings
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
  v_token := encode(gen_random_bytes(32), 'base64');
  v_token := replace(v_token, '/', '_');
  v_token := replace(v_token, '+', '-');
  v_token := replace(v_token, '=', '');
  
  -- Insert or update customer portal access (SECURITY DEFINER bypasses RLS)
  INSERT INTO public.customer_portal_access (customer_id, access_token, is_active)
  VALUES (p_customer_id, v_token, true)
  ON CONFLICT (customer_id) 
  DO UPDATE SET 
    access_token = v_token,
    is_active = true;
  
  -- Return the portal URL
  RETURN '/customer-portal?token=' || v_token;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.generate_customer_portal_link(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_customer_portal_link(uuid) TO anon;