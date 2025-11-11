-- ============================================
-- ALERTAS DE SALDO DE CONTAS DE ANÚNCIOS
-- Sistema simples para monitorar créditos das contas Meta Ads / Google Ads
-- ============================================

-- Tabela principal: alertas de saldo
CREATE TABLE IF NOT EXISTS ad_account_balance_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  
  -- Identificação da conta de anúncios
  ad_account_id TEXT NOT NULL,
  ad_account_name TEXT,
  platform TEXT NOT NULL CHECK (platform IN ('meta', 'google')),
  
  -- Configuração do alerta
  threshold_amount DECIMAL(10,2) NOT NULL CHECK (threshold_amount >= 0),
  alert_type TEXT NOT NULL CHECK (alert_type IN ('low_balance', 'no_balance')),
  
  -- Estado atual
  current_balance DECIMAL(10,2),
  currency TEXT DEFAULT 'BRL',
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  last_checked_at TIMESTAMPTZ,
  last_alert_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraint único
  UNIQUE(client_id, ad_account_id, alert_type)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_ad_balance_alerts_client ON ad_account_balance_alerts(client_id);
CREATE INDEX IF NOT EXISTS idx_ad_balance_alerts_active ON ad_account_balance_alerts(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_ad_balance_alerts_platform ON ad_account_balance_alerts(platform);

-- Histórico de alertas enviados
CREATE TABLE IF NOT EXISTS ad_balance_alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES ad_account_balance_alerts(id) ON DELETE CASCADE,
  
  -- Detalhes do envio
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  sent_via TEXT NOT NULL CHECK (sent_via IN ('whatsapp', 'email', 'push')),
  recipient TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'pending')) DEFAULT 'pending',
  
  -- Dados no momento do envio
  balance_at_send DECIMAL(10,2),
  threshold_at_send DECIMAL(10,2)
);

CREATE INDEX IF NOT EXISTS idx_ad_balance_history_alert ON ad_balance_alert_history(alert_id);
CREATE INDEX IF NOT EXISTS idx_ad_balance_history_sent_at ON ad_balance_alert_history(sent_at DESC);

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE ad_account_balance_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_balance_alert_history ENABLE ROW LEVEL SECURITY;

-- Policy: Usuários veem alertas dos seus clientes
CREATE POLICY "Users can view ad balance alerts for their clients"
  ON ad_account_balance_alerts FOR SELECT
  USING (
    client_id IN (
      SELECT c.id FROM clients c
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

-- Policy: Usuários podem gerenciar alertas dos seus clientes
CREATE POLICY "Users can manage ad balance alerts for their clients"
  ON ad_account_balance_alerts FOR ALL
  USING (
    client_id IN (
      SELECT c.id FROM clients c
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin')
    )
  );

-- Policy: Histórico de alertas
CREATE POLICY "Users can view ad balance alert history"
  ON ad_balance_alert_history FOR SELECT
  USING (
    alert_id IN (
      SELECT ba.id FROM ad_account_balance_alerts ba
      JOIN clients c ON c.id = ba.client_id
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

-- ============================================
-- FUNCTION & TRIGGER
-- ============================================

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_ad_balance_alerts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
DROP TRIGGER IF EXISTS update_ad_balance_alerts_updated_at_trigger ON ad_account_balance_alerts;
CREATE TRIGGER update_ad_balance_alerts_updated_at_trigger
  BEFORE UPDATE ON ad_account_balance_alerts
  FOR EACH ROW
  EXECUTE FUNCTION update_ad_balance_alerts_updated_at();

-- ============================================
-- GRANTS
-- ============================================

GRANT ALL ON ad_account_balance_alerts TO service_role;
GRANT ALL ON ad_balance_alert_history TO service_role;
GRANT SELECT ON ad_account_balance_alerts TO authenticated;
GRANT SELECT ON ad_balance_alert_history TO authenticated;

-- ============================================
-- COMENTÁRIOS
-- ============================================

COMMENT ON TABLE ad_account_balance_alerts IS 'Alertas de saldo (créditos) das contas de anúncios Meta/Google';
COMMENT ON TABLE ad_balance_alert_history IS 'Histórico de alertas de saldo enviados';
COMMENT ON COLUMN ad_account_balance_alerts.threshold_amount IS 'Valor mínimo de crédito antes de disparar alerta';
COMMENT ON COLUMN ad_account_balance_alerts.alert_type IS 'Tipo: low_balance (saldo baixo) ou no_balance (sem crédito)';
COMMENT ON COLUMN ad_account_balance_alerts.platform IS 'Plataforma: meta ou google';

-- ============================================
-- VERIFICAÇÃO
-- ============================================

SELECT 
  'Tables' as type,
  tablename as name
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('ad_account_balance_alerts', 'ad_balance_alert_history')

UNION ALL

SELECT 
  'Indexes' as type,
  indexname as name
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('ad_account_balance_alerts', 'ad_balance_alert_history')

ORDER BY type, name;
