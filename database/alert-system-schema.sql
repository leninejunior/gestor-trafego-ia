-- Alert System Schema
-- Requirements: 4.4, 8.3 - Sistema de alertas automáticos

-- Tabela para regras de alerta
CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  metric VARCHAR(100) NOT NULL,
  condition VARCHAR(20) NOT NULL CHECK (condition IN ('greater_than', 'less_than', 'equals', 'not_equals')),
  threshold DECIMAL(15,4) NOT NULL,
  time_window_minutes INTEGER NOT NULL DEFAULT 60,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  enabled BOOLEAN DEFAULT TRUE,
  notification_channels TEXT[] DEFAULT ARRAY['email'],
  cooldown_minutes INTEGER DEFAULT 30,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela para instâncias de alertas disparados
CREATE TABLE IF NOT EXISTS alert_instances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_id UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  severity VARCHAR(20) NOT NULL,
  metric_value DECIMAL(15,4) NOT NULL,
  threshold DECIMAL(15,4) NOT NULL,
  triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_by VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela para canais de notificação
CREATE TABLE IF NOT EXISTS alert_channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('email', 'webhook', 'slack', 'teams', 'sms')),
  config JSONB NOT NULL DEFAULT '{}',
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela para histórico de notificações enviadas
CREATE TABLE IF NOT EXISTS alert_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_instance_id UUID NOT NULL REFERENCES alert_instances(id) ON DELETE CASCADE,
  channel_type VARCHAR(20) NOT NULL,
  channel_config JSONB DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled ON alert_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_alert_rules_metric ON alert_rules(metric);
CREATE INDEX IF NOT EXISTS idx_alert_rules_severity ON alert_rules(severity);

