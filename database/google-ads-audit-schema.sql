-- ============================================================================
-- Google Ads Audit Log Schema
-- 
-- Comprehensive audit logging for Google Ads operations and data access
-- Requirements: 2.1, 2.2
-- ============================================================================

-- Create audit log table
CREATE TABLE IF NOT EXISTS google_ads_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  operation TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  user_id UUID REFERENCES auth.users(id),
  client_id UUID REFERENCES clients(id),
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  metadata JSONB,
  sensitive_data BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_operation CHECK (
    operation IN (
      'connect', 'disconnect', 'sync', 'view_campaigns', 'view_metrics',
      'export_data', 'token_refresh', 'token_encrypt', 'token_decrypt',
      'key_rotation', 'admin_access', 'config_change', 'data_access', 'api_call'
    )
  ),
  CONSTRAINT valid_resource_type CHECK (
    resource_type IN (
      'google_ads_connection', 'google_ads_campaign', 'google_ads_metrics',
      'encryption_key', 'access_token', 'refresh_token', 'api_endpoint',
      'export_file', 'admin_panel', 'configuration'
    )
  )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_google_audit_operation 
  ON google_ads_audit_log(operation);

CREATE INDEX IF NOT EXISTS idx_google_audit_resource_type 
  ON google_ads_audit_log(resource_type);

CREATE INDEX IF NOT EXISTS idx_google_audit_user_id 
  ON google_ads_audit_log(user_id);

CREATE INDEX IF NOT EXISTS idx_google_audit_client_id 
  ON google_ads_audit_log(client_id);

CREATE INDEX IF NOT EXISTS idx_google_audit_created_at 
  ON google_ads_audit_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_google_audit_success 
  ON google_ads_audit_log(success);

CREATE INDEX IF NOT EXISTS idx_google_audit_sensitive 
  ON google_ads_audit_log(sensitive_data) 
  WHERE sensitive_data = true;

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_google_audit_user_operation 
  ON google_ads_audit_log(user_id, operation, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_google_audit_client_operation 
  ON google_ads_audit_log(client_id, operation, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_google_audit_failures 
  ON google_ads_audit_log(success, created_at DESC) 
  WHERE success = false;

-- Index for suspicious activity detection
CREATE INDEX IF NOT EXISTS idx_google_audit_recent_activity 
  ON google_ads_audit_log(user_id, created_at DESC) 
  WHERE created_at > (NOW() - INTERVAL '24 hours');

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

-- Enable RLS on audit log table
ALTER TABLE google_ads_audit_log ENABLE ROW LEVEL SECURITY;

-- Admin users can view all audit logs
CREATE POLICY "Admin users can view all audit logs"
  ON google_ads_audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE user_id = auth.uid() 
      AND is_active = true
    )
  );

-- Users can view their own audit logs (non-sensitive only)
CREATE POLICY "Users can view their own non-sensitive audit logs"
  ON google_ads_audit_log
  FOR SELECT
  USING (
    user_id = auth.uid() 
    AND sensitive_data = false
  );

-- Users can view audit logs for their clients (non-sensitive only)
CREATE POLICY "Users can view audit logs for their clients"
  ON google_ads_audit_log
  FOR SELECT
  USING (
    sensitive_data = false
    AND client_id IN (
      SELECT client_id FROM organization_memberships om
      JOIN clients c ON c.organization_id = om.organization_id
      WHERE om.user_id = auth.uid()
    )
  );

-- Service role can insert audit logs
CREATE POLICY "Service role can insert audit logs"
  ON google_ads_audit_log
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Service role can manage all audit logs
CREATE POLICY "Service role can manage all audit logs"
  ON google_ads_audit_log
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- Audit Log Summary Views
-- ============================================================================

-- View for audit summary by user
CREATE OR REPLACE VIEW google_ads_audit_summary_by_user AS
SELECT 
  user_id,
  COUNT(*) as total_events,
  COUNT(*) FILTER (WHERE success = true) as successful_events,
  COUNT(*) FILTER (WHERE success = false) as failed_events,
  COUNT(DISTINCT client_id) as unique_clients,
  COUNT(DISTINCT operation) as unique_operations,
  MIN(created_at) as first_event,
  MAX(created_at) as last_event
FROM google_ads_audit_log
WHERE user_id IS NOT NULL
GROUP BY user_id;

