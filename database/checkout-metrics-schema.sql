-- Checkout and Payment Metrics Schema
-- Requirements: 4.3, 6.2 - Métricas detalhadas de checkout e pagamentos

-- Tabela para eventos de checkout
CREATE TABLE IF NOT EXISTS checkout_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type VARCHAR(50) NOT NULL, -- 'checkout_started', 'checkout_completed', 'checkout_abandoned'
  intent_id UUID REFERENCES subscription_intents(id),
  plan_id UUID REFERENCES subscription_plans(id),
  billing_cycle VARCHAR(20),
  user_email VARCHAR(255),
  organization_name VARCHAR(255),
  amount DECIMAL(10,2),
  duration_ms INTEGER,
  stage VARCHAR(50), -- Para abandono: 'form_fill', 'payment_processing', 'payment_failed'
  reason TEXT, -- Razão do abandono
  payment_method VARCHAR(50),
  session_id VARCHAR(255),
  referrer TEXT,
  user_agent TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela para métricas de webhook
CREATE TABLE IF NOT EXISTS webhook_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  intent_id UUID REFERENCES subscription_intents(id),
  status VARCHAR(20) NOT NULL, -- 'success', 'failed', 'retry'
  processing_time_ms INTEGER NOT NULL,
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela para métricas de criação de conta
CREATE TABLE IF NOT EXISTS account_creation_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  intent_id UUID REFERENCES subscription_intents(id),
  user_id UUID REFERENCES auth.users(id),
  organization_id UUID REFERENCES organizations(id),
  duration_ms INTEGER NOT NULL,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela para métricas de API
CREATE TABLE IF NOT EXISTS api_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  error_message TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela para métricas diárias agregadas
CREATE TABLE IF NOT EXISTS daily_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  plan_id VARCHAR(255) DEFAULT '',
  
  -- Métricas de checkout
  checkouts_started INTEGER DEFAULT 0,
  checkouts_completed INTEGER DEFAULT 0,
  checkouts_abandoned INTEGER DEFAULT 0,
  
  -- Métricas de pagamento
  webhooks_processed INTEGER DEFAULT 0,
  webhooks_failed INTEGER DEFAULT 0,
  accounts_created INTEGER DEFAULT 0,
  account_creation_failures INTEGER DEFAULT 0,
  
  -- Métricas de API
  api_requests INTEGER DEFAULT 0,
  api_errors INTEGER DEFAULT 0,
  
  -- Métricas de negócio
  revenue DECIMAL(12,2) DEFAULT 0,
  new_customers INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(date, plan_id)
);

-- Tabela para métricas de sistema
CREATE TABLE IF NOT EXISTS system_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  metric_name VARCHAR(100) NOT NULL,
  metric_value DECIMAL(15,4) NOT NULL,
  metric_unit VARCHAR(20),
  tags JSONB DEFAULT '{}',
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela para alertas do sistema
CREATE TABLE IF NOT EXISTS system_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_type VARCHAR(100) NOT NULL,
  severity VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'critical'
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_checkout_metrics_event_type ON checkout_metrics(event_type);
CREATE INDEX IF NOT EXISTS idx_checkout_metrics_timestamp ON checkout_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_checkout_metrics_plan_id ON checkout_metrics(plan_id);
CREATE INDEX IF NOT EXISTS idx_checkout_metrics_intent_id ON checkout_metrics(intent_id);

CREATE INDEX IF NOT EXISTS idx_webhook_metrics_status ON webhook_metrics(status);
CREATE INDEX IF NOT EXISTS idx_webhook_metrics_timestamp ON webhook_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_webhook_metrics_event_type ON webhook_metrics(event_type);

CREATE INDEX IF NOT EXISTS idx_account_creation_metrics_success ON account_creation_metrics(success);
CREATE INDEX IF NOT EXISTS idx_account_creation_metrics_timestamp ON account_creation_metrics(timestamp);