CREATE INDEX IF NOT EXISTS idx_alert_instances_rule_id ON alert_instances(rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_instances_resolved ON alert_instances(is_resolved);
CREATE INDEX IF NOT EXISTS idx_alert_instances_triggered_at ON alert_instances(triggered_at);
CREATE INDEX IF NOT EXISTS idx_alert_instances_severity ON alert_instances(severity);

CREATE INDEX IF NOT EXISTS idx_alert_channels_type ON alert_channels(type);
CREATE INDEX IF NOT EXISTS idx_alert_channels_enabled ON alert_channels(enabled);

CREATE INDEX IF NOT EXISTS idx_alert_notifications_status ON alert_notifications(status);
CREATE INDEX IF NOT EXISTS idx_alert_notifications_sent_at ON alert_notifications(sent_at);

-- Triggers para updated_at
CREATE TRIGGER update_alert_rules_updated_at 
  BEFORE UPDATE ON alert_rules 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alert_channels_updated_at 
  BEFORE UPDATE ON alert_channels 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Função para limpeza automática de alertas antigos
CREATE OR REPLACE FUNCTION cleanup_old_alerts()
RETURNS void AS $$
BEGIN
  -- Manter apenas alertas resolvidos dos últimos 30 dias
  DELETE FROM alert_instances 
  WHERE is_resolved = TRUE 
    AND resolved_at < NOW() - INTERVAL '30 days';
  
  -- Manter apenas notificações dos últimos 7 dias
  DELETE FROM alert_notifications 
  WHERE created_at < NOW() - INTERVAL '7 days';
  
  -- Log da limpeza
  INSERT INTO system_events (event_type, metadata, severity)
  VALUES (
    'alert_cleanup_completed',
    jsonb_build_object(
      'cleaned_at', NOW(),
      'retention_days', 30
    ),
    'info'
  );
END;
$$ LANGUAGE plpgsql;

-- Função para obter estatísticas de alertas
CREATE OR REPLACE FUNCTION get_alert_statistics(
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '7 days',
  end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE(
  total_alerts BIGINT,
  critical_alerts BIGINT,
  high_alerts BIGINT,
  medium_alerts BIGINT,
  low_alerts BIGINT,
  resolved_alerts BIGINT,
  avg_resolution_time_hours DECIMAL,
  most_triggered_rule VARCHAR,
  most_triggered_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH alert_stats AS (
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE severity = 'critical') as critical,
      COUNT(*) FILTER (WHERE severity = 'high') as high,
      COUNT(*) FILTER (WHERE severity = 'medium') as medium,
      COUNT(*) FILTER (WHERE severity = 'low') as low,
      COUNT(*) FILTER (WHERE is_resolved = TRUE) as resolved,
      AVG(
        CASE 
          WHEN is_resolved = TRUE AND resolved_at IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (resolved_at - triggered_at)) / 3600 
          ELSE NULL 
        END
      ) as avg_resolution_hours
    FROM alert_instances
    WHERE triggered_at BETWEEN start_date AND end_date
  ),
  most_triggered AS (
    SELECT 
      ar.name,
      COUNT(*) as trigger_count
    FROM alert_instances ai
    JOIN alert_rules ar ON ai.rule_id = ar.id
    WHERE ai.triggered_at BETWEEN start_date AND end_date
    GROUP BY ar.name
    ORDER BY COUNT(*) DESC
    LIMIT 1
  )
  SELECT 
    s.total,
    s.critical,
    s.high,
    s.medium,
    s.low,
    s.resolved,
    ROUND(s.avg_resolution_hours, 2),
    COALESCE(mt.name, 'N/A'),
    COALESCE(mt.trigger_count, 0)
  FROM alert_stats s
  CROSS JOIN most_triggered mt;
END;
$$ LANGUAGE plpgsql;

-- Função para verificar saúde do sistema de alertas
CREATE OR REPLACE FUNCTION check_alert_system_health()
RETURNS TABLE(
  component VARCHAR,
  status VARCHAR,
  message TEXT,
  last_check TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'alert_rules'::VARCHAR as component,
    CASE 
      WHEN COUNT(*) > 0 THEN 'healthy'::VARCHAR
      ELSE 'warning'::VARCHAR
    END as status,
    CASE 
      WHEN COUNT(*) > 0 THEN 'Alert rules configured'::TEXT
      ELSE 'No alert rules configured'::TEXT
    END as message,
    NOW() as last_check
  FROM alert_rules
  WHERE enabled = TRUE
  
  UNION ALL
  
  SELECT 
    'recent_alerts'::VARCHAR as component,
    CASE 
      WHEN COUNT(*) FILTER (WHERE triggered_at > NOW() - INTERVAL '1 hour') < 10 
      THEN 'healthy'::VARCHAR
      ELSE 'warning'::VARCHAR
    END as status,
    CASE 
      WHEN COUNT(*) FILTER (WHERE triggered_at > NOW() - INTERVAL '1 hour') < 10 
      THEN 'Normal alert frequency'::TEXT
      ELSE 'High alert frequency detected'::TEXT
    END as message,
    NOW() as last_check
  FROM alert_instances
  
  UNION ALL
  
  SELECT 
    'unresolved_critical'::VARCHAR as component,
    CASE 
      WHEN COUNT(*) = 0 THEN 'healthy'::VARCHAR
      WHEN COUNT(*) < 5 THEN 'warning'::VARCHAR
      ELSE 'critical'::VARCHAR
    END as status,
    CASE 
      WHEN COUNT(*) = 0 THEN 'No unresolved critical alerts'::TEXT
      ELSE CONCAT(COUNT(*)::TEXT, ' unresolved critical alerts')::TEXT
    END as message,
    NOW() as last_check
  FROM alert_instances
  WHERE is_resolved = FALSE 
    AND severity = 'critical'
    AND triggered_at > NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Inserir canais de notificação padrão
INSERT INTO alert_channels (name, type, config, enabled) VALUES
  ('Default Email', 'email', '{"smtp_server": "default"}', TRUE),
  ('System Webhook', 'webhook', '{"url": ""}', FALSE),
  ('Slack Integration', 'slack', '{"webhook_url": ""}', FALSE),
  ('Teams Integration', 'teams', '{"webhook_url": ""}', FALSE)
ON CONFLICT (name) DO NOTHING;

-- RLS Policies
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_notifications ENABLE ROW LEVEL SECURITY;

-- Políticas para super admins (acesso total)
CREATE POLICY "Super admins can manage alert rules" ON alert_rules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
        AND ur.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can view alert instances" ON alert_instances
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
        AND ur.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can manage alert channels" ON alert_channels
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
        AND ur.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can view alert notifications" ON alert_notifications
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
        AND ur.role = 'super_admin'
    )
  );

-- Comentários para documentação
COMMENT ON TABLE alert_rules IS 'Regras de alerta configuráveis para monitoramento automático';
COMMENT ON TABLE alert_instances IS 'Instâncias de alertas disparados pelo sistema';
COMMENT ON TABLE alert_channels IS 'Canais de notificação disponíveis para alertas';
COMMENT ON TABLE alert_notifications IS 'Histórico de notificações enviadas';

COMMENT ON FUNCTION cleanup_old_alerts() IS 'Função para limpeza automática de alertas antigos';
COMMENT ON FUNCTION get_alert_statistics(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) IS 'Obtém estatísticas de alertas para período específico';
COMMENT ON FUNCTION check_alert_system_health() IS 'Verifica saúde do sistema de alertas';