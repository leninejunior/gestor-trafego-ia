-- Migration script to update existing subscription schema to match the design
-- This script safely migrates existing tables to the new schema structure

-- =============================================
-- MIGRATE SUBSCRIPTION_PLANS TABLE
-- =============================================

-- Check if we need to rename columns in subscription_plans
DO $$
BEGIN
    -- Rename price_monthly to monthly_price if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'subscription_plans' AND column_name = 'price_monthly') THEN
        ALTER TABLE subscription_plans RENAME COLUMN price_monthly TO monthly_price;
    END IF;
    
    -- Rename price_yearly to annual_price if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'subscription_plans' AND column_name = 'price_yearly') THEN
        ALTER TABLE subscription_plans RENAME COLUMN price_yearly TO annual_price;
    END IF;
    
    -- Add missing columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'subscription_plans' AND column_name = 'max_campaigns') THEN
        ALTER TABLE subscription_plans ADD COLUMN max_campaigns INTEGER NOT NULL DEFAULT 0;
    END IF;
END $$;

-- Update subscription_plans table structure to match design
ALTER TABLE subscription_plans 
    ALTER COLUMN monthly_price TYPE DECIMAL(10,2),
    ALTER COLUMN annual_price TYPE DECIMAL(10,2);

-- Ensure features column has proper default
ALTER TABLE subscription_plans 
    ALTER COLUMN features SET DEFAULT '{}';

-- Add indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON subscription_plans(is_active);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_features ON subscription_plans USING GIN(features);

-- =============================================
-- UPDATE SUBSCRIPTIONS TABLE
-- =============================================

-- Add missing columns to subscriptions table
DO $$
BEGIN
    -- Add organization_id if it doesn't exist (rename from org_id if needed)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'subscriptions' AND column_name = 'organization_id') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'subscriptions' AND column_name = 'org_id') THEN
            ALTER TABLE subscriptions RENAME COLUMN org_id TO organization_id;
        ELSE
            ALTER TABLE subscriptions ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
        END IF;
    END IF;
    
    -- Add missing columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'subscriptions' AND column_name = 'status') THEN
        ALTER TABLE subscriptions ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active' 
            CHECK (status IN ('active', 'past_due', 'canceled', 'trialing'));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'subscriptions' AND column_name = 'billing_cycle') THEN
        ALTER TABLE subscriptions ADD COLUMN billing_cycle VARCHAR(10) NOT NULL DEFAULT 'monthly' 
            CHECK (billing_cycle IN ('monthly', 'annual'));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'subscriptions' AND column_name = 'current_period_start') THEN
        ALTER TABLE subscriptions ADD COLUMN current_period_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'subscriptions' AND column_name = 'current_period_end') THEN
        ALTER TABLE subscriptions ADD COLUMN current_period_end TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() + INTERVAL '1 month';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'subscriptions' AND column_name = 'trial_end') THEN
        ALTER TABLE subscriptions ADD COLUMN trial_end TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'subscriptions' AND column_name = 'payment_method_id') THEN
        ALTER TABLE subscriptions ADD COLUMN payment_method_id VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'subscriptions' AND column_name = 'stripe_subscription_id') THEN
        ALTER TABLE subscriptions ADD COLUMN stripe_subscription_id VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'subscriptions' AND column_name = 'stripe_customer_id') THEN
        ALTER TABLE subscriptions ADD COLUMN stripe_customer_id VARCHAR(255);
    END IF;
END $$;

-- Add indexes for subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_org_id ON subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id ON subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON subscriptions(current_period_end);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);

-- Add unique constraint for one active subscription per organization
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'unique_active_subscription_per_org') THEN
        ALTER TABLE subscriptions 
        ADD CONSTRAINT unique_active_subscription_per_org 
        UNIQUE (organization_id) DEFERRABLE INITIALLY DEFERRED;
    END IF;
END $$;

