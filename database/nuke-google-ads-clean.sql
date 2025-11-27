-- =====================================================
-- NUCLEAR OPTION: Delete ALL Google Ads data
-- =====================================================
-- This will DELETE everything. Use with caution!

-- Disable RLS temporarily to allow deletion
ALTER TABLE google_ads_sync_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_metrics DISABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_campaigns DISABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_connections DISABLE ROW LEVEL SECURITY;

-- Delete all data in reverse dependency order
DELETE FROM google_ads_sync_logs;
DELETE FROM google_ads_metrics;
DELETE FROM google_ads_campaigns;
DELETE FROM google_ads_connections;

-- Re-enable RLS
ALTER TABLE google_ads_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_sync_logs ENABLE ROW LEVEL SECURITY;

-- Verify deletion
SELECT 'Google Ads data deleted successfully' as status;
SELECT COUNT(*) as connections_remaining FROM google_ads_connections;
SELECT COUNT(*) as campaigns_remaining FROM google_ads_campaigns;
SELECT COUNT(*) as metrics_remaining FROM google_ads_metrics;
SELECT COUNT(*) as sync_logs_remaining FROM google_ads_sync_logs;
_ads_connections;

-- 5. Verify cleanup
SELECT 'CLEANUP COMPLETE' as status;
SELECT 
  (SELECT COUNT(*) FROM google_ads_connections) as connections_remaining,
  (SELECT COUNT(*) FROM google_ads_campaigns) as campaigns_remaining,
  (SELECT COUNT(*) FROM google_ads_metrics) as metrics_remaining,
  (SELECT COUNT(*) FROM google_ads_sync_logs) as sync_logs_remaining;
