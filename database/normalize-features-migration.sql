-- Migration to normalize features column to JSONB array
-- Fixes existing string/object features data to ensure consistent array format

-- First, let's check current data types and fix them
DO $$
DECLARE
    plan_record RECORD;
    normalized_features JSONB;
BEGIN
    -- Loop through all plans and normalize features
    FOR plan_record IN 
        SELECT id, features 
        FROM subscription_plans 
        WHERE features IS NOT NULL
    LOOP
        -- Initialize as empty array
        normalized_features := '[]'::jsonb;
        
        -- Handle different data types
        IF jsonb_typeof(plan_record.features) = 'array' THEN
            -- Already an array, keep as is
            normalized_features := plan_record.features;
        ELSIF jsonb_typeof(plan_record.features) = 'object' THEN
            -- Convert object to array of key-value strings
            SELECT jsonb_agg(
                CASE 
                    WHEN value = 'true'::jsonb THEN key
                    WHEN value = 'false'::jsonb THEN NULL
                    ELSE key || ': ' || (value #>> '{}')
                END
            ) INTO normalized_features
            FROM jsonb_each(plan_record.features)
            WHERE CASE 
                WHEN value = 'true'::jsonb THEN true
                WHEN value = 'false'::jsonb THEN false
                ELSE true
            END;
            
            -- Handle null result from aggregation
            IF normalized_features IS NULL THEN
                normalized_features := '[]'::jsonb;
            END IF;
        ELSIF jsonb_typeof(plan_record.features) = 'string' THEN
            -- Convert string to single-element array
            normalized_features := jsonb_build_array(plan_record.features #>> '{}');
        END IF;
        
        -- Update the record with normalized features
        UPDATE subscription_plans 
        SET features = normalized_features
        WHERE id = plan_record.id;
        
        RAISE NOTICE 'Normalized features for plan ID %: %', plan_record.id, normalized_features;
    END LOOP;
END $$;

-- Add constraint to ensure features is always a JSONB array
ALTER TABLE subscription_plans 
ADD CONSTRAINT features_must_be_array 
CHECK (jsonb_typeof(features) = 'array' OR features IS NULL);

-- Add comment for documentation
COMMENT ON COLUMN subscription_plans.features IS 
'JSONB array of feature strings. Must always be an array type, never object or string.';

-- Create index for better performance on features queries
CREATE INDEX IF NOT EXISTS idx_subscription_plans_features_gin 
ON subscription_plans USING gin(features);

COMMIT;