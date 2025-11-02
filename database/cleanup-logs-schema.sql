-- =====================================================
-- Cleanup Logs Schema
-- =====================================================
-- Table to track cleanup job executions and results

-- Tabela de logs de limpeza
CREATE TABLE IF NOT EXISTS cleanup_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Job information
  job_type VARCHAR(50) NOT NULL CHECK (job_type IN (
    'delete_expired_data',
    'create_partitions',
    'archive_partitions',
    'daily_cleanup'
  )),
  status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failed')),
  
  -- Results
  records_affected INTEGER NOT NULL DEFAULT 0,
  details JSONB,
  error_message TEXT,
  
  -- Timing
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL,
  duration_ms INTEGER NOT NULL,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para consultas comuns
CREATE INDEX IF NOT EXISTS idx_cleanup_logs_job_type ON cleanup_logs(job_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cleanup_logs_status ON cleanup_logs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cleanup_logs_created ON cleanup_logs(created_at DESC);

-- RLS para cleanup_logs (apenas admins podem visualizar)
ALTER TABLE cleanup_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view cleanup logs"
  ON cleanup_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE user_id = auth.uid()
      AND (is_super_admin = true OR role = 'admin')
    )
  );

CREATE POLICY "System can insert cleanup logs"
  ON cleanup_logs
  FOR INSERT
  WITH CHECK (true);

-- Function to get cleanup log summary
CREATE OR REPLACE FUNCTION get_cleanup_log_summary(days_back INTEGER DEFAULT 30)
RETURNS TABLE (
  job_type VARCHAR(50),
  total_executions BIGINT,
  successful_executions BIGINT,
  failed_executions BIGINT,
  total_records_affected BIGINT,
  avg_duration_ms NUMERIC,
  last_execution TIMESTAMPTZ,
  last_status VARCHAR(20)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cl.job_type,
    COUNT(*)::BIGINT as total_executions,
    COUNT(*) FILTER (WHERE cl.status = 'success')::BIGINT as successful_executions,
    COUNT(*) FILTER (WHERE cl.status = 'failed')::BIGINT as failed_executions,
    SUM(cl.records_affected)::BIGINT as total_records_affected,
    AVG(cl.duration_ms)::NUMERIC as avg_duration_ms,
    MAX(cl.created_at) as last_execution,
    (
      SELECT status 
      FROM cleanup_logs 
      WHERE job_type = cl.job_type 
      ORDER BY created_at DESC 
      LIMIT 1
    ) as last_status
  FROM cleanup_logs cl
  WHERE cl.created_at >= NOW() - (days_back || ' days')::INTERVAL
  GROUP BY cl.job_type
  ORDER BY cl.job_type;
END;
$$;

-- Function to get recent cleanup failures
CREATE OR REPLACE FUNCTION get_recent_cleanup_failures(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  id UUID,
  job_type VARCHAR(50),
  error_message TEXT,
  details JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cl.id,
    cl.job_type,
    cl.error_message,
    cl.details,
    cl.started_at,
    cl.completed_at,
    cl.duration_ms,
    cl.created_at
  FROM cleanup_logs cl
  WHERE cl.status = 'failed'
  ORDER BY cl.created_at DESC
  LIMIT limit_count;
END;
$$;

-- Function to cleanup old logs (keep last 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM cleanup_logs
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_cleanup_log_summary TO authenticated;
GRANT EXECUTE ON FUNCTION get_recent_cleanup_failures TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_logs TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE cleanup_logs IS 'Logs of cleanup job executions';
COMMENT ON COLUMN cleanup_logs.job_type IS 'Type of cleanup job executed';
COMMENT ON COLUMN cleanup_logs.status IS 'Execution status (success or failed)';
COMMENT ON COLUMN cleanup_logs.records_affected IS 'Number of records affected by the operation';
COMMENT ON COLUMN cleanup_logs.details IS 'Additional details about the execution (JSON)';
COMMENT ON COLUMN cleanup_logs.duration_ms IS 'Execution duration in milliseconds';

COMMENT ON FUNCTION get_cleanup_log_summary IS 'Get summary statistics of cleanup jobs';
COMMENT ON FUNCTION get_recent_cleanup_failures IS 'Get recent cleanup job failures';
COMMENT ON FUNCTION cleanup_old_logs IS 'Remove cleanup logs older than 90 days';