-- View for audit summary by client
CREATE OR REPLACE VIEW google_ads_audit_summary_by_client AS
SELECT 
  client_id,
  COUNT(*) as total_events,
  COUNT(*) FILTER (WHERE success = true) as successful_events,
  COUNT(*) FILTER (WHERE success = false) as failed_events,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(DISTINCT operation) as unique_operations,
  MIN(created_at) as first_event,
  MAX(created_at) as last_event
FROM google_ads_audit_log
WHERE client_id IS NOT NULL
GROUP BY client_id;

-- View for recent failures
CREATE OR REPLACE VIEW google_ads_recent_failures AS
SELECT *
FROM google_ads_audit_log
WHERE success = false
  AND created_at > (NOW() - INTERVAL '24 hours')
ORDER BY created_at DESC;

-- View for sensitive operations
CREATE OR REPLACE VIEW google_ads_sensitive_operations AS
SELECT *
FROM google_ads_audit_log
WHERE sensitive_data = true
ORDER BY created_at DESC;

-- ============================================================================
-- Functions for Audit Analysis
-- ============================================================================

-- Function to get audit summary for a time period
CREATE OR REPLACE FUNCTION get_google_ads_audit_summary(
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  p_client_id UUID DEFAULT NULL
) RETURNS TABLE(
  total_events BIGINT,
  successful_events BIGINT,
  failed_events BIGINT,
  unique_users BIGINT,
  unique_clients BIGINT,
  top_operations JSONB
) AS $$
DECLARE
  top_ops JSONB;
