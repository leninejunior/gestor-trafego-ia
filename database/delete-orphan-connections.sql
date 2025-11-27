-- =====================================================
-- Delete Orphan Google Ads Connections
-- =====================================================
-- Remove todas as conexões sem client_id válido

-- Step 1: Delete sync logs for orphan connections
DELETE FROM google_ads_sync_logs
WHERE connection_id IN (
  SELECT gac.id FROM google_ads_connections gac
  LEFT JOIN clients c ON gac.client_id = c.id
  WHERE gac.client_id IS NULL OR c.id IS NULL
);

-- Step 2: Delete metrics for orphan campaigns
DELETE FROM google_ads_metrics
WHERE campaign_id IN (
  SELECT gac.id FROM google_ads_campaigns gac
  LEFT JOIN google_ads_connections conn ON gac.connection_id = conn.id
  WHERE conn.client_id IS NULL OR conn.id IS NULL
);

-- Step 3: Delete orphan campaigns
DELETE FROM google_ads_campaigns
WHERE connection_id IN (
  SELECT gac.id FROM google_ads_connections gac
  LEFT JOIN clients c ON gac.client_id = c.id
  WHERE gac.client_id IS NULL OR c.id IS NULL
);

-- Step 4: Delete orphan connections
DELETE FROM google_ads_connections
WHERE client_id IS NULL 
   OR client_id NOT IN (SELECT id FROM clients);

-- Verify cleanup
SELECT 'Cleanup Complete' as status;
SELECT COUNT(*) as remaining_connections FROM google_ads_connections;
SELECT COUNT(*) as remaining_campaigns FROM google_ads_campaigns;
SELECT COUNT(*) as remaining_metrics FROM google_ads_metrics;
