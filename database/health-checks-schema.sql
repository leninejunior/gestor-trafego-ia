-- Health Checks Database Schema
-- Requirements: 8.3, 8.4 - Health checks e verificações de dependências externas

-- Tabela para agendamentos de health checks
CREATE TABLE IF NOT EXISTS health_check_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  endpoint VARCHAR(50) NOT NULL, -- 'full', 'quick', 'database', 'iugu', 'email', 'redis', 'checkout', 'monitoring'
  interval_minutes INTEGER NOT NULL CHECK (interval_minutes >= 1 AND interval_minutes <= 1440),
  enabled BOOLEAN NOT NULL DEFAULT true,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  max_failures_before_alert INTEGER NOT NULL DEFAULT 3,
  last_run TIMESTAMP WITH TIME ZONE,
  next_run TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela para logs de health checks
CREATE TABLE IF NOT EXISTS health_check_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id UUID NOT NULL REFERENCES health_check_schedules(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy')),
  response_time_ms INTEGER NOT NULL DEFAULT 0,
  details JSONB DEFAULT '{}',
  error_message TEXT,
  checked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Tabela para métricas do sistema (complementar aos health checks)
CREATE TABLE IF NOT EXISTS system_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  metric_type VARCHAR(50) NOT NULL, -- 'cpu', 'memory', 'disk', 'network', 'database', etc.
  metric_name VARCHAR(100) NOT NULL,
  metric_value DECIMAL(15,4) NOT NULL,
  metric_unit VARCHAR(20), -- 'percent', 'bytes', 'ms', 'count', etc.
  labels JSONB DEFAULT '{}', -- Para tags/labels adicionais
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Tabela para logs de aplicação (para observabilidade)
CREATE TABLE IF NOT EXISTS application_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  level VARCHAR(20) NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error', 'fatal')),
  message TEXT NOT NULL,
  component VARCHAR(100), -- 'checkout', 'webhook', 'auth', etc.
  user_id UUID REFERENCES auth.users(id),
  session_id VARCHAR(255),
  request_id VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_health_check_schedules_enabled_next_run 
ON health_check_schedules(enabled, next_run) WHERE enabled = true;

CREATE INDEX IF NOT EXISTS idx_health_check_schedules_name 
ON health_check_schedules(name);

CREATE INDEX IF NOT EXISTS idx_health_check_logs_schedule_id_checked_at 
ON health_check_logs(schedule_id, checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_health_check_logs_status_checked_at 
ON health_check_logs(status, checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_health_check_logs_checked_at 
ON health_check_logs(checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_metrics_type_recorded_at 
ON system_metrics(metric_type, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_metrics_name_recorded_at 
ON system_metrics(metric_name, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_metrics_recorded_at 
ON system_metrics(recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_application_logs_level_created_at 
ON application_logs(level, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_application_logs_component_created_at 
ON application_logs(component, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_application_logs_created_at 
ON application_logs(created_at DESC);

-- Trigger para atualizar updated_at em health_check_schedules
CREATE OR REPLACE FUNCTION update_health_check_schedules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_health_check_schedules_updated_at
  BEFORE UPDATE ON health_check_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_health_check_schedules_updated_at();

-- Função para limpeza automática de logs antigos
CREATE OR REPLACE FUNCTION cleanup_old_health_check_logs(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM health_check_logs 
  WHERE checked_at < NOW() - INTERVAL '1 day' * days_to_keep;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Função para limpeza automática de métricas antigas
CREATE OR REPLACE FUNCTION cleanup_old_system_metrics(days_to_keep INTEGER DEFAULT 7)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM system_metrics 
  WHERE recorded_at < NOW() - INTERVAL '1 day' * days_to_keep;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Função para limpeza automática de logs de aplicação
CREATE OR REPLACE FUNCTION cleanup_old_application_logs(days_to_keep INTEGER DEFAULT 14)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM application_logs 
  WHERE created_at < NOW() - INTERVAL '1 day' * days_to_keep;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Função para obter estatísticas de health checks
CREATE OR REPLACE FUNCTION get_health_check_statistics(hours_back INTEGER DEFAULT 24)
RETURNS TABLE (
  total_checks BIGINT,
  healthy_checks BIGINT,
  degraded_checks BIGINT,
  unhealthy_checks BIGINT,
  success_rate DECIMAL(5,2),
  avg_response_time_ms DECIMAL(10,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_checks,
    COUNT(*) FILTER (WHERE status = 'healthy') as healthy_checks,
    COUNT(*) FILTER (WHERE status = 'degraded') as degraded_checks,
    COUNT(*) FILTER (WHERE status = 'unhealthy') as unhealthy_checks,
    ROUND(
      (COUNT(*) FILTER (WHERE status IN ('healthy', 'degraded'))::DECIMAL / 
       NULLIF(COUNT(*), 0)) * 100, 2
    ) as success_rate,
    ROUND(AVG(response_time_ms), 2) as avg_response_time_ms
  FROM health_check_logs
  WHERE checked_at >= NOW() - INTERVAL '1 hour' * hours_back;
END;
$$ LANGUAGE plpgsql;

-- View para resumo de health checks por agendamento
CREATE OR REPLACE VIEW health_check_summary AS
SELECT 
  s.id,
  s.name,
  s.endpoint,
  s.enabled,
  s.interval_minutes,
  s.consecutive_failures,
  s.last_run,
  s.next_run,
  COALESCE(recent.total_checks, 0) as checks_24h,
  COALESCE(recent.healthy_checks, 0) as healthy_24h,
  COALESCE(recent.degraded_checks, 0) as degraded_24h,
  COALESCE(recent.unhealthy_checks, 0) as unhealthy_24h,
  COALESCE(recent.success_rate, 0) as success_rate_24h,
  COALESCE(recent.avg_response_time_ms, 0) as avg_response_time_24h,
  last_log.status as last_status,
  last_log.checked_at as last_check_time,
  last_log.error_message as last_error
FROM health_check_schedules s
LEFT JOIN (
  SELECT 
    schedule_id,
    COUNT(*) as total_checks,
    COUNT(*) FILTER (WHERE status = 'healthy') as healthy_checks,
    COUNT(*) FILTER (WHERE status = 'degraded') as degraded_checks,
    COUNT(*) FILTER (WHERE status = 'unhealthy') as unhealthy_checks,
    ROUND(
      (COUNT(*) FILTER (WHERE status IN ('healthy', 'degraded'))::DECIMAL / 
       NULLIF(COUNT(*), 0)) * 100, 2
    ) as success_rate,
    ROUND(AVG(response_time_ms), 2) as avg_response_time_ms
  FROM health_check_logs
  WHERE checked_at >= NOW() - INTERVAL '24 hours'
  GROUP BY schedule_id
) recent ON s.id = recent.schedule_id
LEFT JOIN LATERAL (
  SELECT status, checked_at, error_message
  FROM health_check_logs
  WHERE schedule_id = s.id
  ORDER BY checked_at DESC
  LIMIT 1
) last_log ON true;

-- RLS Policies (se necessário)
-- Como health checks são administrativos, vamos permitir acesso apenas para admins

-- Comentários para documentação
COMMENT ON TABLE health_check_schedules IS 'Agendamentos de health checks automáticos';
COMMENT ON TABLE health_check_logs IS 'Logs de execução de health checks';
COMMENT ON TABLE system_metrics IS 'Métricas do sistema para monitoramento';
COMMENT ON TABLE application_logs IS 'Logs da aplicação para observabilidade';

COMMENT ON COLUMN health_check_schedules.endpoint IS 'Tipo de health check: full, quick, database, iugu, email, redis, checkout, monitoring';
COMMENT ON COLUMN health_check_schedules.interval_minutes IS 'Intervalo entre execuções em minutos (1-1440)';
COMMENT ON COLUMN health_check_schedules.consecutive_failures IS 'Número de falhas consecutivas';
COMMENT ON COLUMN health_check_schedules.max_failures_before_alert IS 'Máximo de falhas antes de gerar alerta';

COMMENT ON COLUMN health_check_logs.status IS 'Status do health check: healthy, degraded, unhealthy';
COMMENT ON COLUMN health_check_logs.response_time_ms IS 'Tempo de resposta em milissegundos';
COMMENT ON COLUMN health_check_logs.details IS 'Detalhes adicionais do health check em JSON';

COMMENT ON COLUMN system_metrics.metric_type IS 'Tipo da métrica: cpu, memory, disk, network, database, etc.';
COMMENT ON COLUMN system_metrics.metric_unit IS 'Unidade da métrica: percent, bytes, ms, count, etc.';
COMMENT ON COLUMN system_metrics.labels IS 'Labels/tags adicionais em JSON';

COMMENT ON COLUMN application_logs.level IS 'Nível do log: debug, info, warn, error, fatal';
COMMENT ON COLUMN application_logs.component IS 'Componente que gerou o log: checkout, webhook, auth, etc.';