-- =============================================
-- CREATE SUBSCRIPTION_INVOICES TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS subscription_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
    line_items JSONB NOT NULL DEFAULT '[]',
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE,
    payment_intent_id VARCHAR(255),
    stripe_invoice_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for subscription_invoices
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_subscription_id ON subscription_invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_status ON subscription_invoices(status);
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_due_date ON subscription_invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_stripe_invoice ON subscription_invoices(stripe_invoice_id);
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_payment_intent ON subscription_invoices(payment_intent_id);

-- =============================================
-- CREATE FEATURE_USAGE TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS feature_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    feature_key VARCHAR(100) NOT NULL,
    usage_count INTEGER NOT NULL DEFAULT 0,
    limit_count INTEGER NOT NULL DEFAULT 0,
    usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique tracking per org/feature/date
    CONSTRAINT unique_feature_usage_per_day UNIQUE (organization_id, feature_key, usage_date)
);

-- Add indexes for feature_usage
CREATE INDEX IF NOT EXISTS idx_feature_usage_org_id ON feature_usage(organization_id);
CREATE INDEX IF NOT EXISTS idx_feature_usage_feature_key ON feature_usage(feature_key);
CREATE INDEX IF NOT EXISTS idx_feature_usage_date ON feature_usage(usage_date);
CREATE INDEX IF NOT EXISTS idx_feature_usage_org_feature ON feature_usage(organization_id, feature_key);

-- =============================================
-- ENABLE ROW LEVEL SECURITY
-- =============================================

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_usage ENABLE ROW LEVEL SECURITY;

-- =============================================
-- CREATE RLS POLICIES
-- =============================================

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "subscription_plans_public_read" ON subscription_plans;
DROP POLICY IF EXISTS "subscription_plans_admin_all" ON subscription_plans;
DROP POLICY IF EXISTS "subscriptions_organization_access" ON subscriptions;
DROP POLICY IF EXISTS "subscription_invoices_organization_access" ON subscription_invoices;
DROP POLICY IF EXISTS "feature_usage_organization_access" ON feature_usage;

-- Subscription plans policies
CREATE POLICY "subscription_plans_public_read" ON subscription_plans
    FOR SELECT USING (is_active = true);

CREATE POLICY "subscription_plans_admin_all" ON subscription_plans
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM memberships m
            JOIN auth.users u ON u.id = m.user_id
            WHERE u.id = auth.uid()
            AND m.role = 'super_admin'
        )
    );

-- Subscriptions policies
CREATE POLICY "subscriptions_organization_access" ON subscriptions
    FOR ALL USING (
        organization_id IN (
            SELECT m.organization_id 
            FROM memberships m 
            WHERE m.user_id = auth.uid()
        )
    );

-- Subscription invoices policies
CREATE POLICY "subscription_invoices_organization_access" ON subscription_invoices
    FOR ALL USING (
        subscription_id IN (
            SELECT s.id 
            FROM subscriptions s
            JOIN memberships m ON m.organization_id = s.organization_id
            WHERE m.user_id = auth.uid()
        )
    );

-- Feature usage policies
CREATE POLICY "feature_usage_organization_access" ON feature_usage
    FOR ALL USING (
        organization_id IN (
            SELECT m.organization_id 
            FROM memberships m 
            WHERE m.user_id = auth.uid()
        )
    );

-- =============================================
-- CREATE FUNCTIONS AND TRIGGERS
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
DROP TRIGGER IF EXISTS update_subscription_plans_updated_at ON subscription_plans;
CREATE TRIGGER update_subscription_plans_updated_at 
    BEFORE UPDATE ON subscription_plans 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at 
    BEFORE UPDATE ON subscriptions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscription_invoices_updated_at ON subscription_invoices;
CREATE TRIGGER update_subscription_invoices_updated_at 
    BEFORE UPDATE ON subscription_invoices 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_feature_usage_updated_at ON feature_usage;
