-- =====================================================
-- Google Ads Monitoring and Logging Schema
-- =====================================================
-- Extends the Google Ads schema with monitoring capabilities
-- Requirements: 10.3, 10.5
-- =====================================================

-- =====================================================
-- Table: google_ads_metrics_history
-- Stores aggregated metrics for monitoring and alerting
-- =====================================================
CREATE TABLE IF NOT EXISTS google_ads_metrics_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp TIMESTAMPTZ NOT NULL,
  period TEXT NOT NULL CHECK (period IN ('1h', '24h', '7d', '30d')),
  
  -- Sync metrics
  sync_count INTEGER DEFAULT 0,
  sync_duration BIGINT DEFAULT 0, -- milliseconds
  sync_success_rate DECIMAL(5, 4) DEFAULT 0, -- 0.0 to 1.0
  campaigns_synced_total INTEGER DEFAULT 0,
  metrics_synced_total INTEGER DEFAULT 0,
  
  -- Error metrics
  error_count INTEGER DEFAULT 0,
  critical_error_count INTEGER DEFAULT 0,
  retry_count INTEGER DEFAULT 0,
  
  -- Connection metrics
  active_connections INTEGER DEFAULT 0,
  expired_tokens INTEGER DEFAULT 0,
  failed_connections INTEGER DEFAULT 0,
  
  -- API metrics
  api_request_count INTEGER DEFAULT 0,
  api_request_duration BIGINT DEFAULT 0, -- milliseconds
  api_error_rate DECIMAL(5, 4) DEFAULT 0, -- 0.0 to 1.0
  api_success_rate DECIMAL(5, 4) DEFAULT 0, -- 0.0 to 1.0
  
  -- Rate limiting metrics
  rate_limit_hits INTEGER DEFAULT 0,
  backoff_events INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(timestamp, period)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_google_metrics_history_timestamp ON google_ads_metrics_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_google_metrics_history_period ON google_ads_metrics_history(period);
CREATE INDEX IF NOT EXISTS idx_google_metrics_history_created ON google_ads_metrics_history(created_at DESC);

