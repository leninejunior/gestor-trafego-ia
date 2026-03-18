-- =====================================================
-- Complete Setup: Schema + Cleanup
-- =====================================================
-- Execute this ONCE to:
-- 1. Create all Google Ads tables with correct RLS
-- 2. Clean up test/mock data
-- =====================================================

-- First, run the schema (this will be idempotent with IF NOT EXISTS)
-- Copy the entire contents of google-ads-schema.sql here, OR
-- Run google-ads-schema.sql first, then this cleanup script

-- =====================================================
-- CLEANUP: Remove All Test/Mock Google Ads Data
-- =====================================================

-- Delete sync logs for test connections
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

-- Delete metrics for test campaigns
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

-- Delete test campaigns
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

-- Delete test connections
DELETE FROM google_ads_connections
WHERE customer_id ILIKE '%test%'
  OR customer_id ILIKE '%mock%'
  OR customer_id ILIKE '%fake%'
  OR customer_id ILIKE '%demo%'
  OR customer_id ILIKE '%sandbox%'
  OR customer_id ILIKE '%ficticio%'
  OR customer_id ILIKE '%simulado%';

-- =====================================================
-- Verify: Show remaining production data
-- =====================================================

SELECT 'Production Google Ads Connections:' as status;
SELECT 
  gac.id,
  gac.customer_id,
  c.name as client_name,
  gac.status,
  gac.created_at
FROM google_ads_connections gac
LEFT JOIN clients c ON gac.client_id = c.id
ORDER BY gac.created_at DESC;

SELECT 'Production Google Ads Campaigns:' as status;
SELECT 
  COUNT(*) as total_campaigns
FROM google_ads_campaigns;

SELECT 'Production Google Ads Metrics:' as status;
SELECT 
  COUNT(*) as total_metrics
FROM google_ads_metrics;
