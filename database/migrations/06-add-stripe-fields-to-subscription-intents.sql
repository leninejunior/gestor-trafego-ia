-- =============================================
-- Migration: Add Stripe fields to subscription_intents
-- Date: 2025-12-05
-- Description: Adds Stripe customer, session, and subscription ID fields
-- =============================================

-- Add Stripe fields to subscription_intents table
ALTER TABLE subscription_intents 
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_session_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- Create indexes for Stripe fields
CREATE INDEX IF NOT EXISTS idx_subscription_intents_stripe_customer_id 
ON subscription_intents(stripe_customer_id) 
WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscription_intents_stripe_session_id 
ON subscription_intents(stripe_session_id) 
WHERE stripe_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscription_intents_stripe_subscription_id 
ON subscription_intents(stripe_subscription_id) 
WHERE stripe_subscription_id IS NOT NULL;

-- Add comment to document the fields
COMMENT ON COLUMN subscription_intents.stripe_customer_id IS 'Stripe Customer ID (cus_xxx)';
COMMENT ON COLUMN subscription_intents.stripe_session_id IS 'Stripe Checkout Session ID (cs_xxx)';
COMMENT ON COLUMN subscription_intents.stripe_subscription_id IS 'Stripe Subscription ID (sub_xxx)';

-- Verify the migration
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'subscription_intents' 
AND column_name IN ('stripe_customer_id', 'stripe_session_id', 'stripe_subscription_id')
ORDER BY column_name;
