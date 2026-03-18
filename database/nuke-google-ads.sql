-- =====================================================
-- NUCLEAR OPTION: Delete ALL Google Ads data
-- =====================================================
-- Use this ONLY if you want to start completely fresh

-- Disable RLS temporarily to delete everything
ALTER TABLE google_ads_sync_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_metrics DISABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_campaigns DISABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_connections DISABLE ROW LEVEL SECURITY;

-- Delete everything
DELETE FROM google_ads_sync_logs;
DELETE FROM google_ads_metrics;
DELETE FROM google_ads_campaigns;
DELETE FROM google_ads_connections;

-- Re-enable RLS
ALTER TABLE google_ads_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_sync_logs ENABLE ROW LEVEL SECURITY;

-- Verify it's empty
SELECT 'Google Ads tables are now empty' as status;
SELECT COUNT(*) as connection_count FROM google_ads_connections;
SELECT COUNT(*) as campaign_count FROM google_ads_campaigns;
SELECT COUNT(*) as metrics_count FROM google_ads_metrics;
SELECT COUNT(*) as sync_logs_count FROM google_ads_sync_logs;
