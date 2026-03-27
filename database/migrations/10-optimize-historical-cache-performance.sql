-- =====================================================
-- Migration: Optimize Historical Cache Performance
-- Task 14.2 - Historical Data Cache
-- =====================================================
-- This migration improves read performance for campaign_insights_history:
-- 1) Adds targeted indexes for common filters and sort orders
-- 2) Adds materialized view for daily aggregated metrics
-- 3) Adds helper RPCs for storage stats and MV refresh
-- =====================================================

-- 1. Targeted indexes for frequent query patterns
CREATE INDEX IF NOT EXISTS idx_cih_client_date_desc
  ON campaign_insights_history(client_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_cih_client_platform_date_desc
  ON campaign_insights_history(client_id, platform, date DESC);

CREATE INDEX IF NOT EXISTS idx_cih_client_campaign_date_desc
  ON campaign_insights_history(client_id, campaign_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_cih_client_not_deleted_date_desc
  ON campaign_insights_history(client_id, date DESC)
  WHERE is_deleted = false;

-- 2. Materialized view for daily summary by client/platform/date
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_campaign_insights_daily_summary AS
SELECT
  client_id,
  platform,
  date,
  COUNT(DISTINCT campaign_id) AS campaigns_count,
  SUM(impressions) AS total_impressions,
  SUM(clicks) AS total_clicks,
  SUM(conversions) AS total_conversions,
  SUM(spend) AS total_spend,
  AVG(ctr) AS avg_ctr,
  AVG(cpc) AS avg_cpc,
  AVG(cpm) AS avg_cpm,
  AVG(conversion_rate) AS avg_conversion_rate,
  MAX(synced_at) AS last_synced_at
FROM campaign_insights_history
GROUP BY client_id, platform, date
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_cih_daily_summary_unique
  ON mv_campaign_insights_daily_summary(client_id, platform, date);

CREATE INDEX IF NOT EXISTS idx_mv_cih_daily_summary_client_date_desc
  ON mv_campaign_insights_daily_summary(client_id, date DESC);

-- 3. Helper function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_campaign_insights_daily_summary_mv()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW mv_campaign_insights_daily_summary;
END;
$$;

-- 4. Storage stats RPC used by monitoring route
CREATE OR REPLACE FUNCTION get_cache_storage_stats()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH base AS (
    SELECT
      COUNT(*)::bigint AS total_records,
      MIN(date) AS oldest_record_date,
      MAX(date) AS newest_record_date
    FROM campaign_insights_history
  ),
  platform_counts AS (
    SELECT
      COALESCE(SUM(CASE WHEN platform = 'meta' THEN 1 ELSE 0 END), 0)::bigint AS meta_count,
      COALESCE(SUM(CASE WHEN platform = 'google' THEN 1 ELSE 0 END), 0)::bigint AS google_count
    FROM campaign_insights_history
  )
  SELECT jsonb_build_object(
    'total_records', base.total_records,
    'total_size_mb', ROUND((base.total_records * 500)::numeric / 1024 / 1024, 2),
    'records_by_platform', jsonb_build_object(
      'meta', platform_counts.meta_count,
      'google', platform_counts.google_count
    ),
    'oldest_record_date', base.oldest_record_date,
    'newest_record_date', base.newest_record_date
  )
  FROM base, platform_counts;
$$;

-- 5. Keep planner statistics updated for large tables
ANALYZE campaign_insights_history;
