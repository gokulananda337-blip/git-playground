-- Drop existing function if exists
DROP FUNCTION IF EXISTS public.generate_customer_portal_link(uuid);

-- Create the function with proper random string generation
CREATE OR REPLACE FUNCTION public.generate_customer_portal_link(p_customer_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
  v_existing_token text;
BEGIN
  -- Check if customer already has an active portal access
  SELECT access_token INTO v_existing_token
  FROM public.customer_portal_access
  WHERE customer_id = p_customer_id AND is_active = true;
  
  IF v_existing_token IS NOT NULL THEN
    RETURN '/portal/' || v_existing_token;
  END IF;
  
  -- Generate a new token using encode and random bytes equivalent
  v_token := encode(
    sha256(
      (p_customer_id::text || clock_timestamp()::text || random()::text)::bytea
    ),
    'hex'
  );
  
  -- Take first 32 characters
  v_token := substring(v_token from 1 for 32);
  
  -- Insert or update the portal access
  INSERT INTO public.customer_portal_access (customer_id, access_token, is_active)
  VALUES (p_customer_id, v_token, true)
  ON CONFLICT (customer_id) 
  DO UPDATE SET access_token = v_token, is_active = true, last_login = NULL;
  
  RETURN '/portal/' || v_token;
END;
$$;