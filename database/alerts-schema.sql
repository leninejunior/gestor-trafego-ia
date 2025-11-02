-- Schema para sistema de alertas
-- Requirements 9.2, 9.3: Alertas para falhas, storage e performance

-- Tabela de alertas do sistema
CREATE TABLE IF NOT EXISTS system_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Tipo e severidade
  type VARCHAR(50) NOT NULL CHECK (type IN (
    'storage_limit',
    'sync_failure',
    'token_expired',
    'performance_degraded',
    'consecutive_failures'
  )),
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  
  -- Conteúdo
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Deduplicação
  dedupe_key VARCHAR(255) NOT NULL,
  
  -- Estado
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  
  -- Índices
  CONSTRAINT valid_acknowledgement CHECK (
    acknowledged_at IS NULL OR acknowledged_at >= created_at
  ),
  CONSTRAINT valid_resolution CHECK (
    resolved_at IS NULL OR resolved_at >= created_at
  )
);

-- Índices para performance
CREATE INDEX idx_alerts_type_severity ON system_alerts(type, severity);
CREATE INDEX idx_alerts_created_at ON system_alerts(created_at DESC);
CREATE INDEX idx_alerts_unresolved ON system_alerts(created_at DESC) 
  WHERE resolved_at IS NULL;
CREATE INDEX idx_alerts_severity_unresolved ON system_alerts(severity, created_at DESC) 
  WHERE resolved_at IS NULL;

-- Unique partial index for deduplication
CREATE UNIQUE INDEX idx_alerts_dedupe_unresolved ON system_alerts(dedupe_key) 
  WHERE resolved_at IS NULL;

-- Índice GIN para busca em metadata
CREATE INDEX idx_alerts_metadata ON system_alerts USING GIN (metadata);

-- Tabela de configuração de regras de alerta
CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Configuração
  type VARCHAR(50) NOT NULL UNIQUE CHECK (type IN (
    'storage_limit',
    'sync_failure',
    'token_expired',
    'performance_degraded',
    'consecutive_failures'
  )),
  enabled BOOLEAN NOT NULL DEFAULT true,
  threshold NUMERIC NOT NULL,
  check_interval_minutes INTEGER NOT NULL DEFAULT 60,
  
  -- Notificações
  notify_email BOOLEAN NOT NULL DEFAULT true,
  notify_slack BOOLEAN NOT NULL DEFAULT false,
  notify_webhook BOOLEAN NOT NULL DEFAULT false,
  
  -- Metadados
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_threshold CHECK (threshold > 0),
  CONSTRAINT valid_interval CHECK (check_interval_minutes > 0)
);

-- Inserir regras padrão
INSERT INTO alert_rules (type, threshold, check_interval_minutes) VALUES
  ('storage_limit', 80, 60),           -- 80% de uso, verificar a cada hora
  ('sync_failure', 3, 30),             -- 3 falhas consecutivas, verificar a cada 30min
  ('token_expired', 24, 120),          -- 24h antes de expirar, verificar a cada 2h
  ('performance_degraded', 300000, 60), -- 5min de duração média, verificar a cada hora
  ('consecutive_failures', 3, 30)      -- 3 falhas consecutivas, verificar a cada 30min
ON CONFLICT (type) DO NOTHING;

-- Tabela de histórico de notificações
CREATE TABLE IF NOT EXISTS alert_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_id UUID NOT NULL REFERENCES system_alerts(id) ON DELETE CASCADE,
  
  -- Canal de notificação
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('email', 'slack', 'webhook')),
  
  -- Destinatário
  recipient TEXT NOT NULL,
  
  -- Status
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  
  CONSTRAINT valid_sent_at CHECK (
    sent_at IS NULL OR sent_at >= created_at
  )
);

CREATE INDEX idx_notifications_alert ON alert_notifications(alert_id);
CREATE INDEX idx_notifications_status ON alert_notifications(status, created_at DESC);

-- RLS Policies
ALTER TABLE system_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_notifications ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ver e gerenciar alertas
CREATE POLICY "Admins can view all alerts"
  ON system_alerts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
  );

CREATE POLICY "Admins can manage alerts"
  ON system_alerts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
  );

CREATE POLICY "Admins can view alert rules"
  ON alert_rules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
  );

CREATE POLICY "Admins can manage alert rules"
  ON alert_rules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
  );

CREATE POLICY "Admins can view notifications"
  ON alert_notifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
  );

-- Função para auto-resolver alertas antigos
CREATE OR REPLACE FUNCTION auto_resolve_old_alerts()
RETURNS void AS $$
BEGIN
  -- Resolver alertas de storage que não são mais relevantes
  UPDATE system_alerts
  SET resolved_at = NOW()
  WHERE type = 'storage_limit'
    AND resolved_at IS NULL
    AND created_at < NOW() - INTERVAL '24 hours';
  
  -- Resolver alertas de performance que não são mais relevantes
  UPDATE system_alerts
  SET resolved_at = NOW()
  WHERE type = 'performance_degraded'
    AND resolved_at IS NULL
    AND created_at < NOW() - INTERVAL '48 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter resumo de alertas
CREATE OR REPLACE FUNCTION get_alerts_summary()
RETURNS TABLE (
  total_active INTEGER,
  critical_count INTEGER,
  warning_count INTEGER,
  info_count INTEGER,
  unacknowledged_count INTEGER,
  oldest_unresolved_age_hours NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER AS total_active,
    COUNT(*) FILTER (WHERE severity = 'critical')::INTEGER AS critical_count,
    COUNT(*) FILTER (WHERE severity = 'warning')::INTEGER AS warning_count,
    COUNT(*) FILTER (WHERE severity = 'info')::INTEGER AS info_count,
    COUNT(*) FILTER (WHERE acknowledged_at IS NULL)::INTEGER AS unacknowledged_count,
    ROUND(
      EXTRACT(EPOCH FROM (NOW() - MIN(created_at))) / 3600,
      1
    ) AS oldest_unresolved_age_hours
  FROM system_alerts
  WHERE resolved_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentários
COMMENT ON TABLE system_alerts IS 
'Armazena alertas do sistema de cache histórico para monitoramento';

COMMENT ON TABLE alert_rules IS 
'Configuração de regras de alerta e thresholds';

COMMENT ON TABLE alert_notifications IS 
'Histórico de notificações enviadas para alertas';

COMMENT ON FUNCTION auto_resolve_old_alerts() IS 
'Resolve automaticamente alertas antigos que não são mais relevantes';

COMMENT ON FUNCTION get_alerts_summary() IS 
'Retorna resumo de alertas ativos por severidade';
