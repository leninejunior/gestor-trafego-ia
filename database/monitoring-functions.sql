-- Funções para monitoramento de cache
-- Suporta requisitos 9.1, 9.2, 9.3, 9.4

-- Função para obter estatísticas de storage
CREATE OR REPLACE FUNCTION get_cache_storage_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_records', COUNT(*),
    'total_size_mb', ROUND(
      (pg_total_relation_size('campaign_insights_history')::numeric / 1024 / 1024)::numeric, 
      2
    ),
    'records_by_platform', json_build_object(
      'meta', COUNT(*) FILTER (WHERE platform = 'meta'),
      'google', COUNT(*) FILTER (WHERE platform = 'google')
    ),
    'oldest_record_date', MIN(date),
    'newest_record_date', MAX(date)
  )
  INTO result
  FROM campaign_insights_history;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter uso de cache por cliente
CREATE OR REPLACE FUNCTION get_client_cache_usage()
RETURNS TABLE (
  client_id UUID,
  client_name TEXT,
  organization_name TEXT,
  plan_name TEXT,
  total_records BIGINT,
  storage_mb NUMERIC,
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id AS client_id,
    c.name AS client_name,
    o.name AS organization_name,
    COALESCE(sp.name, 'Sem plano') AS plan_name,
    COUNT(cih.id) AS total_records,
    ROUND(
      (SUM(pg_column_size(cih.*))::numeric / 1024 / 1024)::numeric,
      2
    ) AS storage_mb,
    MAX(sc.last_sync_at) AS last_sync_at,
    COALESCE(MAX(sc.sync_status), 'pending') AS sync_status
  FROM clients c
  LEFT JOIN organizations o ON o.id = c.organization_id
  LEFT JOIN memberships m ON m.organization_id = o.id
  LEFT JOIN subscriptions sub ON sub.user_id = m.user_id AND sub.status = 'active'
  LEFT JOIN subscription_plans sp ON sp.id = sub.plan_id
  LEFT JOIN campaign_insights_history cih ON cih.client_id = c.id
  LEFT JOIN sync_configurations sc ON sc.client_id = c.id
  GROUP BY c.id, c.name, o.name, sp.name
  ORDER BY total_records DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para verificar alertas de storage
CREATE OR REPLACE FUNCTION check_storage_alerts()
RETURNS TABLE (
  alert_type TEXT,
  severity TEXT,
  message TEXT,
  client_id UUID,
  client_name TEXT,
  current_usage_mb NUMERIC,
  limit_mb NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH client_usage AS (
    SELECT 
      c.id,
      c.name,
      COUNT(cih.id) AS record_count,
      ROUND(
        (SUM(pg_column_size(cih.*))::numeric / 1024 / 1024)::numeric,
        2
      ) AS usage_mb
    FROM clients c
    LEFT JOIN campaign_insights_history cih ON cih.client_id = c.id
    GROUP BY c.id, c.name
  )
  SELECT 
    'storage'::TEXT AS alert_type,
    CASE 
      WHEN cu.usage_mb > 1000 THEN 'critical'
      WHEN cu.usage_mb > 800 THEN 'warning'
      ELSE 'info'
    END::TEXT AS severity,
    CASE 
      WHEN cu.usage_mb > 1000 THEN 'Storage crítico: acima de 1GB'
      WHEN cu.usage_mb > 800 THEN 'Storage alto: acima de 800MB'
      ELSE 'Storage normal'
    END::TEXT AS message,
    cu.id AS client_id,
    cu.name AS client_name,
    cu.usage_mb AS current_usage_mb,
    1024::NUMERIC AS limit_mb
  FROM client_usage cu
  WHERE cu.usage_mb > 800
  ORDER BY cu.usage_mb DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para verificar falhas consecutivas de sync
CREATE OR REPLACE FUNCTION check_sync_failures()
RETURNS TABLE (
  alert_type TEXT,
  severity TEXT,
  message TEXT,
  client_id UUID,
  client_name TEXT,
  consecutive_failures INT,
  last_failure_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  WITH recent_logs AS (
    SELECT 
      sc.client_id,
      c.name AS client_name,
      sl.status,
      sl.started_at,
      ROW_NUMBER() OVER (PARTITION BY sc.client_id ORDER BY sl.started_at DESC) AS rn
    FROM sync_logs sl
    JOIN sync_configurations sc ON sc.id = sl.sync_config_id
    JOIN clients c ON c.id = sc.client_id
    WHERE sl.started_at > NOW() - INTERVAL '24 hours'
  ),
  failure_counts AS (
    SELECT 
      client_id,
      client_name,
      COUNT(*) FILTER (WHERE status = 'failed' AND rn <= 3) AS consecutive_failures,
      MAX(started_at) FILTER (WHERE status = 'failed') AS last_failure_at
    FROM recent_logs
    WHERE rn <= 3
    GROUP BY client_id, client_name
    HAVING COUNT(*) FILTER (WHERE status = 'failed' AND rn <= 3) >= 3
  )
  SELECT 
    'sync_failure'::TEXT AS alert_type,
    'critical'::TEXT AS severity,
    '3 ou mais falhas consecutivas de sincronização'::TEXT AS message,
    fc.client_id,
    fc.client_name,
    fc.consecutive_failures::INT,
    fc.last_failure_at
  FROM failure_counts fc
  ORDER BY fc.last_failure_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentários
COMMENT ON FUNCTION get_cache_storage_stats() IS 'Retorna estatísticas gerais de uso de storage do cache';
COMMENT ON FUNCTION get_client_cache_usage() IS 'Retorna uso de cache detalhado por cliente';
COMMENT ON FUNCTION check_storage_alerts() IS 'Verifica alertas de uso de storage por cliente';
COMMENT ON FUNCTION check_sync_failures() IS 'Verifica falhas consecutivas de sincronização';
