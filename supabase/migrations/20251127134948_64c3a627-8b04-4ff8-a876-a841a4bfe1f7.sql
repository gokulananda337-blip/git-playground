-- Add GST and other company info fields to branches table
ALTER TABLE branches ADD COLUMN IF NOT EXISTS gst_number text;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS company_logo_url text;