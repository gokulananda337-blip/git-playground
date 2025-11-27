-- Add service_type column to services table
ALTER TABLE public.services 
ADD COLUMN IF NOT EXISTS service_type text DEFAULT 'service' CHECK (service_type IN ('service', 'subscription', 'package'));

-- Add comment
COMMENT ON COLUMN public.services.service_type IS 'Type of service: service (single), subscription (monthly recurring), or package (combination of services)';

-- Add package_services column for package type
ALTER TABLE public.services 
ADD COLUMN IF NOT EXISTS package_services jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.services.package_services IS 'Array of service IDs included in package (only for package type)';