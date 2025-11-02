-- =====================================================
-- Google Ads Integration Schema
-- =====================================================
-- This schema implements complete Google Ads integration
-- with client isolation via RLS policies
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_google_connections_client ON google_ads_connections(client_id);
CREATE INDEX IF NOT EXISTS idx_google_connections_status ON google_ads_connections(status);
CREATE INDEX IF NOT EXISTS idx_google_connections_customer ON google_ads_connections(customer_id);

-- RLS Policy for google_ads_connections
ALTER TABLE google_ads_connections ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can only access their client's Google connections" ON google_ads_connections;

-- Create RLS policy
CREATE POLICY "Users can only access their client's Google connections"
  ON google_ads_connections
  FOR ALL
  USING (
    client_id IN (
      SELECT om.client_id 
      FROM organization_memberships om
      WHERE om.user_id = auth.uid()
    )
  );

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
DROP POLICY IF EXISTS "Users can only access their client's Google campaigns" ON google_ads_campaigns;

-- Create RLS policy
CREATE POLICY "Users can only access their client's Google campaigns"
  ON google_ads_campaigns
  FOR ALL
  USING (
    client_id IN (
      SELECT om.client_id 
      FROM organization_memberships om
      WHERE om.user_id = auth.uid()
    )
  );

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
DROP POLICY IF EXISTS "Users can only access metrics for their client's campaigns" ON google_ads_metrics;

-- Create RLS policy
CREATE POLICY "Users can only access metrics for their client's campaigns"
  ON google_ads_metrics
  FOR ALL
  USING (
    campaign_id IN (
      SELECT gac.id 
      FROM google_ads_campaigns gac
      INNER JOIN organization_memberships om ON gac.client_id = om.client_id
      WHERE om.user_id = auth.uid()
    )
  );

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
DROP POLICY IF EXISTS "Users can only access sync logs for their client's connections" ON google_ads_sync_logs;

-- Create RLS policy
CREATE POLICY "Users can only access sync logs for their client's connections"
  ON google_ads_sync_logs
  FOR ALL
  USING (
    connection_id IN (
      SELECT gac.id 
      FROM google_ads_connections gac
      INNER JOIN organization_memberships om ON gac.client_id = om.client_id
      WHERE om.user_id = auth.uid()
    )
  );

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

COMMENT ON TABLE google_ads_connections IS 'Stores OAuth connections to Google Ads accounts with encrypted tokens';
COMMENT ON TABLE google_ads_campaigns IS 'Stores Google Ads campaign data synced from Google Ads API';
COMMENT ON TABLE google_ads_metrics IS 'Stores daily performance metrics for Google Ads campaigns';
COMMENT ON TABLE google_ads_sync_logs IS 'Logs all synchronization attempts for monitoring and debugging';

COMMENT ON COLUMN google_ads_connections.refresh_token IS 'Encrypted refresh token for OAuth';
COMMENT ON COLUMN google_ads_connections.access_token IS 'Encrypted access token for OAuth';
COMMENT ON COLUMN google_ads_metrics.ctr IS 'Click-through rate as percentage';
COMMENT ON COLUMN google_ads_metrics.conversion_rate IS 'Conversion rate as percentage';
COMMENT ON COLUMN google_ads_metrics.roas IS 'Return on ad spend ratio';

-- =====================================================
-- Grant permissions
-- =====================================================

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON google_ads_connections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON google_ads_campaigns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON google_ads_metrics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON google_ads_sync_logs TO authenticated;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION get_active_google_connections(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_google_campaign_metrics_summary(UUID, DATE, DATE) TO authenticated;

-- =====================================================
-- Schema Setup Complete
-- =====================================================