CREATE TRIGGER update_feature_usage_updated_at 
    BEFORE UPDATE ON feature_usage 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate invoice numbers
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
        NEW.invoice_number := 'INV-' || TO_CHAR(NOW(), 'YYYY') || '-' || 
                             LPAD(EXTRACT(DOY FROM NOW())::TEXT, 3, '0') || '-' ||
                             LPAD(nextval('invoice_number_seq')::TEXT, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create sequence for invoice numbers
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

-- Add invoice number generation trigger
DROP TRIGGER IF EXISTS generate_subscription_invoice_number ON subscription_invoices;
CREATE TRIGGER generate_subscription_invoice_number 
    BEFORE INSERT ON subscription_invoices 
    FOR EACH ROW EXECUTE FUNCTION generate_invoice_number();

-- Function to automatically set subscription period end based on billing cycle
CREATE OR REPLACE FUNCTION set_subscription_period_end()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.current_period_end IS NULL OR NEW.current_period_end = NEW.current_period_start THEN
        IF NEW.billing_cycle = 'monthly' THEN
            NEW.current_period_end := NEW.current_period_start + INTERVAL '1 month';
        ELSIF NEW.billing_cycle = 'annual' THEN
            NEW.current_period_end := NEW.current_period_start + INTERVAL '1 year';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add subscription period trigger
DROP TRIGGER IF EXISTS set_subscription_period_end_trigger ON subscriptions;
CREATE TRIGGER set_subscription_period_end_trigger 
    BEFORE INSERT OR UPDATE ON subscriptions 
    FOR EACH ROW EXECUTE FUNCTION set_subscription_period_end();

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Function to check if organization has feature access
CREATE OR REPLACE FUNCTION has_feature_access(org_id UUID, feature_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    subscription_features JSONB;
    feature_value BOOLEAN;
BEGIN
    -- Get the current subscription's features
    SELECT sp.features INTO subscription_features
    FROM subscriptions s
    JOIN subscription_plans sp ON sp.id = s.plan_id
    WHERE s.organization_id = org_id 
    AND s.status = 'active'
    AND s.current_period_end > NOW();
    
    -- If no active subscription, return false
    IF subscription_features IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Check if feature exists and is enabled
    feature_value := (subscription_features ->> feature_name)::BOOLEAN;
    
    RETURN COALESCE(feature_value, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check usage limits
CREATE OR REPLACE FUNCTION check_usage_limit(org_id UUID, feature_name TEXT)
RETURNS JSONB AS $$
DECLARE
    current_usage INTEGER;
    usage_limit INTEGER;
    subscription_limit INTEGER;
    result JSONB;
BEGIN
    -- Get current usage for today
    SELECT COALESCE(usage_count, 0) INTO current_usage
    FROM feature_usage
    WHERE organization_id = org_id 
    AND feature_key = feature_name 
    AND usage_date = CURRENT_DATE;
    
    -- Get limit from subscription plan
    SELECT 
        CASE 
            WHEN feature_name = 'clients' THEN sp.max_clients
            WHEN feature_name = 'campaigns' THEN sp.max_campaigns
            ELSE -1
        END INTO subscription_limit
    FROM subscriptions s
    JOIN subscription_plans sp ON sp.id = s.plan_id
    WHERE s.organization_id = org_id 
    AND s.status = 'active'
    AND s.current_period_end > NOW();
    
    -- If no active subscription, set limit to 0
    IF subscription_limit IS NULL THEN
        subscription_limit := 0;
    END IF;
    
    -- Build result
    result := jsonb_build_object(
        'current_usage', COALESCE(current_usage, 0),
        'limit', subscription_limit,
        'has_limit', subscription_limit > 0,
        'is_over_limit', CASE 
            WHEN subscription_limit = -1 THEN FALSE  -- Unlimited
            WHEN subscription_limit = 0 THEN TRUE    -- No access
            ELSE COALESCE(current_usage, 0) >= subscription_limit
        END
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment feature usage
CREATE OR REPLACE FUNCTION increment_feature_usage(org_id UUID, feature_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    usage_limit_info JSONB;
    can_increment BOOLEAN;
BEGIN
    -- Check current usage limits
    usage_limit_info := check_usage_limit(org_id, feature_name);
    
    -- Don't increment if over limit
    IF (usage_limit_info ->> 'is_over_limit')::BOOLEAN THEN
        RETURN FALSE;
    END IF;
    
    -- Insert or update usage count
    INSERT INTO feature_usage (organization_id, feature_key, usage_count, usage_date)
    VALUES (org_id, feature_name, 1, CURRENT_DATE)
    ON CONFLICT (organization_id, feature_key, usage_date)
    DO UPDATE SET 
        usage_count = feature_usage.usage_count + 1,
        updated_at = NOW();
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get subscription analytics
CREATE OR REPLACE FUNCTION get_subscription_analytics(start_date DATE DEFAULT NULL, end_date DATE DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
    analytics JSONB;
    mrr DECIMAL;
    arr DECIMAL;
    active_subscriptions INTEGER;
    total_revenue DECIMAL;
BEGIN
    -- Set default date range if not provided
    IF start_date IS NULL THEN
        start_date := CURRENT_DATE - INTERVAL '30 days';
    END IF;
    
    IF end_date IS NULL THEN
        end_date := CURRENT_DATE;
    END IF;
    
    -- Calculate MRR (Monthly Recurring Revenue)
    SELECT COALESCE(SUM(
        CASE 
            WHEN s.billing_cycle = 'monthly' THEN sp.monthly_price
            WHEN s.billing_cycle = 'annual' THEN sp.annual_price / 12
            ELSE 0
        END
    ), 0) INTO mrr
    FROM subscriptions s
    JOIN subscription_plans sp ON sp.id = s.plan_id
    WHERE s.status = 'active';
    
    -- Calculate ARR (Annual Recurring Revenue)
    arr := mrr * 12;
    
    -- Count active subscriptions
    SELECT COUNT(*) INTO active_subscriptions
    FROM subscriptions
    WHERE status = 'active';
    
    -- Calculate total revenue in date range
    SELECT COALESCE(SUM(amount), 0) INTO total_revenue
    FROM subscription_invoices
    WHERE status = 'paid'
    AND paid_at >= start_date
    AND paid_at <= end_date;
    
    -- Build analytics object
    analytics := jsonb_build_object(
        'mrr', mrr,
        'arr', arr,
        'active_subscriptions', active_subscriptions,
        'total_revenue', total_revenue,
        'period_start', start_date,
        'period_end', end_date,
        'generated_at', NOW()
    );
    
    RETURN analytics;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- UPDATE DEFAULT SUBSCRIPTION PLANS
-- =============================================

-- Update existing plans or insert new ones with correct structure
INSERT INTO subscription_plans (name, description, monthly_price, annual_price, features, max_clients, max_campaigns, is_active) 
VALUES 
    (
        'Basic',
        'Perfect for small agencies getting started',
        29.00,
        290.00,
        '{
            "maxClients": 5,
            "maxCampaigns": 25,
            "advancedAnalytics": false,
            "customReports": false,
            "apiAccess": false,
            "whiteLabel": false,
            "prioritySupport": false
        }',
        5,
        25,
        true
    ),
    (
        'Pro',
        'Ideal for growing agencies with advanced needs',
        79.00,
        790.00,
        '{
            "maxClients": 25,
            "maxCampaigns": 100,
            "advancedAnalytics": true,
            "customReports": true,
            "apiAccess": true,
            "whiteLabel": false,
            "prioritySupport": true
        }',
        25,
        100,
        true
    ),
    (
        'Enterprise',
        'For large agencies requiring unlimited access',
        199.00,
        1990.00,
        '{
            "maxClients": -1,
            "maxCampaigns": -1,
            "advancedAnalytics": true,
            "customReports": true,
            "apiAccess": true,
            "whiteLabel": true,
            "prioritySupport": true
        }',
        -1,
        -1,
        true
    )
ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    monthly_price = EXCLUDED.monthly_price,
    annual_price = EXCLUDED.annual_price,
    features = EXCLUDED.features,
    max_clients = EXCLUDED.max_clients,
    max_campaigns = EXCLUDED.max_campaigns,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Grant service role permissions for admin functions
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Add comments
COMMENT ON TABLE subscription_plans IS 'Available subscription plans with feature configurations';
COMMENT ON TABLE subscriptions IS 'Active subscriptions linked to organizations';
COMMENT ON TABLE subscription_invoices IS 'Billing history and invoice records';
COMMENT ON TABLE feature_usage IS 'Feature usage tracking and limits per organization';