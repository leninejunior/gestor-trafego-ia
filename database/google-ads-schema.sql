-- =====================================================
-- Google Ads Integration Schema
-- =====================================================
-- This schema implements complete Google Ads integration
-- with client isolation via RLS policies
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- Table: google_ads_encryption_keys
-- Stores encryption keys for token encryption with rotation support
-- =====================================================
CREATE TABLE IF NOT EXISTS google_ads_encryption_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key_data TEXT NOT NULL,
  algorithm VARCHAR(50) DEFAULT 'aes-256-gcm',
  version INTEGER DEFAULT 1,
  key_hash TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')
);

-- Index for active keys with expiration
CREATE INDEX IF NOT EXISTS idx_google_encryption_active_expires 
ON google_ads_encryption_keys(is_active, expires_at DESC) 
WHERE is_active = true;

-- Index for version-based lookups
CREATE INDEX IF NOT EXISTS idx_google_encryption_version 
ON google_ads_encryption_keys(version DESC);

-- RLS Policy for google_ads_encryption_keys
ALTER TABLE google_ads_encryption_keys ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "service_role_encryption_keys_access" ON google_ads_encryption_keys;

-- Only service role can access encryption keys
CREATE POLICY "service_role_encryption_keys_access"
  ON google_ads_encryption_keys
  FOR ALL
  TO service_role
  USING (true);

-- Insert initial encryption key if none exists
INSERT INTO google_ads_encryption_keys (key_data, algorithm, version, is_active)
SELECT 
  encode(gen_random_bytes(32), 'base64'),
  'aes-256-gcm',
  1,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM google_ads_encryption_keys WHERE is_active = true
);

-- =====================================================
-- Table: google_ads_connections
-- Stores OAuth connections to Google Ads accounts
-- =====================================================
CREATE TABLE IF NOT EXISTS google_ads_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL,
  refresh_token TEXT NOT NULL, -- encrypted
  access_token TEXT, -- encrypted
  token_expires_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, customer_id)
);

-- Add user_id column if it doesn't exist (for tracking who created the connection)
ALTER TABLE google_ads_connections 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_google_connections_client ON google_ads_connections(client_id);
CREATE INDEX IF NOT EXISTS idx_google_connections_status ON google_ads_connections(status);
CREATE INDEX IF NOT EXISTS idx_google_connections_customer ON google_ads_connections(customer_id);

-- RLS Policy for google_ads_connections
-- DISABLED: Allowing all authenticated users to see all connections
-- If you want isolation by organization, uncomment the policy below
ALTER TABLE google_ads_connections ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "google_connections_client_access" ON google_ads_connections;

-- Allow all authenticated users to access all connections
CREATE POLICY "authenticated_users_can_access_all"
  ON google_ads_connections
  FOR ALL
  USING (auth.role() = 'authenticated');