-- =====================================================
-- Table: google_ads_alerts
-- Stores active and resolved alerts
-- =====================================================
CREATE TABLE IF NOT EXISTS google_ads_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_type TEXT NOT NULL CHECK (alert_type IN ('error_rate', 'sync_failure', 'token_expiry', 'rate_limit', 'performance')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  threshold_value DECIMAL(10, 4),
  current_value DECIMAL(10, 4),
  
  -- Optional context
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES google_ads_connections(id) ON DELETE CASCADE,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  resolution_notes TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_google_alerts_active ON google_ads_alerts(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_google_alerts_severity ON google_ads_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_google_alerts_type ON google_ads_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_google_alerts_created ON google_ads_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_google_alerts_organization ON google_ads_alerts(organization_id);

-- =====================================================
-- Table: google_ads_performance_logs
-- Stores detailed performance metrics for operations
-- =====================================================
CREATE TABLE IF NOT EXISTS google_ads_performance_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  operation TEXT NOT NULL,
  duration BIGINT NOT NULL, -- milliseconds
  memory_usage BIGINT, -- bytes
  records_processed INTEGER DEFAULT 0,
  api_calls INTEGER DEFAULT 0,
  
  -- Context
  connection_id UUID REFERENCES google_ads_connections(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  
  -- Additional metadata
  metadata JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_google_performance_logs_operation ON google_ads_performance_logs(operation);
CREATE INDEX IF NOT EXISTS idx_google_performance_logs_duration ON google_ads_performance_logs(duration DESC);
CREATE INDEX IF NOT EXISTS idx_google_performance_logs_created ON google_ads_performance_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_google_performance_logs_client ON google_ads_performance_logs(client_id);

-- =====================================================
-- Table: google_ads_api_logs
-- Stores detailed API request/response logs
-- =====================================================
CREATE TABLE IF NOT EXISTS google_ads_api_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,
  duration BIGINT, -- milliseconds
  
  -- Request details
  request_size INTEGER, -- bytes
  response_size INTEGER, -- bytes
  
  -- Context
  connection_id UUID REFERENCES google_ads_connections(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  
  -- Error details
  error_code TEXT,
  error_message TEXT,
  
  -- Rate limiting
  rate_limit_remaining INTEGER,
  rate_limit_reset TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_google_api_logs_request_id ON google_ads_api_logs(request_id);
CREATE INDEX IF NOT EXISTS idx_google_api_logs_endpoint ON google_ads_api_logs(endpoint);
CREATE INDEX IF NOT EXISTS idx_google_api_logs_status ON google_ads_api_logs(status_code);
CREATE INDEX IF NOT EXISTS idx_google_api_logs_created ON google_ads_api_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_google_api_logs_client ON google_ads_api_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_google_api_logs_connection ON google_ads_api_logs(connection_id);

-- =====================================================
-- RLS Policies
-- =====================================================

-- Enable RLS on all monitoring tables
ALTER TABLE google_ads_metrics_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_performance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_api_logs ENABLE ROW LEVEL SECURITY;

-- Metrics history - accessible to all authenticated users (aggregated data)
CREATE POLICY "Authenticated users can access metrics history"
  ON google_ads_metrics_history
  FOR SELECT
  TO authenticated
  USING (true);

-- Only service role can insert metrics history
CREATE POLICY "Service role can manage metrics history"
  ON google_ads_metrics_history
  FOR ALL
  TO service_role
  USING (true);

-- Alerts - users can see alerts for their organizations
CREATE POLICY "Users can access alerts for their organizations"
  ON google_ads_alerts
  FOR SELECT
  TO authenticated
  USING (
    organization_id IS NULL OR
    organization_id IN (
      SELECT om.organization_id 
      FROM organization_memberships om
      WHERE om.user_id = auth.uid()
    )
  );

-- Only service role can manage alerts
CREATE POLICY "Service role can manage alerts"
  ON google_ads_alerts
  FOR ALL
  TO service_role
  USING (true);

-- Performance logs - users can access logs for their clients
CREATE POLICY "Users can access performance logs for their clients"
  ON google_ads_performance_logs
  FOR SELECT
  TO authenticated
  USING (
    client_id IS NULL OR
    client_id IN (
      SELECT om.client_id 
      FROM organization_memberships om
      WHERE om.user_id = auth.uid()
    )
  );

-- Only service role can insert performance logs
CREATE POLICY "Service role can manage performance logs"
  ON google_ads_performance_logs
  FOR ALL
  TO service_role
  USING (true);

-- API logs - users can access logs for their clients
CREATE POLICY "Users can access API logs for their clients"
  ON google_ads_api_logs
  FOR SELECT
  TO authenticated
  USING (
    client_id IS NULL OR
    client_id IN (
      SELECT om.client_id 
      FROM organization_memberships om
      WHERE om.user_id = auth.uid()
    )
  );

-- Only service role can insert API logs
CREATE POLICY "Service role can manage API logs"
  ON google_ads_api_logs
  FOR ALL
  TO service_role
  USING (true);

-- =====================================================
-- Functions for monitoring
-- =====================================================

-- Function to clean up old monitoring data
CREATE OR REPLACE FUNCTION cleanup_google_ads_monitoring_data()
RETURNS void AS $
DECLARE
  retention_days INTEGER := 90; -- Configurable retention period
BEGIN
  -- Clean up old metrics history (keep 90 days)
  DELETE FROM google_ads_metrics_history 
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  -- Clean up old performance logs (keep 30 days)
  DELETE FROM google_ads_performance_logs 
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  -- Clean up old API logs (keep 30 days)
  DELETE FROM google_ads_api_logs 
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  -- Clean up resolved alerts older than 30 days
  DELETE FROM google_ads_alerts 
  WHERE is_active = false 
    AND resolved_at < NOW() - INTERVAL '30 days';
    
  RAISE NOTICE 'Google Ads monitoring data cleanup completed';
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get system health summary
CREATE OR REPLACE FUNCTION get_google_ads_health_summary()
RETURNS TABLE (
  metric_name TEXT,
  metric_value DECIMAL,
  status TEXT,
  last_updated TIMESTAMPTZ
) AS $
BEGIN
  RETURN QUERY
  WITH recent_metrics AS (
    SELECT *
    FROM google_ads_metrics_history
    WHERE period = '1h'
      AND timestamp >= NOW() - INTERVAL '2 hours'
    ORDER BY timestamp DESC
    LIMIT 1
  ),
  active_alerts AS (
    SELECT COUNT(*) as alert_count,
           MAX(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as has_critical
    FROM google_ads_alerts
    WHERE is_active = true
  )
  SELECT 
    'sync_success_rate'::TEXT,
    COALESCE(rm.sync_success_rate, 0),
    CASE 
      WHEN COALESCE(rm.sync_success_rate, 0) >= 0.9 THEN 'healthy'
      WHEN COALESCE(rm.sync_success_rate, 0) >= 0.7 THEN 'degraded'
      ELSE 'unhealthy'
    END,
    COALESCE(rm.timestamp, NOW())
  FROM recent_metrics rm
  FULL OUTER JOIN active_alerts aa ON true
  
  UNION ALL
  
  SELECT 
    'active_alerts'::TEXT,
    COALESCE(aa.alert_count::DECIMAL, 0),
    CASE 
      WHEN COALESCE(aa.has_critical, 0) = 1 THEN 'critical'
      WHEN COALESCE(aa.alert_count, 0) > 5 THEN 'degraded'
      WHEN COALESCE(aa.alert_count, 0) > 0 THEN 'warning'
      ELSE 'healthy'
    END,
    NOW()
  FROM active_alerts aa
  FULL OUTER JOIN recent_metrics rm ON true;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Grant permissions
-- =====================================================

-- Grant access to authenticated users for read operations
GRANT SELECT ON google_ads_metrics_history TO authenticated;
GRANT SELECT ON google_ads_alerts TO authenticated;
GRANT SELECT ON google_ads_performance_logs TO authenticated;
GRANT SELECT ON google_ads_api_logs TO authenticated;

-- Grant full access to service role
GRANT ALL ON google_ads_metrics_history TO service_role;
GRANT ALL ON google_ads_alerts TO service_role;
GRANT ALL ON google_ads_performance_logs TO service_role;
GRANT ALL ON google_ads_api_logs TO service_role;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION cleanup_google_ads_monitoring_data() TO service_role;
GRANT EXECUTE ON FUNCTION get_google_ads_health_summary() TO authenticated;

-- =====================================================
-- Comments for documentation
-- =====================================================

COMMENT ON TABLE google_ads_metrics_history IS 'Stores aggregated performance metrics for monitoring and alerting';
COMMENT ON TABLE google_ads_alerts IS 'Stores system alerts for Google Ads integration issues';
COMMENT ON TABLE google_ads_performance_logs IS 'Detailed performance logs for Google Ads operations';
COMMENT ON TABLE google_ads_api_logs IS 'Detailed API request/response logs for debugging';

COMMENT ON FUNCTION cleanup_google_ads_monitoring_data() IS 'Cleans up old monitoring data based on retention policies';
COMMENT ON FUNCTION get_google_ads_health_summary() IS 'Returns current system health status summary';

-- =====================================================
-- Monitoring Schema Setup Complete
-- =====================================================