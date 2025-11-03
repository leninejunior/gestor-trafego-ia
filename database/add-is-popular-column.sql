-- Add is_popular column to subscription_plans table
ALTER TABLE subscription_plans 
ADD COLUMN IF NOT EXISTS is_popular BOOLEAN DEFAULT false;

-- Update some existing plans to be popular for testing
UPDATE subscription_plans 
SET is_popular = true 
WHERE name IN ('Professional', 'Pro') 
AND is_popular IS NOT NULL;

-- Add comment to the column
COMMENT ON COLUMN subscription_plans.is_popular IS 'Indicates if this plan should be highlighted as popular';