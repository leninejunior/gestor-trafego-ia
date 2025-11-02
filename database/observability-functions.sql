-- Funções de observabilidade para métricas do sistema de cache histórico
-- Requirement 9.1: Fornecer métricas de uso por cliente e plano

-- Função para obter métricas de storage por cliente
CREATE OR REPLACE FUNCTION get_storage_metrics_by_client()
RETURNS TABLE (
  client_id UUID,
  client_name TEXT,
  total_records BIGINT,
  storage_mb NUMERIC,
  oldest_record_date DATE,
  newest_record_date DATE,
  platforms TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id AS client_id,
    c.name AS client_name,
    COUNT(cih.id) AS total_records,
    ROUND(
      (pg_total_relation_size('campaign_insights_history')::NUMERIC / 1024 / 1024) * 
      (COUNT(cih.id)::NUMERIC / NULLIF((SELECT COUNT(*) FROM campaign_insights_history), 0)),
      2
    ) AS storage_mb,
    MIN(cih.date) AS oldest_record_date,
    MAX(cih.date) AS newest_record_date,
    ARRAY_AGG(DISTINCT cih.platform) AS platforms
  FROM clients c
  LEFT JOIN campaign_insights_history cih ON cih.client_id = c.id
  GROUP BY c.id, c.name
  ORDER BY total_records DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter uso total de storage
CREATE OR REPLACE FUNCTION get_total_storage_usage()
RETURNS TABLE (
  total_storage_mb NUMERIC,
  total_records BIGINT,
  partitions_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ROUND(pg_total_relation_size('campaign_insights_history')::NUMERIC / 1024 / 1024, 2) AS total_storage_mb,
    COUNT(*)::BIGINT AS total_records,
    (
      SELECT COUNT(*)::INTEGER 
      FROM pg_inherits 
      WHERE inhparent = 'campaign_insights_history'::regclass
    ) AS partitions_count
  FROM campaign_insights_history;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter métricas de sync por período
CREATE OR REPLACE FUNCTION get_sync_metrics_summary(
  p_date_from TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_date_to TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  platform TEXT,
  total_syncs BIGINT,
  successful_syncs BIGINT,
  failed_syncs BIGINT,
  success_rate NUMERIC,
  avg_duration_ms NUMERIC,
  total_records_synced BIGINT,
  total_api_calls BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sc.platform::TEXT,
    COUNT(sl.id) AS total_syncs,
    COUNT(sl.id) FILTER (WHERE sl.status = 'completed') AS successful_syncs,
    COUNT(sl.id) FILTER (WHERE sl.status = 'failed') AS failed_syncs,
    ROUND(
      (COUNT(sl.id) FILTER (WHERE sl.status = 'completed')::NUMERIC / NULLIF(COUNT(sl.id), 0)) * 100,
      2
    ) AS success_rate,
    ROUND(AVG(sl.duration_ms), 0) AS avg_duration_ms,
    COALESCE(SUM(sl.records_synced), 0) AS total_records_synced,
    COALESCE(SUM(sl.api_calls_made), 0) AS total_api_calls
  FROM sync_configurations sc
  LEFT JOIN sync_logs sl ON sl.sync_config_id = sc.id
    AND sl.started_at >= p_date_from
    AND sl.started_at <= p_date_to
  GROUP BY sc.platform
  ORDER BY total_syncs DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter clientes com maior uso de storage
CREATE OR REPLACE FUNCTION get_top_storage_clients(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  client_id UUID,
  client_name TEXT,
  organization_name TEXT,
  total_records BIGINT,
  storage_mb NUMERIC,
  data_retention_days INTEGER,
  oldest_record_age_days INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id AS client_id,
    c.name AS client_name,
    o.name AS organization_name,
    COUNT(cih.id) AS total_records,
    ROUND(
      (pg_total_relation_size('campaign_insights_history')::NUMERIC / 1024 / 1024) * 
      (COUNT(cih.id)::NUMERIC / NULLIF((SELECT COUNT(*) FROM campaign_insights_history), 0)),
      2
    ) AS storage_mb,
    COALESCE(pl.data_retention_days, 90) AS data_retention_days,
    EXTRACT(DAY FROM NOW() - MIN(cih.date))::INTEGER AS oldest_record_age_days
  FROM clients c
  INNER JOIN organizations o ON o.id = c.organization_id
  LEFT JOIN memberships m ON m.organization_id = o.id
  LEFT JOIN subscriptions s ON s.user_id = m.user_id AND s.status = 'active'
  LEFT JOIN plan_limits pl ON pl.plan_id = s.plan_id
  LEFT JOIN campaign_insights_history cih ON cih.client_id = c.id
  GROUP BY c.id, c.name, o.name, pl.data_retention_days
  HAVING COUNT(cih.id) > 0
  ORDER BY total_records DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter estatísticas de falhas de sync
CREATE OR REPLACE FUNCTION get_sync_failure_stats(
  p_hours_back INTEGER DEFAULT 24
)
RETURNS TABLE (
  client_id UUID,
  client_name TEXT,
  platform TEXT,
  consecutive_failures INTEGER,
  last_failure_at TIMESTAMPTZ,
  last_error_message TEXT,
  total_failures_period BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH recent_failures AS (
    SELECT 
      sc.client_id,
      sc.platform,
      sl.started_at,
      sl.error_message,
      ROW_NUMBER() OVER (PARTITION BY sc.id ORDER BY sl.started_at DESC) as rn
    FROM sync_configurations sc
    INNER JOIN sync_logs sl ON sl.sync_config_id = sc.id
    WHERE sl.status = 'failed'
      AND sl.started_at >= NOW() - (p_hours_back || ' hours')::INTERVAL
  ),
  consecutive_calc AS (
    SELECT 
      sc.id as sync_config_id,
      sc.client_id,
      sc.platform,
      COUNT(*) as consecutive_failures,
      MAX(sl.started_at) as last_failure_at,
      (ARRAY_AGG(sl.error_message ORDER BY sl.started_at DESC))[1] as last_error_message
    FROM sync_configurations sc
    INNER JOIN sync_logs sl ON sl.sync_config_id = sc.id
    WHERE sl.status = 'failed'
      AND sl.started_at >= (
        SELECT COALESCE(MAX(started_at), NOW() - INTERVAL '1 year')
        FROM sync_logs 
        WHERE sync_config_id = sc.id AND status = 'completed'
      )
    GROUP BY sc.id, sc.client_id, sc.platform
  )
  SELECT 
    cc.client_id,
    c.name AS client_name,
    cc.platform::TEXT,
    cc.consecutive_failures::INTEGER,
    cc.last_failure_at,
    cc.last_error_message,
    COUNT(rf.client_id) AS total_failures_period
  FROM consecutive_calc cc
  INNER JOIN clients c ON c.id = cc.client_id
  LEFT JOIN recent_failures rf ON rf.client_id = cc.client_id AND rf.platform = cc.platform
  GROUP BY cc.client_id, c.name, cc.platform, cc.consecutive_failures, cc.last_failure_at, cc.last_error_message
  HAVING cc.consecutive_failures >= 3
  ORDER BY cc.consecutive_failures DESC, cc.last_failure_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter métricas de performance de queries
CREATE OR REPLACE FUNCTION get_query_performance_stats()
RETURNS TABLE (
  avg_query_time_ms NUMERIC,
  slow_queries_count BIGINT,
  total_queries_24h BIGINT,
  cache_hit_ratio NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - query_start)) * 1000), 2) AS avg_query_time_ms,
    COUNT(*) FILTER (WHERE EXTRACT(EPOCH FROM (NOW() - query_start)) > 2) AS slow_queries_count,
    COUNT(*) AS total_queries_24h,
    ROUND(
      (SUM(blks_hit)::NUMERIC / NULLIF(SUM(blks_hit + blks_read), 0)) * 100,
      2
    ) AS cache_hit_ratio
  FROM pg_stat_statements pss
  INNER JOIN pg_stat_database psd ON psd.datname = current_database()
  WHERE pss.query LIKE '%campaign_insights_history%'
    AND query_start >= NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentários para documentação
COMMENT ON FUNCTION get_storage_metrics_by_client() IS 
'Retorna métricas de uso de storage por cliente incluindo total de registros, tamanho em MB e período de dados';

COMMENT ON FUNCTION get_total_storage_usage() IS 
'Retorna uso total de storage do sistema de cache histórico';

COMMENT ON FUNCTION get_sync_metrics_summary(TIMESTAMPTZ, TIMESTAMPTZ) IS 
'Retorna resumo de métricas de sincronização por plataforma em um período específico';

COMMENT ON FUNCTION get_top_storage_clients(INTEGER) IS 
'Retorna os clientes com maior uso de storage, útil para identificar otimizações';

COMMENT ON FUNCTION get_sync_failure_stats(INTEGER) IS 
'Retorna estatísticas de falhas de sincronização, incluindo falhas consecutivas';

COMMENT ON FUNCTION get_query_performance_stats() IS 
'Retorna métricas de performance de queries no cache histórico';
