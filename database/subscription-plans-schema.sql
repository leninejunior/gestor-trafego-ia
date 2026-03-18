-- SaaS Subscription Plans Database Schema
-- This schema implements the complete subscription management system
-- with multi-tenant security using Row Level Security (RLS)

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- SUBSCRIPTION PLANS TABLE
-- =============================================
-- Stores available subscription plans with feature configurations
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    monthly_price DECIMAL(10,2) NOT NULL DEFAULT 0,
    annual_price DECIMAL(10,2) NOT NULL DEFAULT 0,
    features JSONB NOT NULL DEFAULT '{}',
    max_clients INTEGER NOT NULL DEFAULT 0,
    max_campaigns INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON subscription_plans(is_active);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_features ON subscription_plans USING GIN(features);

-- =============================================
-- SUBSCRIPTIONS TABLE
-- =============================================
-- Stores active subscriptions linked to organizations
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'trialing')),
    billing_cycle VARCHAR(10) NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'annual')),
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    trial_end TIMESTAMP WITH TIME ZONE,
    payment_method_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    stripe_customer_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one active subscription per organization
    CONSTRAINT unique_active_subscription_per_org UNIQUE (organization_id) DEFERRABLE INITIALLY DEFERRED
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_org_id ON subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id ON subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON subscriptions(current_period_end);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);

-- =============================================
-- SUBSCRIPTION INVOICES TABLE
-- =============================================
-- Stores billing history and invoice records
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

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_subscription_id ON subscription_invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_status ON subscription_invoices(status);
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_due_date ON subscription_invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_stripe_invoice ON subscription_invoices(stripe_invoice_id);
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_payment_intent ON subscription_invoices(payment_intent_id);

-- =============================================
-- FEATURE USAGE TRACKING TABLE
-- =============================================
-- Tracks feature usage and limits per organization
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

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_feature_usage_org_id ON feature_usage(organization_id);
CREATE INDEX IF NOT EXISTS idx_feature_usage_feature_key ON feature_usage(feature_key);
CREATE INDEX IF NOT EXISTS idx_feature_usage_date ON feature_usage(usage_date);
CREATE INDEX IF NOT EXISTS idx_feature_usage_org_feature ON feature_usage(organization_id, feature_key);

-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_usage ENABLE ROW LEVEL SECURITY;

-- =============================================
-- SUBSCRIPTION PLANS RLS POLICIES
-- =============================================
-- Public read access to active plans (for pricing page)
CREATE POLICY "subscription_plans_public_read" ON subscription_plans
    FOR SELECT USING (is_active = true);

-- Admin full access to all plans
CREATE POLICY "subscription_plans_admin_all" ON subscription_plans
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM memberships m
            JOIN auth.users u ON u.id = m.user_id
            WHERE u.id = auth.uid()
            AND m.role = 'super_admin'
        )
    );

-- =============================================
-- SUBSCRIPTIONS RLS POLICIES
-- =============================================
-- Users can only access subscriptions for their organizations
CREATE POLICY "subscriptions_organization_access" ON subscriptions
    FOR ALL USING (
        organization_id IN (
            SELECT m.organization_id 
            FROM memberships m 
            WHERE m.user_id = auth.uid()
        )
    );

-- =============================================
-- SUBSCRIPTION INVOICES RLS POLICIES
-- =============================================
-- Users can only access invoices for their organization's subscriptions
CREATE POLICY "subscription_invoices_organization_access" ON subscription_invoices
    FOR ALL USING (
        subscription_id IN (
            SELECT s.id 
            FROM subscriptions s
            JOIN memberships m ON m.organization_id = s.organization_id
            WHERE m.user_id = auth.uid()
        )
    );

-- =============================================
-- FEATURE USAGE RLS POLICIES
-- =============================================
-- Users can only access feature usage for their organizations
CREATE POLICY "feature_usage_organization_access" ON feature_usage
    FOR ALL USING (
        organization_id IN (
            SELECT m.organization_id 
            FROM memberships m 
            WHERE m.user_id = auth.uid()
        )
    );

-- =============================================
-- FUNCTIONS AND TRIGGERS
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
CREATE TRIGGER update_subscription_plans_updated_at 
    BEFORE UPDATE ON subscription_plans 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at 
    BEFORE UPDATE ON subscriptions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscription_invoices_updated_at 
    BEFORE UPDATE ON subscription_invoices 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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
CREATE TRIGGER set_subscription_period_end_trigger 
    BEFORE INSERT OR UPDATE ON subscriptions 
    FOR EACH ROW EXECUTE FUNCTION set_subscription_period_end();

-- =============================================
-- DEFAULT SUBSCRIPTION PLANS
-- =============================================
-- Insert default subscription plans
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
ON CONFLICT DO NOTHING;

-- =============================================
-- HELPER FUNCTIONS FOR FEATURE GATING
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

-- =============================================
-- ADMIN HELPER FUNCTIONS
-- =============================================

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

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Grant service role permissions for admin functions
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

COMMENT ON TABLE subscription_plans IS 'Available subscription plans with feature configurations';
COMMENT ON TABLE subscriptions IS 'Active subscriptions linked to organizations';
COMMENT ON TABLE subscription_invoices IS 'Billing history and invoice records';
COMMENT ON TABLE feature_usage IS 'Feature usage tracking and limits per organization';