BEGIN
  -- Get top operations
  SELECT jsonb_agg(
    jsonb_build_object(
      'operation', operation,
      'count', count
    ) ORDER BY count DESC
  ) INTO top_ops
  FROM (
    SELECT operation, COUNT(*) as count
    FROM google_ads_audit_log
    WHERE created_at BETWEEN start_date AND end_date
      AND (p_client_id IS NULL OR client_id = p_client_id)
    GROUP BY operation
    ORDER BY count DESC
    LIMIT 10
  ) t;

  -- Return summary
  RETURN QUERY
  SELECT 
    COUNT(*) as total_events,
    COUNT(*) FILTER (WHERE success = true) as successful_events,
    COUNT(*) FILTER (WHERE success = false) as failed_events,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT client_id) as unique_clients,
    COALESCE(top_ops, '[]'::jsonb) as top_operations
  FROM google_ads_audit_log
  WHERE created_at BETWEEN start_date AND end_date
    AND (p_client_id IS NULL OR client_id = p_client_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to detect suspicious activity
CREATE OR REPLACE FUNCTION detect_suspicious_google_ads_activity(
  hours_back INTEGER DEFAULT 24
) RETURNS TABLE(
  user_id UUID,
  suspicious_type TEXT,
  event_count BIGINT,
  details JSONB
) AS $$
BEGIN
  -- Multiple failed attempts
  RETURN QUERY
  SELECT 
    gal.user_id,
    'multiple_failures'::TEXT as suspicious_type,
    COUNT(*) as event_count,
    jsonb_build_object(
      'failure_count', COUNT(*),
      'operations', jsonb_agg(DISTINCT operation),
      'time_span', MAX(created_at) - MIN(created_at)
    ) as details
  FROM google_ads_audit_log gal
  WHERE gal.success = false
    AND gal.created_at > (NOW() - (hours_back || ' hours')::INTERVAL)
    AND gal.user_id IS NOT NULL
  GROUP BY gal.user_id
  HAVING COUNT(*) > 5;

  -- Rapid client access
  RETURN QUERY
  SELECT 
    gal.user_id,
    'rapid_client_access'::TEXT as suspicious_type,
    COUNT(DISTINCT client_id) as event_count,
    jsonb_build_object(
      'unique_clients', COUNT(DISTINCT client_id),
      'total_events', COUNT(*),
      'time_span', MAX(created_at) - MIN(created_at)
    ) as details
  FROM google_ads_audit_log gal
  WHERE gal.operation = 'data_access'
    AND gal.created_at > (NOW() - (hours_back || ' hours')::INTERVAL)
    AND gal.user_id IS NOT NULL
    AND gal.client_id IS NOT NULL
  GROUP BY gal.user_id
  HAVING COUNT(DISTINCT client_id) > 10;

  -- Unusual sensitive operations
  RETURN QUERY
  SELECT 
    gal.user_id,
    'excessive_sensitive_ops'::TEXT as suspicious_type,
    COUNT(*) as event_count,
    jsonb_build_object(
      'sensitive_operations', COUNT(*),
      'operations', jsonb_agg(DISTINCT operation)
    ) as details
  FROM google_ads_audit_log gal
  WHERE gal.sensitive_data = true
    AND gal.created_at > (NOW() - (hours_back || ' hours')::INTERVAL)
    AND gal.user_id IS NOT NULL
  GROUP BY gal.user_id
  HAVING COUNT(*) > 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup old audit logs
CREATE OR REPLACE FUNCTION cleanup_old_google_ads_audit_logs(
  retention_days INTEGER DEFAULT 180
) RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM google_ads_audit_log
  WHERE created_at < (NOW() - (retention_days || ' days')::INTERVAL);
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Log the cleanup operation
  INSERT INTO google_ads_audit_log (
    operation,
    resource_type,
    success,
    metadata
  ) VALUES (
    'cleanup',
    'audit_log',
    true,
    jsonb_build_object(
      'deleted_count', deleted_count,
      'retention_days', retention_days,
      'cleanup_date', NOW()
    )
  );
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Triggers for Automatic Audit Logging
-- ============================================================================

-- Trigger function to automatically log sensitive table access
CREATE OR REPLACE FUNCTION trigger_audit_sensitive_access()
RETURNS TRIGGER AS $$
BEGIN
  -- Log access to Google Ads connections
  IF TG_TABLE_NAME = 'google_ads_connections' THEN
    INSERT INTO google_ads_audit_log (
      operation,
      resource_type,
      resource_id,
      user_id,
      client_id,
      success,
      metadata
    ) VALUES (
      CASE 
        WHEN TG_OP = 'SELECT' THEN 'data_access'
        WHEN TG_OP = 'INSERT' THEN 'connect'
        WHEN TG_OP = 'UPDATE' THEN 'config_change'
        WHEN TG_OP = 'DELETE' THEN 'disconnect'
      END,
      'google_ads_connection',
      COALESCE(NEW.id::TEXT, OLD.id::TEXT),
      auth.uid(),
      COALESCE(NEW.client_id, OLD.client_id),
      true,
      jsonb_build_object(
        'table', TG_TABLE_NAME,
        'operation', TG_OP,
        'timestamp', NOW()
      )
    );
  END IF;

  -- Return appropriate value based on operation
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for sensitive tables (optional - can be enabled if needed)
-- Note: These are commented out by default to avoid performance impact
-- Uncomment if automatic audit logging is required

-- DROP TRIGGER IF EXISTS trigger_audit_google_connections ON google_ads_connections;
-- CREATE TRIGGER trigger_audit_google_connections
--   AFTER INSERT OR UPDATE OR DELETE ON google_ads_connections
--   FOR EACH ROW EXECUTE FUNCTION trigger_audit_sensitive_access();

-- ============================================================================
-- Permissions and Security
-- ============================================================================

-- Grant necessary permissions
GRANT SELECT ON google_ads_audit_log TO authenticated;
GRANT INSERT ON google_ads_audit_log TO service_role;
GRANT ALL ON google_ads_audit_log TO service_role;

-- Grant access to views
GRANT SELECT ON google_ads_audit_summary_by_user TO authenticated;
GRANT SELECT ON google_ads_audit_summary_by_client TO authenticated;
GRANT SELECT ON google_ads_recent_failures TO authenticated;

-- Admin users get access to sensitive views
GRANT SELECT ON google_ads_sensitive_operations TO service_role;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_google_ads_audit_summary TO authenticated;
GRANT EXECUTE ON FUNCTION detect_suspicious_google_ads_activity TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_google_ads_audit_logs TO service_role;

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

COMMENT ON TABLE google_ads_audit_log IS 
'Comprehensive audit log for all Google Ads operations and data access';

COMMENT ON COLUMN google_ads_audit_log.operation IS 
'Type of operation performed (connect, sync, view_data, etc.)';

COMMENT ON COLUMN google_ads_audit_log.resource_type IS 
'Type of resource accessed (connection, campaign, metrics, etc.)';

COMMENT ON COLUMN google_ads_audit_log.sensitive_data IS 
'Flag indicating if this operation involved sensitive data';

COMMENT ON COLUMN google_ads_audit_log.metadata IS 
'Additional context and details about the operation (JSON format)';

COMMENT ON FUNCTION get_google_ads_audit_summary IS 
'Generate audit summary statistics for a given time period';

COMMENT ON FUNCTION detect_suspicious_google_ads_activity IS 
'Detect potentially suspicious user activity patterns';

COMMENT ON FUNCTION cleanup_old_google_ads_audit_logs IS 
'Remove audit logs older than specified retention period';