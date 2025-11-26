-- Add lifecycle_stages column to services table
ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS lifecycle_stages jsonb DEFAULT '["check_in", "pre_wash", "foam_wash", "interior", "polishing", "qc", "completed", "delivered"]'::jsonb;

-- Comment explaining the column
COMMENT ON COLUMN public.services.lifecycle_stages IS 'Array of job status stages applicable to this service';