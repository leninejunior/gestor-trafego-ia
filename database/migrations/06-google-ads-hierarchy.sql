-- =====================================================
-- Google Ads Hierarchy Migration
-- Adiciona tabelas para Ad Groups e Ads
-- =====================================================
-- Data: 2025-12-08
-- Descrição: Implementa hierarquia completa Campaign > Ad Group > Ad
-- =====================================================

-- =====================================================
-- Table: google_ads_ad_groups
-- Stores Google Ads ad groups (conjuntos de anúncios)
-- =====================================================
CREATE TABLE IF NOT EXISTS google_ads_ad_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES google_ads_connections(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES google_ads_campaigns(id) ON DELETE CASCADE,
  ad_group_id TEXT NOT NULL,
  ad_group_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ENABLED', 'PAUSED', 'REMOVED')),
  type TEXT, -- SEARCH_STANDARD, DISPLAY_STANDARD, etc.
  cpc_bid_micros BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(connection_id, ad_group_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_google_ad_groups_client ON google_ads_ad_groups(client_id);
CREATE INDEX IF NOT EXISTS idx_google_ad_groups_connection ON google_ads_ad_groups(connection_id);
CREATE INDEX IF NOT EXISTS idx_google_ad_groups_campaign ON google_ads_ad_groups(campaign_id);
CREATE INDEX IF NOT EXISTS idx_google_ad_groups_status ON google_ads_ad_groups(status);
CREATE INDEX IF NOT EXISTS idx_google_ad_groups_ad_group_id ON google_ads_ad_groups(ad_group_id);

-- RLS Policy for google_ads_ad_groups
ALTER TABLE google_ads_ad_groups ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "authenticated_users_can_access_all_ad_groups" ON google_ads_ad_groups;

-- Allow all authenticated users to access all ad groups
CREATE POLICY "authenticated_users_can_access_all_ad_groups"
  ON google_ads_ad_groups
  FOR ALL
  USING (auth.role() = 'authenticated');

-- =====================================================
-- Table: google_ads_ads
-- Stores Google Ads individual ads (anúncios)
-- =====================================================
CREATE TABLE IF NOT EXISTS google_ads_ads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES google_ads_connections(id) ON DELETE CASCADE,
  ad_group_id UUID NOT NULL REFERENCES google_ads_ad_groups(id) ON DELETE CASCADE,
  ad_id TEXT NOT NULL,
  ad_name TEXT,
  type TEXT, -- RESPONSIVE_SEARCH_AD, EXPANDED_TEXT_AD, etc.
  status TEXT NOT NULL CHECK (status IN ('ENABLED', 'PAUSED', 'REMOVED')),
  final_urls TEXT[], -- Array de URLs finais
  headlines JSONB, -- Array de headlines para RSA
  descriptions JSONB, -- Array de descriptions para RSA
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(connection_id, ad_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_google_ads_client ON google_ads_ads(client_id);
CREATE INDEX IF NOT EXISTS idx_google_ads_connection ON google_ads_ads(connection_id);
CREATE INDEX IF NOT EXISTS idx_google_ads_ad_group ON google_ads_ads(ad_group_id);
CREATE INDEX IF NOT EXISTS idx_google_ads_status ON google_ads_ads(status);
CREATE INDEX IF NOT EXISTS idx_google_ads_ad_id ON google_ads_ads(ad_id);

-- RLS Policy for google_ads_ads
ALTER TABLE google_ads_ads ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "authenticated_users_can_access_all_ads" ON google_ads_ads;

-- Allow all authenticated users to access all ads
CREATE POLICY "authenticated_users_can_access_all_ads"
  ON google_ads_ads
  FOR ALL
  USING (auth.role() = 'authenticated');

-- =====================================================
-- Table: google_ads_ad_group_metrics
-- Stores daily metrics for Google Ads ad groups
-- =====================================================
CREATE TABLE IF NOT EXISTS google_ads_ad_group_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ad_group_id UUID NOT NULL REFERENCES google_ads_ad_groups(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  conversions DECIMAL(10, 2) DEFAULT 0,
  cost DECIMAL(10, 2) DEFAULT 0,
  ctr DECIMAL(5, 4),
  cpc DECIMAL(10, 2),
  cpa DECIMAL(10, 2),
  roas DECIMAL(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ad_group_id, date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_google_ad_group_metrics_ad_group ON google_ads_ad_group_metrics(ad_group_id);
CREATE INDEX IF NOT EXISTS idx_google_ad_group_metrics_date ON google_ads_ad_group_metrics(date DESC);

-- RLS Policy
ALTER TABLE google_ads_ad_group_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_users_can_access_all_ad_group_metrics" ON google_ads_ad_group_metrics;

CREATE POLICY "authenticated_users_can_access_all_ad_group_metrics"
  ON google_ads_ad_group_metrics
  FOR ALL
  USING (auth.role() = 'authenticated');

-- =====================================================
-- Table: google_ads_ad_metrics
-- Stores daily metrics for Google Ads individual ads
-- =====================================================
CREATE TABLE IF NOT EXISTS google_ads_ad_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ad_id UUID NOT NULL REFERENCES google_ads_ads(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  conversions DECIMAL(10, 2) DEFAULT 0,
  cost DECIMAL(10, 2) DEFAULT 0,
  ctr DECIMAL(5, 4),
  cpc DECIMAL(10, 2),
  cpa DECIMAL(10, 2),
  roas DECIMAL(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ad_id, date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_google_ad_metrics_ad ON google_ads_ad_metrics(ad_id);
CREATE INDEX IF NOT EXISTS idx_google_ad_metrics_date ON google_ads_ad_metrics(date DESC);

-- RLS Policy
ALTER TABLE google_ads_ad_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_users_can_access_all_ad_metrics" ON google_ads_ad_metrics;

CREATE POLICY "authenticated_users_can_access_all_ad_metrics"
  ON google_ads_ad_metrics
  FOR ALL
  USING (auth.role() = 'authenticated');

-- =====================================================
-- Triggers for updated_at
-- =====================================================
DROP TRIGGER IF EXISTS update_google_ads_ad_groups_updated_at ON google_ads_ad_groups;
CREATE TRIGGER update_google_ads_ad_groups_updated_at
  BEFORE UPDATE ON google_ads_ad_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_google_ads_updated_at();

DROP TRIGGER IF EXISTS update_google_ads_ads_updated_at ON google_ads_ads;
CREATE TRIGGER update_google_ads_ads_updated_at
  BEFORE UPDATE ON google_ads_ads
  FOR EACH ROW
  EXECUTE FUNCTION update_google_ads_updated_at();

DROP TRIGGER IF EXISTS update_google_ads_ad_group_metrics_updated_at ON google_ads_ad_group_metrics;
CREATE TRIGGER update_google_ads_ad_group_metrics_updated_at
  BEFORE UPDATE ON google_ads_ad_group_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_google_ads_updated_at();

DROP TRIGGER IF EXISTS update_google_ads_ad_metrics_updated_at ON google_ads_ad_metrics;
CREATE TRIGGER update_google_ads_ad_metrics_updated_at
  BEFORE UPDATE ON google_ads_ad_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_google_ads_updated_at();

-- =====================================================
-- Grant permissions
-- =====================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON google_ads_ad_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON google_ads_ads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON google_ads_ad_group_metrics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON google_ads_ad_metrics TO authenticated;

-- =====================================================
-- Comments for documentation
-- =====================================================
COMMENT ON TABLE google_ads_ad_groups IS 'Stores Google Ads ad groups (conjuntos de anúncios)';
COMMENT ON TABLE google_ads_ads IS 'Stores Google Ads individual ads (anúncios)';
COMMENT ON TABLE google_ads_ad_group_metrics IS 'Stores daily metrics for Google Ads ad groups';
COMMENT ON TABLE google_ads_ad_metrics IS 'Stores daily metrics for Google Ads individual ads';

-- =====================================================
-- Migration Complete
-- =====================================================
