-- Schema para Sistema de Alertas de Saldo e WhatsApp
-- Criado em: 2025-01-20

-- ============================================
-- TABELA: balance_alerts
-- Alertas de saldo para contas de anúncios
-- ============================================

CREATE TABLE IF NOT EXISTS balance_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  ad_account_id TEXT NOT NULL,
  ad_account_name TEXT,
  
  -- Configurações do alerta
  threshold_amount DECIMAL(10,2) NOT NULL CHECK (threshold_amount >= 0),
  alert_type TEXT NOT NULL CHECK (alert_type IN ('low_balance', 'no_balance', 'daily_limit', 'weekly_limit')),
  
  -- Estado atual
  current_balance DECIMAL(10,2),
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  last_checked_at TIMESTAMPTZ,
  last_alert_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Índices compostos
  UNIQUE(client_id, ad_account_id, alert_type)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_balance_alerts_client ON balance_alerts(client_id);
CREATE INDEX IF NOT EXISTS idx_balance_alerts_active ON balance_alerts(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_balance_alerts_last_checked ON balance_alerts(last_checked_at);

-- ============================================
-- TABELA: whatsapp_config
-- Configuração da Evolution API por organização
-- ============================================

CREATE TABLE IF NOT EXISTS whatsapp_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Configurações da Evolution API
  evolution_api_url TEXT NOT NULL,
  evolution_api_key TEXT NOT NULL,
  instance_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  
  -- Configurações de envio
  is_active BOOLEAN DEFAULT true,
  send_to_admin BOOLEAN DEFAULT true,
  send_to_client BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_test_at TIMESTAMPTZ,
  
  -- Uma configuração por organização
  UNIQUE(organization_id)
);