CREATE INDEX IF NOT EXISTS idx_api_metrics_endpoint ON api_metrics(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_metrics_status_code ON api_metrics(status_code);
CREATE INDEX IF NOT EXISTS idx_api_metrics_timestamp ON api_metrics(timestamp);

CREATE INDEX IF NOT EXISTS idx_daily_metrics_date ON daily_metrics(date);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_plan_id ON daily_metrics(plan_id);

CREATE INDEX IF NOT EXISTS idx_system_metrics_name ON system_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_system_metrics_recorded_at ON system_metrics(recorded_at);

CREATE INDEX IF NOT EXISTS idx_system_alerts_severity ON system_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_system_alerts_resolved ON system_alerts(is_resolved);
CREATE INDEX IF NOT EXISTS idx_system_alerts_created_at ON system_alerts(created_at);

-- Triggers para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_daily_metrics_updated_at 
  BEFORE UPDATE ON daily_metrics 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Função para limpeza automática de métricas antigas
CREATE OR REPLACE FUNCTION cleanup_old_metrics()
RETURNS void AS $$
BEGIN
  -- Manter apenas 90 dias de métricas detalhadas
  DELETE FROM checkout_metrics WHERE created_at < NOW() - INTERVAL '90 days';
  DELETE FROM webhook_metrics WHERE created_at < NOW() - INTERVAL '90 days';
  DELETE FROM account_creation_metrics WHERE created_at < NOW() - INTERVAL '90 days';
  DELETE FROM api_metrics WHERE created_at < NOW() - INTERVAL '90 days';
  DELETE FROM system_metrics WHERE recorded_at < NOW() - INTERVAL '90 days';
  
  -- Manter apenas 1 ano de métricas diárias
  DELETE FROM daily_metrics WHERE date < CURRENT_DATE - INTERVAL '1 year';
  
  -- Manter apenas alertas resolvidos dos últimos 30 dias
  DELETE FROM system_alerts 
  WHERE is_resolved = TRUE 
    AND resolved_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Função para calcular métricas de conversão
CREATE OR REPLACE FUNCTION calculate_conversion_metrics(
  start_date DATE,
  end_date DATE,
  plan_id_filter UUID DEFAULT NULL
)
RETURNS TABLE(
  plan_id UUID,
  plan_name VARCHAR,
  checkouts_started BIGINT,
  checkouts_completed BIGINT,
  conversion_rate DECIMAL,
  total_revenue DECIMAL,
  avg_order_value DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sp.id as plan_id,
    sp.name as plan_name,
    COALESCE(started.count, 0) as checkouts_started,
    COALESCE(completed.count, 0) as checkouts_completed,
    CASE 
      WHEN COALESCE(started.count, 0) > 0 
      THEN ROUND((COALESCE(completed.count, 0)::DECIMAL / started.count) * 100, 2)
      ELSE 0 
    END as conversion_rate,
    COALESCE(completed.revenue, 0) as total_revenue,
    CASE 
      WHEN COALESCE(completed.count, 0) > 0 
      THEN ROUND(COALESCE(completed.revenue, 0) / completed.count, 2)
      ELSE 0 
    END as avg_order_value
  FROM subscription_plans sp
  LEFT JOIN (
    SELECT 
      cm.plan_id,
      COUNT(*) as count
    FROM checkout_metrics cm
    WHERE cm.event_type = 'checkout_started'
      AND cm.timestamp::DATE BETWEEN start_date AND end_date
      AND (plan_id_filter IS NULL OR cm.plan_id = plan_id_filter)
    GROUP BY cm.plan_id
  ) started ON sp.id = started.plan_id
  LEFT JOIN (
    SELECT 
      cm.plan_id,
      COUNT(*) as count,
      SUM(cm.amount) as revenue
    FROM checkout_metrics cm
    WHERE cm.event_type = 'checkout_completed'
      AND cm.timestamp::DATE BETWEEN start_date AND end_date
      AND (plan_id_filter IS NULL OR cm.plan_id = plan_id_filter)
    GROUP BY cm.plan_id
  ) completed ON sp.id = completed.plan_id
  WHERE plan_id_filter IS NULL OR sp.id = plan_id_filter
  ORDER BY sp.name;
END;
$$ LANGUAGE plpgsql;

-- Função para obter métricas de performance de webhook
CREATE OR REPLACE FUNCTION get_webhook_performance_metrics(
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE(
  total_webhooks BIGINT,
  successful_webhooks BIGINT,
  failed_webhooks BIGINT,
  success_rate DECIMAL,
  avg_processing_time_ms DECIMAL,
  total_retries BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_webhooks,
    COUNT(*) FILTER (WHERE status = 'success') as successful_webhooks,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_webhooks,
    CASE 
      WHEN COUNT(*) > 0 
      THEN ROUND((COUNT(*) FILTER (WHERE status = 'success')::DECIMAL / COUNT(*)) * 100, 2)
      ELSE 0 
    END as success_rate,
    ROUND(AVG(processing_time_ms), 2) as avg_processing_time_ms,
    SUM(retry_count) as total_retries
  FROM webhook_metrics
  WHERE timestamp BETWEEN start_date AND end_date;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE checkout_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_creation_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_alerts ENABLE ROW LEVEL SECURITY;

-- Políticas para super admins (acesso total)
CREATE POLICY "Super admins can access all checkout metrics" ON checkout_metrics
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
        AND ur.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can access all webhook metrics" ON webhook_metrics
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
        AND ur.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can access all account creation metrics" ON account_creation_metrics
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
        AND ur.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can access all API metrics" ON api_metrics
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
        AND ur.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can access all daily metrics" ON daily_metrics
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
        AND ur.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can access all system metrics" ON system_metrics
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
        AND ur.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can access all system alerts" ON system_alerts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
        AND ur.role = 'super_admin'
    )
  );

-- Comentários para documentação
COMMENT ON TABLE checkout_metrics IS 'Métricas detalhadas de eventos de checkout';
COMMENT ON TABLE webhook_metrics IS 'Métricas de processamento de webhooks';
COMMENT ON TABLE account_creation_metrics IS 'Métricas de criação automática de contas';
COMMENT ON TABLE api_metrics IS 'Métricas de performance de APIs';
COMMENT ON TABLE daily_metrics IS 'Métricas diárias agregadas por plano';
COMMENT ON TABLE system_metrics IS 'Métricas de sistema e performance';
COMMENT ON TABLE system_alerts IS 'Alertas automáticos do sistema';

COMMENT ON FUNCTION cleanup_old_metrics() IS 'Função para limpeza automática de métricas antigas';
COMMENT ON FUNCTION calculate_conversion_metrics(DATE, DATE, UUID) IS 'Calcula métricas de conversão por plano';
COMMENT ON FUNCTION get_webhook_performance_metrics(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) IS 'Obtém métricas de performance de webhooks';