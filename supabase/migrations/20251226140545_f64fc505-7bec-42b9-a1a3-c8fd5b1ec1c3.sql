-- Create reviews table
CREATE TABLE public.reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  job_card_id UUID NOT NULL REFERENCES public.job_cards(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID NOT NULL
);

-- Enable RLS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Policies for reviews
CREATE POLICY "Customers can create reviews via portal"
ON public.reviews FOR INSERT
WITH CHECK (
  customer_id IN (
    SELECT customer_portal_access.customer_id
    FROM customer_portal_access
    WHERE customer_portal_access.access_token = (
      (current_setting('request.jwt.claims'::text, true))::json ->> 'access_token'::text
    )
  )
);

CREATE POLICY "Customers can view their reviews via portal"
ON public.reviews FOR SELECT
USING (
  customer_id IN (
    SELECT customer_portal_access.customer_id
    FROM customer_portal_access
    WHERE customer_portal_access.access_token = (
      (current_setting('request.jwt.claims'::text, true))::json ->> 'access_token'::text
    )
  )
);

CREATE POLICY "Users can manage their own reviews"
ON public.reviews FOR ALL
USING (auth.uid() = user_id);

-- Create payment_transactions table for Razorpay
CREATE TABLE public.payment_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  razorpay_signature TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID NOT NULL
);

-- Enable RLS
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- Policies for payment_transactions
CREATE POLICY "Customers can view their payments via portal"
ON public.payment_transactions FOR SELECT
USING (
  customer_id IN (
    SELECT customer_portal_access.customer_id
    FROM customer_portal_access
    WHERE customer_portal_access.access_token = (
      (current_setting('request.jwt.claims'::text, true))::json ->> 'access_token'::text
    )
  )
);

CREATE POLICY "Users can manage their own payments"
ON public.payment_transactions FOR ALL
USING (auth.uid() = user_id);

-- Enable realtime for reviews
ALTER PUBLICATION supabase_realtime ADD TABLE reviews;
ALTER PUBLICATION supabase_realtime ADD TABLE payment_transactions;