-- Export Monitoring Schema
-- Tables for tracking export metrics and system events

-- Export metrics table
CREATE TABLE IF NOT EXISTS export_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('meta', 'google', 'unified', 'all')),
  format TEXT NOT NULL CHECK (format IN ('csv', 'json')),
  status TEXT NOT NULL CHECK (status IN ('success', 'failure')),
  duration_ms INTEGER NOT NULL,
  record_count INTEGER NOT NULL DEFAULT 0,
  file_size_mb DECIMAL(10,2) NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- System events table for generic monitoring
CREATE TABLE IF NOT EXISTS system_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_export_metrics_user_created ON export_metrics(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_export_metrics_status_created ON export_metrics(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_export_metrics_platform_format ON export_metrics(platform, format);
CREATE INDEX IF NOT EXISTS idx_system_events_type_created ON system_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_events_severity_created ON system_events(severity, created_at DESC);

-- RLS policies
ALTER TABLE export_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_events ENABLE ROW LEVEL SECURITY;

-- Users can only see their own export metrics
CREATE POLICY "Users can view own export metrics" ON export_metrics
  FOR SELECT USING (auth.uid() = user_id);

-- Admins can see all export metrics
CREATE POLICY "Admins can view all export metrics" ON export_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin')
    )
  );

-- Only system can insert export metrics
CREATE POLICY "System can insert export metrics" ON export_metrics
  FOR INSERT WITH CHECK (true);

-- Only system can insert system events
CREATE POLICY "System can insert system events" ON system_events
  FOR INSERT WITH CHECK (true);

-- Admins can view system events
CREATE POLICY "Admins can view system events" ON system_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin')
    )
  );

-- Function to get export failure rate
CREATE OR REPLACE FUNCTION get_export_failure_rate(
  p_hours_back INTEGER DEFAULT 24,
  p_platform TEXT DEFAULT NULL,
  p_format TEXT DEFAULT NULL
)
RETURNS TABLE (
  total_exports BIGINT,
  failed_exports BIGINT,
  failure_rate DECIMAL
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_exports,
    COUNT(*) FILTER (WHERE status = 'failure') as failed_exports,
    CASE 
      WHEN COUNT(*) > 0 THEN 
        ROUND((COUNT(*) FILTER (WHERE status = 'failure')::DECIMAL / COUNT(*)) * 100, 2)
      ELSE 0
    END as failure_rate
  FROM export_metrics
  WHERE created_at >= NOW() - (p_hours_back || ' hours')::INTERVAL
    AND (p_platform IS NULL OR platform = p_platform)
    AND (p_format IS NULL OR format = p_format);
END;
$$;

-- Function to clean up old metrics (keep last 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_export_metrics()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM export_metrics 
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  DELETE FROM system_events 
  WHERE created_at < NOW() - INTERVAL '90 days'
    AND severity = 'info'; -- Keep warnings and errors longer
  
  RETURN deleted_count;
END;
$$;

-- Function to get recent export failures by user
CREATE OR REPLACE FUNCTION get_recent_export_failures_by_user(
  p_user_id UUID,
  p_format TEXT,
  p_hours_back INTEGER DEFAULT 1
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM export_metrics
    WHERE user_id = p_user_id
      AND format = p_format
      AND status = 'failure'
      AND created_at >= NOW() - (p_hours_back || ' hours')::INTERVAL
  );
END;
$$;

COMMENT ON TABLE export_metrics IS 'Tracks export operation metrics for monitoring and alerting';
COMMENT ON TABLE system_events IS 'Generic system events for monitoring and debugging';
COMMENT ON FUNCTION get_export_failure_rate IS 'Calculate export failure rate for alerting';
COMMENT ON FUNCTION cleanup_old_export_metrics IS 'Clean up old export metrics to manage storage';
COMMENT ON FUNCTION get_recent_export_failures_by_user IS 'Get recent export failures for a specific user';