-- =====================================================
-- Table: google_ads_campaigns
-- Stores Google Ads campaign data
-- =====================================================
CREATE TABLE IF NOT EXISTS google_ads_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES google_ads_connections(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ENABLED', 'PAUSED', 'REMOVED')),
  budget_amount DECIMAL(10, 2),
  budget_currency TEXT DEFAULT 'USD',
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(connection_id, campaign_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_google_campaigns_client ON google_ads_campaigns(client_id);
CREATE INDEX IF NOT EXISTS idx_google_campaigns_connection ON google_ads_campaigns(connection_id);
CREATE INDEX IF NOT EXISTS idx_google_campaigns_status ON google_ads_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_google_campaigns_campaign_id ON google_ads_campaigns(campaign_id);

-- RLS Policy for google_ads_campaigns
ALTER TABLE google_ads_campaigns ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "google_campaigns_client_access" ON google_ads_campaigns;

-- Allow all authenticated users to access all campaigns
CREATE POLICY "authenticated_users_can_access_all"
  ON google_ads_campaigns
  FOR ALL
  USING (auth.role() = 'authenticated');

-- =====================================================
-- Table: google_ads_metrics
-- Stores daily metrics for Google Ads campaigns
-- =====================================================
CREATE TABLE IF NOT EXISTS google_ads_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES google_ads_campaigns(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  conversions DECIMAL(10, 2) DEFAULT 0,
  cost DECIMAL(10, 2) DEFAULT 0,
  ctr DECIMAL(5, 2), -- Click-through rate
  conversion_rate DECIMAL(5, 2),
  cpc DECIMAL(10, 2), -- Cost per click
  cpa DECIMAL(10, 2), -- Cost per acquisition
  roas DECIMAL(10, 2), -- Return on ad spend
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_google_metrics_campaign ON google_ads_metrics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_google_metrics_date ON google_ads_metrics(date DESC);
CREATE INDEX IF NOT EXISTS idx_google_metrics_campaign_date ON google_ads_metrics(campaign_id, date DESC);

-- RLS Policy for google_ads_metrics
ALTER TABLE google_ads_metrics ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "google_metrics_client_access" ON google_ads_metrics;

-- Allow all authenticated users to access all metrics
CREATE POLICY "authenticated_users_can_access_all"
  ON google_ads_metrics
  FOR ALL
  USING (auth.role() = 'authenticated');

-- =====================================================
-- Table: google_ads_sync_logs
-- Stores synchronization logs for debugging and monitoring
-- =====================================================
CREATE TABLE IF NOT EXISTS google_ads_sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  connection_id UUID NOT NULL REFERENCES google_ads_connections(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL CHECK (sync_type IN ('full', 'incremental', 'metrics')),
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
  campaigns_synced INTEGER DEFAULT 0,
  metrics_updated INTEGER DEFAULT 0,
  error_message TEXT,
  error_code TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_google_sync_logs_connection ON google_ads_sync_logs(connection_id);
CREATE INDEX IF NOT EXISTS idx_google_sync_logs_status ON google_ads_sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_google_sync_logs_created ON google_ads_sync_logs(created_at DESC);

-- RLS Policy for google_ads_sync_logs
ALTER TABLE google_ads_sync_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "google_sync_logs_client_access" ON google_ads_sync_logs;

-- Allow all authenticated users to access all sync logs
CREATE POLICY "authenticated_users_can_access_all"
  ON google_ads_sync_logs
  FOR ALL
  USING (auth.role() = 'authenticated');

-- =====================================================
-- Functions and Triggers
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_google_ads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_google_ads_connections_updated_at ON google_ads_connections;
CREATE TRIGGER update_google_ads_connections_updated_at
  BEFORE UPDATE ON google_ads_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_google_ads_updated_at();

DROP TRIGGER IF EXISTS update_google_ads_campaigns_updated_at ON google_ads_campaigns;
CREATE TRIGGER update_google_ads_campaigns_updated_at
  BEFORE UPDATE ON google_ads_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_google_ads_updated_at();

DROP TRIGGER IF EXISTS update_google_ads_metrics_updated_at ON google_ads_metrics;
CREATE TRIGGER update_google_ads_metrics_updated_at
  BEFORE UPDATE ON google_ads_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_google_ads_updated_at();

-- =====================================================
-- Helper Functions
-- =====================================================

-- Function to get active Google Ads connections for a client
CREATE OR REPLACE FUNCTION get_active_google_connections(p_client_id UUID)
RETURNS TABLE (
  connection_id UUID,
  customer_id TEXT,
  last_sync_at TIMESTAMPTZ,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    id,
    google_ads_connections.customer_id,
    google_ads_connections.last_sync_at,
    google_ads_connections.status
  FROM google_ads_connections
  WHERE client_id = p_client_id
    AND status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get campaign metrics summary
CREATE OR REPLACE FUNCTION get_google_campaign_metrics_summary(
  p_campaign_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  total_impressions BIGINT,
  total_clicks BIGINT,
  total_conversions DECIMAL,
  total_cost DECIMAL,
  avg_ctr DECIMAL,
  avg_conversion_rate DECIMAL,
  avg_cpc DECIMAL,
  avg_cpa DECIMAL,
  avg_roas DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    SUM(impressions)::BIGINT,
    SUM(clicks)::BIGINT,
    SUM(conversions),
    SUM(cost),
    AVG(ctr),
    AVG(conversion_rate),
    AVG(cpc),
    AVG(cpa),
    AVG(roas)
  FROM google_ads_metrics
  WHERE campaign_id = p_campaign_id
    AND date BETWEEN p_start_date AND p_end_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Comments for documentation
-- =====================================================

COMMENT ON TABLE google_ads_encryption_keys IS 'Stores encryption keys for token encryption with rotation support';
COMMENT ON TABLE google_ads_connections IS 'Stores OAuth connections to Google Ads accounts with encrypted tokens';
COMMENT ON TABLE google_ads_campaigns IS 'Stores Google Ads campaign data synced from Google Ads API';
COMMENT ON TABLE google_ads_metrics IS 'Stores daily performance metrics for Google Ads campaigns';
COMMENT ON TABLE google_ads_sync_logs IS 'Logs all synchronization attempts for monitoring and debugging';

COMMENT ON COLUMN google_ads_encryption_keys.algorithm IS 'Encryption algorithm used (e.g., aes-256-gcm)';
COMMENT ON COLUMN google_ads_encryption_keys.version IS 'Key version number for rotation support';
COMMENT ON COLUMN google_ads_encryption_keys.key_hash IS 'Encrypted key data (encrypted with master key)';
COMMENT ON COLUMN google_ads_connections.refresh_token IS 'Encrypted refresh token for OAuth';
COMMENT ON COLUMN google_ads_connections.access_token IS 'Encrypted access token for OAuth';
COMMENT ON COLUMN google_ads_metrics.ctr IS 'Click-through rate as percentage';
COMMENT ON COLUMN google_ads_metrics.conversion_rate IS 'Conversion rate as percentage';
COMMENT ON COLUMN google_ads_metrics.roas IS 'Return on ad spend ratio';

-- =====================================================
-- Grant permissions
-- =====================================================

-- Grant access to service role for encryption keys (restricted)
GRANT SELECT, INSERT, UPDATE, DELETE ON google_ads_encryption_keys TO service_role;

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON google_ads_connections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON google_ads_campaigns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON google_ads_metrics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON google_ads_sync_logs TO authenticated;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION get_active_google_connections(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_google_campaign_metrics_summary(UUID, DATE, DATE) TO authenticated;

-- =====================================================
-- Table: google_ads_audit_log
-- Stores audit logs for Google Ads operations
-- =====================================================
CREATE TABLE IF NOT EXISTS google_ads_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES google_ads_connections(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  operation TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  action TEXT, -- Legacy field, use 'operation' instead
  details JSONB, -- Legacy field, use 'metadata' instead
  metadata JSONB,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  sensitive_data BOOLEAN DEFAULT false,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_google_audit_client 
ON google_ads_audit_log(client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_google_audit_connection 
ON google_ads_audit_log(connection_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_google_audit_operation 
ON google_ads_audit_log(operation, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_google_audit_user_date 
ON google_ads_audit_log(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_google_audit_success 
ON google_ads_audit_log(success, created_at DESC) 
WHERE success = false;

-- RLS Policy for google_ads_audit_log
ALTER TABLE google_ads_audit_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "service_role_audit_log_access" ON google_ads_audit_log;
DROP POLICY IF EXISTS "authenticated_users_audit_log_access" ON google_ads_audit_log;

-- Service role has full access
CREATE POLICY "service_role_audit_log_access"
  ON google_ads_audit_log
  FOR ALL
  TO service_role
  USING (true);

-- Authenticated users can view audit logs for their clients
CREATE POLICY "authenticated_users_audit_log_access"
  ON google_ads_audit_log
  FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT c.id 
      FROM clients c
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

-- Comments for documentation
COMMENT ON TABLE google_ads_audit_log IS 'Audit logs for Google Ads operations and data access';
COMMENT ON COLUMN google_ads_audit_log.client_id IS 'Client associated with this audit event';
COMMENT ON COLUMN google_ads_audit_log.connection_id IS 'Google Ads connection associated with this event';
COMMENT ON COLUMN google_ads_audit_log.operation IS 'Type of operation performed (e.g., connect, sync, token_refresh)';
COMMENT ON COLUMN google_ads_audit_log.metadata IS 'Additional structured data about the operation';
COMMENT ON COLUMN google_ads_audit_log.resource_type IS 'Type of resource affected (e.g., google_ads_connection, campaign)';
COMMENT ON COLUMN google_ads_audit_log.resource_id IS 'ID of the specific resource affected';
COMMENT ON COLUMN google_ads_audit_log.success IS 'Whether the operation succeeded';
COMMENT ON COLUMN google_ads_audit_log.error_message IS 'Error message if operation failed';
COMMENT ON COLUMN google_ads_audit_log.sensitive_data IS 'Flag indicating if this log contains sensitive data';

-- Grant permissions
GRANT SELECT, INSERT ON google_ads_audit_log TO authenticated;
GRANT ALL ON google_ads_audit_log TO service_role;

-- =====================================================
-- Schema Setup Complete
-- =====================================================
