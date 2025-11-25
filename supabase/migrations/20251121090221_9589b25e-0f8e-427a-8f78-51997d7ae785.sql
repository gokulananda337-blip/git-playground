-- Add expected_end_time to bookings table
ALTER TABLE public.bookings 
ADD COLUMN expected_end_time time without time zone;

COMMENT ON COLUMN public.bookings.expected_end_time IS 'Expected time when the service will be completed';