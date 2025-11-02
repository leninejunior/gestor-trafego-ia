-- =====================================================
-- Cleanup Service Database Functions
-- =====================================================
-- Functions to support automatic data cleanup and partition management

-- Function to check if a partition exists
CREATE OR REPLACE FUNCTION check_partition_exists(
  table_name TEXT,
  partition_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = partition_name
    AND c.relkind = 'r'
    AND n.nspname = 'public'
  );
END;
$$;

-- Function to list all partitions of a table
CREATE OR REPLACE FUNCTION list_partitions(parent_table TEXT)
RETURNS TABLE (
  partition_name TEXT,
  partition_schema TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.relname::TEXT as partition_name,
    n.nspname::TEXT as partition_schema
  FROM pg_inherits
  JOIN pg_class AS c ON (inhrelid = c.oid)
  JOIN pg_class AS p ON (inhparent = p.oid)
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE p.relname = parent_table
  AND n.nspname = 'public'
  ORDER BY c.relname;
END;
$$;

-- Function to execute dynamic SQL (admin only)
-- This is needed for creating/detaching partitions
CREATE OR REPLACE FUNCTION execute_sql(sql_query TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only allow admins to execute this function
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE user_id = auth.uid() 
    AND is_super_admin = true
  ) THEN
    RAISE EXCEPTION 'Only super admins can execute SQL';
  END IF;

  EXECUTE sql_query;
END;
$$;

-- Function to get partition size information
CREATE OR REPLACE FUNCTION get_partition_sizes(parent_table TEXT)
RETURNS TABLE (
  partition_name TEXT,
  total_size BIGINT,
  table_size BIGINT,
  indexes_size BIGINT,
  row_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.relname::TEXT as partition_name,
    pg_total_relation_size(c.oid) as total_size,
    pg_relation_size(c.oid) as table_size,
    pg_indexes_size(c.oid) as indexes_size,
    c.reltuples::BIGINT as row_count
  FROM pg_inherits
  JOIN pg_class AS c ON (inhrelid = c.oid)
  JOIN pg_class AS p ON (inhparent = p.oid)
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE p.relname = parent_table
  AND n.nspname = 'public'
  ORDER BY c.relname;
END;
$$;

-- Function to get cleanup statistics per client
CREATE OR REPLACE FUNCTION get_client_cleanup_stats(p_client_id UUID)
RETURNS TABLE (
  client_id UUID,
  total_records BIGINT,
  oldest_record_date DATE,
  newest_record_date DATE,
  retention_days INTEGER,
  expired_records_count BIGINT,
  cutoff_date DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_retention_days INTEGER;
  v_cutoff_date DATE;
BEGIN
  -- Get retention days for client's plan
  SELECT pl.data_retention_days INTO v_retention_days
  FROM clients c
  JOIN subscriptions s ON s.user_id = c.user_id AND s.status = 'active'
  JOIN plan_limits pl ON pl.plan_id = s.plan_id
  WHERE c.id = p_client_id
  LIMIT 1;

  -- If no plan found, use default
  IF v_retention_days IS NULL THEN
    v_retention_days := 90;
  END IF;

  -- Calculate cutoff date
  v_cutoff_date := CURRENT_DATE - v_retention_days;

  RETURN QUERY
  SELECT 
    p_client_id as client_id,
    COUNT(*)::BIGINT as total_records,
    MIN(cih.date) as oldest_record_date,
    MAX(cih.date) as newest_record_date,
    v_retention_days as retention_days,
    COUNT(*) FILTER (WHERE cih.date < v_cutoff_date)::BIGINT as expired_records_count,
    v_cutoff_date as cutoff_date
  FROM campaign_insights_history cih
  WHERE cih.client_id = p_client_id;
END;
$$;

-- Function to get overall cleanup statistics
CREATE OR REPLACE FUNCTION get_overall_cleanup_stats()
RETURNS TABLE (
  total_clients BIGINT,
  total_records BIGINT,
  total_size_bytes BIGINT,
  clients_with_expired_data BIGINT,
  total_expired_records BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH client_stats AS (
    SELECT 
      c.id as client_id,
      COUNT(cih.id) as record_count,
      pl.data_retention_days,
      COUNT(cih.id) FILTER (
        WHERE cih.date < CURRENT_DATE - COALESCE(pl.data_retention_days, 90)
      ) as expired_count
    FROM clients c
    LEFT JOIN campaign_insights_history cih ON cih.client_id = c.id
    LEFT JOIN subscriptions s ON s.user_id = c.user_id AND s.status = 'active'
    LEFT JOIN plan_limits pl ON pl.plan_id = s.plan_id
    GROUP BY c.id, pl.data_retention_days
  )
  SELECT 
    COUNT(DISTINCT client_id)::BIGINT as total_clients,
    SUM(record_count)::BIGINT as total_records,
    pg_total_relation_size('campaign_insights_history')::BIGINT as total_size_bytes,
    COUNT(DISTINCT client_id) FILTER (WHERE expired_count > 0)::BIGINT as clients_with_expired_data,
    SUM(expired_count)::BIGINT as total_expired_records
  FROM client_stats;
END;
$$;

-- Function to create next month's partition automatically
CREATE OR REPLACE FUNCTION create_next_month_partition()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next_month DATE;
  v_month_after DATE;
  v_partition_name TEXT;
  v_year TEXT;
  v_month TEXT;
BEGIN
  -- Calculate next month
  v_next_month := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month');
  v_month_after := v_next_month + INTERVAL '1 month';
  
  -- Format partition name
  v_year := TO_CHAR(v_next_month, 'YYYY');
  v_month := TO_CHAR(v_next_month, 'MM');
  v_partition_name := 'campaign_insights_history_' || v_year || '_' || v_month;
  
  -- Check if partition already exists
  IF check_partition_exists('campaign_insights_history', v_partition_name) THEN
    RETURN 'Partition ' || v_partition_name || ' already exists';
  END IF;
  
  -- Create partition
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF campaign_insights_history FOR VALUES FROM (%L) TO (%L)',
    v_partition_name,
    v_next_month,
    v_month_after
  );
  
  RETURN 'Created partition ' || v_partition_name;
END;
$$;

-- Grant execute permissions to authenticated users for read-only functions
GRANT EXECUTE ON FUNCTION check_partition_exists TO authenticated;
GRANT EXECUTE ON FUNCTION list_partitions TO authenticated;
GRANT EXECUTE ON FUNCTION get_partition_sizes TO authenticated;
GRANT EXECUTE ON FUNCTION get_client_cleanup_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_overall_cleanup_stats TO authenticated;

-- Only admins can execute SQL and create partitions
GRANT EXECUTE ON FUNCTION execute_sql TO authenticated;
GRANT EXECUTE ON FUNCTION create_next_month_partition TO authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION check_partition_exists IS 'Check if a partition exists for a given table';
COMMENT ON FUNCTION list_partitions IS 'List all partitions of a parent table';
COMMENT ON FUNCTION execute_sql IS 'Execute dynamic SQL (admin only)';
COMMENT ON FUNCTION get_partition_sizes IS 'Get size information for all partitions';
COMMENT ON FUNCTION get_client_cleanup_stats IS 'Get cleanup statistics for a specific client';
COMMENT ON FUNCTION get_overall_cleanup_stats IS 'Get overall cleanup statistics across all clients';
COMMENT ON FUNCTION create_next_month_partition IS 'Automatically create next month partition';

