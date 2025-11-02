-- =====================================================
-- Google Ads Query Optimizations
-- Additional indexes and optimizations for better performance
-- =====================================================

-- =====================================================
-- Additional Indexes for Performance
-- =====================================================

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_google_campaigns_client_status 
  ON google_ads_campaigns(client_id, status);

CREATE INDEX IF NOT EXISTS idx_google_campaigns_client_updated 
  ON google_ads_campaigns(client_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_google_campaigns_name_search 
  ON google_ads_campaigns USING gin(to_tsvector('english', campaign_name));

-- Metrics indexes for date range queries
CREATE INDEX IF NOT EXISTS idx_google_metrics_date_range 
  ON google_ads_metrics(date DESC, campaign_id);

CREATE INDEX IF NOT EXISTS idx_google_metrics_cost_performance 
  ON google_ads_metrics(cost DESC, conversions DESC) 
  WHERE cost > 0;

-- Connection indexes for sync operations
CREATE INDEX IF NOT EXISTS idx_google_connections_sync_status 
  ON google_ads_connections(last_sync_at DESC, status);

-- Sync logs indexes for monitoring
CREATE INDEX IF NOT EXISTS idx_google_sync_logs_connection_date 
  ON google_ads_sync_logs(connection_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_google_sync_logs_status_date 
  ON google_ads_sync_logs(status, created_at DESC);

-- =====================================================
-- Optimized Views for Common Queries
-- =====================================================

-- View for campaign performance summary
CREATE OR REPLACE VIEW google_campaigns_performance AS
SELECT 
  c.id,
  c.client_id,
  c.campaign_id,
  c.campaign_name,
  c.status,
  c.budget_amount,
  c.budget_currency,
  COALESCE(m.total_impressions, 0) as total_impressions,
  COALESCE(m.total_clicks, 0) as total_clicks,
  COALESCE(m.total_conversions, 0) as total_conversions,
  COALESCE(m.total_cost, 0) as total_cost,
  COALESCE(m.avg_ctr, 0) as avg_ctr,
  COALESCE(m.avg_conversion_rate, 0) as avg_conversion_rate,
  COALESCE(m.avg_cpc, 0) as avg_cpc,
  COALESCE(m.avg_cpa, 0) as avg_cpa,
  COALESCE(m.avg_roas, 0) as avg_roas,
  m.last_metric_date,
  c.created_at,
  c.updated_at
FROM google_ads_campaigns c
LEFT JOIN (
  SELECT 
    campaign_id,
    SUM(impressions) as total_impressions,
    SUM(clicks) as total_clicks,
    SUM(conversions) as total_conversions,
    SUM(cost) as total_cost,
    AVG(ctr) as avg_ctr,
    AVG(conversion_rate) as avg_conversion_rate,
    AVG(cpc) as avg_cpc,
    AVG(cpa) as avg_cpa,
    AVG(roas) as avg_roas,
    MAX(date) as last_metric_date
  FROM google_ads_metrics
  WHERE date >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY campaign_id
) m ON c.id = m.campaign_id;

-- View for recent sync status
CREATE OR REPLACE VIEW google_sync_status AS
SELECT 
  c.id as connection_id,
  c.client_id,
  c.customer_id,
  c.status as connection_status,
  c.last_sync_at,
  l.status as last_sync_status,
  l.campaigns_synced,
  l.metrics_updated,
  l.error_message,
  l.started_at as last_sync_started,
  l.completed_at as last_sync_completed,
  CASE 
    WHEN l.completed_at IS NULL AND l.started_at > NOW() - INTERVAL '1 hour' THEN 'running'
    WHEN l.status = 'success' THEN 'success'
    WHEN l.status = 'partial' THEN 'partial'
    WHEN l.status = 'failed' THEN 'failed'
    ELSE 'unknown'
  END as sync_status
FROM google_ads_connections c
LEFT JOIN LATERAL (
  SELECT *
  FROM google_ads_sync_logs sl
  WHERE sl.connection_id = c.id
  ORDER BY sl.created_at DESC
  LIMIT 1
) l ON true;

-- =====================================================
-- Optimized Functions for Common Operations
-- =====================================================

-- Function to get paginated campaigns with metrics
CREATE OR REPLACE FUNCTION get_google_campaigns_paginated(
  p_client_id UUID,
  p_status TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_sort_by TEXT DEFAULT 'campaign_name',
  p_sort_order TEXT DEFAULT 'ASC',
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  campaign_id TEXT,
  campaign_name TEXT,
  status TEXT,
  budget_amount DECIMAL,
  budget_currency TEXT,
  total_impressions BIGINT,
  total_clicks BIGINT,
  total_conversions DECIMAL,
  total_cost DECIMAL,
  avg_ctr DECIMAL,
  avg_conversion_rate DECIMAL,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  total_count BIGINT
) AS $
DECLARE
  query_text TEXT;
  count_query TEXT;
  total_records BIGINT;
BEGIN
  -- Build base query
  query_text := 'SELECT 
    gcp.id,
    gcp.campaign_id,
    gcp.campaign_name,
    gcp.status,
    gcp.budget_amount,
    gcp.budget_currency,
    gcp.total_impressions,
    gcp.total_clicks,
    gcp.total_conversions,
    gcp.total_cost,
    gcp.avg_ctr,
    gcp.avg_conversion_rate,
    gcp.created_at,
    gcp.updated_at
  FROM google_campaigns_performance gcp
  WHERE gcp.client_id = $1';

  count_query := 'SELECT COUNT(*) FROM google_campaigns_performance gcp WHERE gcp.client_id = $1';

  -- Add status filter
  IF p_status IS NOT NULL AND p_status != 'all' THEN
    query_text := query_text || ' AND gcp.status = ''' || p_status || '''';
    count_query := count_query || ' AND gcp.status = ''' || p_status || '''';
  END IF;

  -- Add search filter
  IF p_search IS NOT NULL AND p_search != '' THEN
    query_text := query_text || ' AND gcp.campaign_name ILIKE ''%' || p_search || '%''';
    count_query := count_query || ' AND gcp.campaign_name ILIKE ''%' || p_search || '%''';
  END IF;

  -- Get total count
  EXECUTE count_query USING p_client_id INTO total_records;

  -- Add sorting
  CASE p_sort_by
    WHEN 'name' THEN query_text := query_text || ' ORDER BY gcp.campaign_name';
    WHEN 'status' THEN query_text := query_text || ' ORDER BY gcp.status';
    WHEN 'cost' THEN query_text := query_text || ' ORDER BY gcp.total_cost';
    WHEN 'conversions' THEN query_text := query_text || ' ORDER BY gcp.total_conversions';
    WHEN 'created_at' THEN query_text := query_text || ' ORDER BY gcp.created_at';
    ELSE query_text := query_text || ' ORDER BY gcp.campaign_name';
  END CASE;

  -- Add sort order
  IF UPPER(p_sort_order) = 'DESC' THEN
    query_text := query_text || ' DESC';
  ELSE
    query_text := query_text || ' ASC';
  END IF;

  -- Add pagination
  query_text := query_text || ' LIMIT $2 OFFSET $3';

  -- Execute and return results with total count
  RETURN QUERY EXECUTE query_text || ', ' || total_records::TEXT || ' as total_count'
    USING p_client_id, p_limit, p_offset;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get metrics with efficient aggregation
CREATE OR REPLACE FUNCTION get_google_metrics_aggregated(
  p_client_id UUID,
  p_campaign_ids UUID[] DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_granularity TEXT DEFAULT 'daily'
)
RETURNS TABLE (
  date_period DATE,
  campaign_id UUID,
  campaign_name TEXT,
  impressions BIGINT,
  clicks BIGINT,
  conversions DECIMAL,
  cost DECIMAL,
  ctr DECIMAL,
  conversion_rate DECIMAL,
  cpc DECIMAL,
  cpa DECIMAL,
  roas DECIMAL
) AS $
DECLARE
  date_trunc_format TEXT;
BEGIN
  -- Set date truncation based on granularity
  CASE p_granularity
    WHEN 'weekly' THEN date_trunc_format := 'week';
    WHEN 'monthly' THEN date_trunc_format := 'month';
    ELSE date_trunc_format := 'day';
  END CASE;

  RETURN QUERY
  SELECT 
    DATE_TRUNC(date_trunc_format, m.date)::DATE as date_period,
    c.id as campaign_id,
    c.campaign_name,
    SUM(m.impressions) as impressions,
    SUM(m.clicks) as clicks,
    SUM(m.conversions) as conversions,
    SUM(m.cost) as cost,
    CASE 
      WHEN SUM(m.impressions) > 0 THEN (SUM(m.clicks)::DECIMAL / SUM(m.impressions) * 100)
      ELSE 0
    END as ctr,
    CASE 
      WHEN SUM(m.clicks) > 0 THEN (SUM(m.conversions) / SUM(m.clicks) * 100)
      ELSE 0
    END as conversion_rate,
    CASE 
      WHEN SUM(m.clicks) > 0 THEN (SUM(m.cost) / SUM(m.clicks))
      ELSE 0
    END as cpc,
    CASE 
      WHEN SUM(m.conversions) > 0 THEN (SUM(m.cost) / SUM(m.conversions))
      ELSE 0
    END as cpa,
    AVG(m.roas) as roas
  FROM google_ads_metrics m
  INNER JOIN google_ads_campaigns c ON m.campaign_id = c.id
  WHERE c.client_id = p_client_id
    AND (p_campaign_ids IS NULL OR c.id = ANY(p_campaign_ids))
    AND (p_start_date IS NULL OR m.date >= p_start_date)
    AND (p_end_date IS NULL OR m.date <= p_end_date)
  GROUP BY 
    DATE_TRUNC(date_trunc_format, m.date),
    c.id,
    c.campaign_name
  ORDER BY 
    date_period DESC,
    c.campaign_name;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Materialized Views for Heavy Aggregations
-- =====================================================

-- Materialized view for daily campaign summaries
CREATE MATERIALIZED VIEW IF NOT EXISTS google_daily_campaign_summary AS
SELECT 
  c.client_id,
  c.id as campaign_id,
  c.campaign_name,
  c.status,
  m.date,
  m.impressions,
  m.clicks,
  m.conversions,
  m.cost,
  m.ctr,
  m.conversion_rate,
  m.cpc,
  m.cpa,
  m.roas,
  m.created_at as metric_created_at
FROM google_ads_campaigns c
INNER JOIN google_ads_metrics m ON c.id = m.campaign_id
WHERE m.date >= CURRENT_DATE - INTERVAL '90 days';

-- Index on materialized view
CREATE INDEX IF NOT EXISTS idx_google_daily_summary_client_date 
  ON google_daily_campaign_summary(client_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_google_daily_summary_campaign_date 
  ON google_daily_campaign_summary(campaign_id, date DESC);

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_google_daily_summary()
RETURNS VOID AS $
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY google_daily_campaign_summary;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Query Optimization Settings
-- =====================================================

-- Analyze tables for better query planning
ANALYZE google_ads_connections;
ANALYZE google_ads_campaigns;
ANALYZE google_ads_metrics;
ANALYZE google_ads_sync_logs;

-- =====================================================
-- Cleanup and Maintenance Functions
-- =====================================================

-- Function to cleanup old metrics (for data retention)
CREATE OR REPLACE FUNCTION cleanup_old_google_metrics(
  p_retention_days INTEGER DEFAULT 365
)
RETURNS INTEGER AS $
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM google_ads_metrics 
  WHERE date < CURRENT_DATE - INTERVAL '1 day' * p_retention_days;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup old sync logs
CREATE OR REPLACE FUNCTION cleanup_old_google_sync_logs(
  p_retention_days INTEGER DEFAULT 30
)
RETURNS INTEGER AS $
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM google_ads_sync_logs 
  WHERE created_at < NOW() - INTERVAL '1 day' * p_retention_days;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Performance Monitoring Queries
-- =====================================================

-- Function to get query performance stats
CREATE OR REPLACE FUNCTION get_google_ads_query_stats()
RETURNS TABLE (
  table_name TEXT,
  total_size TEXT,
  index_size TEXT,
  row_count BIGINT,
  last_vacuum TIMESTAMPTZ,
  last_analyze TIMESTAMPTZ
) AS $
BEGIN
  RETURN QUERY
  SELECT 
    schemaname||'.'||tablename as table_name,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
    pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as index_size,
    n_tup_ins + n_tup_upd as row_count,
    last_vacuum,
    last_analyze
  FROM pg_stat_user_tables 
  WHERE tablename LIKE 'google_ads_%'
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Grant Permissions
-- =====================================================

GRANT SELECT ON google_campaigns_performance TO authenticated;
GRANT SELECT ON google_sync_status TO authenticated;
GRANT SELECT ON google_daily_campaign_summary TO authenticated;

GRANT EXECUTE ON FUNCTION get_google_campaigns_paginated(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_google_metrics_aggregated(UUID, UUID[], DATE, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_google_daily_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_google_metrics(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_google_sync_logs(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_google_ads_query_stats() TO authenticated;

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON VIEW google_campaigns_performance IS 'Optimized view combining campaigns with 30-day performance metrics';
COMMENT ON VIEW google_sync_status IS 'Real-time sync status for all Google Ads connections';
COMMENT ON MATERIALIZED VIEW google_daily_campaign_summary IS 'Pre-aggregated daily metrics for fast reporting (90 days)';
COMMENT ON FUNCTION get_google_campaigns_paginated IS 'Efficient paginated campaign listing with search and sorting';
COMMENT ON FUNCTION get_google_metrics_aggregated IS 'Flexible metrics aggregation with date grouping';
COMMENT ON FUNCTION refresh_google_daily_summary IS 'Refresh materialized view for daily summaries';

-- =====================================================
-- Optimization Complete
-- =====================================================