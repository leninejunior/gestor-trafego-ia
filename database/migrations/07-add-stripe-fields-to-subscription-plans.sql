-- =============================================
-- Migration: Add Stripe fields to subscription_plans
-- Date: 2025-12-05
-- Description: Adds Stripe product and price IDs for automatic sync
-- =============================================

-- Add Stripe fields to subscription_plans table
ALTER TABLE subscription_plans 
ADD COLUMN IF NOT EXISTS stripe_product_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_price_id_monthly TEXT,
ADD COLUMN IF NOT EXISTS stripe_price_id_annual TEXT;

-- Create indexes for Stripe fields
CREATE INDEX IF NOT EXISTS idx_subscription_plans_stripe_product_id 
ON subscription_plans(stripe_product_id) 
WHERE stripe_product_id IS NOT NULL;

-- Add comments to document the fields
COMMENT ON COLUMN subscription_plans.stripe_product_id IS 'Stripe Product ID (prod_xxx)';
COMMENT ON COLUMN subscription_plans.stripe_price_id_monthly IS 'Stripe Price ID for monthly billing (price_xxx)';
COMMENT ON COLUMN subscription_plans.stripe_price_id_annual IS 'Stripe Price ID for annual billing (price_xxx)';

-- Update existing plans with Stripe IDs (Gestor de Tráfego account)
-- Basic Plan - $29/month, $290/year
UPDATE subscription_plans 
SET 
  stripe_product_id = 'prod_TYDh2m12mOwZUt',
  stripe_price_id_monthly = 'price_1Sb7G6KABoiEfF8TsDoZn2oT',
  stripe_price_id_annual = 'price_1Sb7GBKABoiEfF8TkGCL54R6'
WHERE name = 'Basic';

-- Pro Plan - $79/month, $790/year
UPDATE subscription_plans 
SET 
  stripe_product_id = 'prod_TYDhPcLUZKOszA',
  stripe_price_id_monthly = 'price_1Sb7GRKABoiEfF8TG4SIYQDz',
  stripe_price_id_annual = 'price_1Sb7HWKABoiEfF8TQRr8hjf7'
WHERE name = 'Pro';

-- Enterprise Plan - $199/month, $1990/year
UPDATE subscription_plans 
SET 
  stripe_product_id = 'prod_TYDhoLQ2nln2ZW',
  stripe_price_id_monthly = 'price_1Sb7HbKABoiEfF8TQdtDpxs3',
  stripe_price_id_annual = 'price_1Sb7HeKABoiEfF8TUSnKBsGA'
WHERE name = 'Enterprise';

-- Verify the migration
SELECT 
  name, 
  monthly_price, 
  annual_price,
  stripe_product_id,
  stripe_price_id_monthly,
  stripe_price_id_annual
FROM subscription_plans
ORDER BY monthly_price;