-- Índice
CREATE INDEX IF NOT EXISTS idx_whatsapp_config_org ON whatsapp_config(organization_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_config_active ON whatsapp_config(is_active) WHERE is_active = true;

-- ============================================
-- TABELA: alert_history
-- Histórico de alertas enviados
-- ============================================

CREATE TABLE IF NOT EXISTS alert_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_id UUID NOT NULL REFERENCES balance_alerts(id) ON DELETE CASCADE,
  
  -- Detalhes do envio
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  sent_via TEXT NOT NULL CHECK (sent_via IN ('whatsapp', 'email', 'push', 'sms')),
  recipient TEXT NOT NULL,
  message TEXT NOT NULL,
  
  -- Status
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'pending', 'delivered')) DEFAULT 'pending',
  error_message TEXT,
  
  -- Dados do alerta no momento do envio
  balance_at_send DECIMAL(10,2),
  threshold_at_send DECIMAL(10,2)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_alert_history_alert ON alert_history(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_sent_at ON alert_history(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_history_status ON alert_history(status);

-- ============================================
-- TABELA: alert_recipients
-- Destinatários de alertas por cliente
-- ============================================

CREATE TABLE IF NOT EXISTS alert_recipients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  
  -- Dados do destinatário
  name TEXT NOT NULL,
  phone_number TEXT,
  email TEXT,
  
  -- Preferências
  receive_whatsapp BOOLEAN DEFAULT true,
  receive_email BOOLEAN DEFAULT false,
  receive_push BOOLEAN DEFAULT false,
  
  -- Tipos de alerta que deseja receber
  alert_types TEXT[] DEFAULT ARRAY['low_balance', 'no_balance', 'daily_limit'],
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Validações
  CHECK (phone_number IS NOT NULL OR email IS NOT NULL)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_alert_recipients_client ON alert_recipients(client_id);
CREATE INDEX IF NOT EXISTS idx_alert_recipients_active ON alert_recipients(is_active) WHERE is_active = true;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Habilitar RLS
ALTER TABLE balance_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_recipients ENABLE ROW LEVEL SECURITY;

-- Policy: balance_alerts
CREATE POLICY "Users can view balance alerts for their org clients"
  ON balance_alerts FOR SELECT
  USING (
    client_id IN (
      SELECT c.id FROM clients c
      JOIN organization_members om ON om.organization_id = c.organization_id
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage balance alerts for their org clients"
  ON balance_alerts FOR ALL
  USING (
    client_id IN (
      SELECT c.id FROM clients c
      JOIN organization_members om ON om.organization_id = c.organization_id
      WHERE om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

-- Policy: whatsapp_config
CREATE POLICY "Users can view whatsapp config for their org"
  ON whatsapp_config FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Only admins can manage whatsapp config"
  ON whatsapp_config FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Policy: alert_history
CREATE POLICY "Users can view alert history for their org"
  ON alert_history FOR SELECT
  USING (
    alert_id IN (
      SELECT ba.id FROM balance_alerts ba
      JOIN clients c ON c.id = ba.client_id
      JOIN organization_members om ON om.organization_id = c.organization_id
      WHERE om.user_id = auth.uid()
    )
  );

-- Policy: alert_recipients
CREATE POLICY "Users can view recipients for their org clients"
  ON alert_recipients FOR SELECT
  USING (
    client_id IN (
      SELECT c.id FROM clients c
      JOIN organization_members om ON om.organization_id = c.organization_id
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage recipients for their org clients"
  ON alert_recipients FOR ALL
  USING (
    client_id IN (
      SELECT c.id FROM clients c
      JOIN organization_members om ON om.organization_id = c.organization_id
      WHERE om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

-- ============================================
-- FUNCTIONS
-- ============================================

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER update_balance_alerts_updated_at
  BEFORE UPDATE ON balance_alerts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_whatsapp_config_updated_at
  BEFORE UPDATE ON whatsapp_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alert_recipients_updated_at
  BEFORE UPDATE ON alert_recipients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VIEWS
-- ============================================

-- View: Alertas ativos com informações do cliente
CREATE OR REPLACE VIEW active_balance_alerts AS
SELECT 
  ba.*,
  c.name as client_name,
  c.organization_id,
  o.name as organization_name,
  CASE 
    WHEN ba.current_balance IS NULL THEN 'unknown'
    WHEN ba.current_balance <= 0 THEN 'critical'
    WHEN ba.current_balance <= ba.threshold_amount THEN 'warning'
    ELSE 'ok'
  END as alert_status,
  EXTRACT(EPOCH FROM (NOW() - ba.last_alert_sent_at))/3600 as hours_since_last_alert
FROM balance_alerts ba
JOIN clients c ON c.id = ba.client_id
JOIN organizations o ON o.id = c.organization_id
WHERE ba.is_active = true;

-- View: Estatísticas de alertas por organização
CREATE OR REPLACE VIEW alert_statistics AS
SELECT 
  c.organization_id,
  o.name as organization_name,
  COUNT(DISTINCT ba.id) as total_alerts,
  COUNT(DISTINCT ba.id) FILTER (WHERE ba.is_active) as active_alerts,
  COUNT(DISTINCT ah.id) as total_sent,
  COUNT(DISTINCT ah.id) FILTER (WHERE ah.sent_at > NOW() - INTERVAL '24 hours') as sent_last_24h,
  COUNT(DISTINCT ah.id) FILTER (WHERE ah.status = 'failed') as failed_sends
FROM organizations o
LEFT JOIN clients c ON c.organization_id = o.id
LEFT JOIN balance_alerts ba ON ba.client_id = c.id
LEFT JOIN alert_history ah ON ah.alert_id = ba.id
GROUP BY c.organization_id, o.name;

-- ============================================
-- DADOS INICIAIS (OPCIONAL)
-- ============================================

-- Comentar se não quiser dados de exemplo
/*
INSERT INTO balance_alerts (client_id, ad_account_id, ad_account_name, threshold_amount, alert_type, current_balance)
SELECT 
  id,
  'act_123456789',
  'Conta de Exemplo',
  100.00,
  'low_balance',
  150.00
FROM clients
LIMIT 1;
*/

-- ============================================
-- COMENTÁRIOS
-- ============================================

COMMENT ON TABLE balance_alerts IS 'Alertas de saldo para contas de anúncios do Meta Ads';
COMMENT ON TABLE whatsapp_config IS 'Configuração da Evolution API para envio de alertas via WhatsApp';
COMMENT ON TABLE alert_history IS 'Histórico de todos os alertas enviados';
COMMENT ON TABLE alert_recipients IS 'Destinatários de alertas por cliente';

COMMENT ON COLUMN balance_alerts.threshold_amount IS 'Valor mínimo de saldo antes de disparar alerta';
COMMENT ON COLUMN balance_alerts.alert_type IS 'Tipo de alerta: low_balance, no_balance, daily_limit, weekly_limit';
COMMENT ON COLUMN whatsapp_config.evolution_api_key IS 'Chave de API da Evolution (deve ser criptografada na aplicação)';
COMMENT ON COLUMN alert_history.sent_via IS 'Canal de envio: whatsapp, email, push, sms';

-- ============================================
-- GRANTS (se necessário)
-- ============================================

-- Garantir que o service role pode acessar tudo
GRANT ALL ON balance_alerts TO service_role;
GRANT ALL ON whatsapp_config TO service_role;
GRANT ALL ON alert_history TO service_role;
GRANT ALL ON alert_recipients TO service_role;

-- Usuários autenticados podem ler (RLS controla o acesso)
GRANT SELECT ON balance_alerts TO authenticated;
GRANT SELECT ON whatsapp_config TO authenticated;
GRANT SELECT ON alert_history TO authenticated;
GRANT SELECT ON alert_recipients TO authenticated;

-- ============================================
-- FIM DO SCHEMA
-- ============================================

-- Verificar se tudo foi criado
SELECT 
  'Tables' as type,
  tablename as name
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('balance_alerts', 'whatsapp_config', 'alert_history', 'alert_recipients')

UNION ALL

SELECT 
  'Indexes' as type,
  indexname as name
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('balance_alerts', 'whatsapp_config', 'alert_history', 'alert_recipients')

UNION ALL

SELECT
  'Views' as type,
  viewname as name
FROM pg_views
WHERE schemaname = 'public'
AND viewname IN ('active_balance_alerts', 'alert_statistics')

ORDER BY type, name;
