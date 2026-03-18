-- =====================================================
-- Cleanup Script: Remove All Test/Mock Google Ads Data
-- =====================================================
-- IMPORTANT: Run database/google-ads-schema.sql FIRST
-- This script removes all fictitious Google Ads accounts
-- and keeps only real production accounts
-- =====================================================

-- Step 1: Delete test data in reverse dependency order

-- Delete sync logs (if table exists)
DELETE FROM google_ads_sync_logs
WHERE connection_id IN (
  SELECT id FROM google_ads_connections
  WHERE customer_id ILIKE '%test%'
    OR customer_id ILIKE '%mock%'
    OR customer_id ILIKE '%fake%'
    OR customer_id ILIKE '%demo%'
    OR customer_id ILIKE '%sandbox%'
    OR customer_id ILIKE '%ficticio%'
    OR customer_id ILIKE '%simulado%'
);

-- Delete metrics
DELETE FROM google_ads_metrics
WHERE campaign_id IN (
  SELECT id FROM google_ads_campaigns
  WHERE connection_id IN (
    SELECT id FROM google_ads_connections
    WHERE customer_id ILIKE '%test%'
      OR customer_id ILIKE '%mock%'
      OR customer_id ILIKE '%fake%'
      OR customer_id ILIKE '%demo%'
      OR customer_id ILIKE '%sandbox%'
      OR customer_id ILIKE '%ficticio%'
      OR customer_id ILIKE '%simulado%'
  )
);

-- Delete campaigns
DELETE FROM google_ads_campaigns
WHERE connection_id IN (
  SELECT id FROM google_ads_connections
  WHERE customer_id ILIKE '%test%'
    OR customer_id ILIKE '%mock%'
    OR customer_id ILIKE '%fake%'
    OR customer_id ILIKE '%demo%'
    OR customer_id ILIKE '%sandbox%'
    OR customer_id ILIKE '%ficticio%'
    OR customer_id ILIKE '%simulado%'
);

-- Delete connections
DELETE FROM google_ads_connections
WHERE customer_id ILIKE '%test%'
  OR customer_id ILIKE '%mock%'
  OR customer_id ILIKE '%fake%'
  OR customer_id ILIKE '%demo%'
  OR customer_id ILIKE '%sandbox%'
  OR customer_id ILIKE '%ficticio%'
  OR customer_id ILIKE '%simulado%';

-- Step 2: Verify cleanup
SELECT 'Cleanup Complete - Remaining Production Data:' as status;

SELECT 
  COUNT(*) as total_connections
FROM google_ads_connections;

SELECT 
  COUNT(*) as total_campaigns
FROM google_ads_campaigns;

SELECT 
  COUNT(*) as total_metrics
FROM google_ads_metrics;