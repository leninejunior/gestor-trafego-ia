-- ============================================
-- SISTEMA DE ALERTAS DE SALDO - VERSÃO FINAL
-- Compatível com estrutura: memberships + org_id
-- ============================================

-- 1. TABELA: ad_account_balances (cache de saldos)
CREATE TABLE IF NOT EXISTS ad_account_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  ad_account_id TEXT NOT NULL,
  ad_account_name TEXT,
  
  -- Saldo e limites
  balance DECIMAL(10,2) DEFAULT 0,
  spend_cap DECIMAL(10,2) DEFAULT 0,
  daily_spend_limit DECIMAL(10,2) DEFAULT 0,
  currency TEXT DEFAULT 'BRL',
  
  -- Métricas
  daily_spend DECIMAL(10,2) DEFAULT 0,
  projected_days_remaining INTEGER DEFAULT 0,
  status TEXT DEFAULT 'unknown' CHECK (status IN ('healthy', 'warning', 'critical', 'unknown')),
  
  -- Timestamps
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(client_id, ad_account_id)
);

-- 2. TABELA: balance_alerts (configuração de alertas)
CREATE TABLE IF NOT EXISTS balance_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  ad_account_id TEXT NOT NULL,
  
  -- Configuração
  threshold_amount DECIMAL(10,2) NOT NULL DEFAULT 100,
  alert_type TEXT NOT NULL DEFAULT 'low_balance' CHECK (alert_type IN ('low_balance', 'no_balance')),
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  last_alert_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(client_id, ad_account_id, alert_type)
);

-- 3. TABELA: alert_history (histórico)
CREATE TABLE IF NOT EXISTS alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID REFERENCES balance_alerts(id) ON DELETE CASCADE,
  
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  sent_via TEXT DEFAULT 'system',
  recipient TEXT,
  message TEXT,
  status TEXT DEFAULT 'sent',
  
  balance_at_send DECIMAL(10,2),
  threshold_at_send DECIMAL(10,2)
);

-- 4. ÍNDICES
CREATE INDEX IF NOT EXISTS idx_ad_account_balances_client ON ad_account_balances(client_id);
CREATE INDEX IF NOT EXISTS idx_ad_account_balances_status ON ad_account_balances(status);
CREATE INDEX IF NOT EXISTS idx_balance_alerts_client ON balance_alerts(client_id);
CREATE INDEX IF NOT EXISTS idx_balance_alerts_active ON balance_alerts(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_alert_history_alert ON alert_history(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_sent_at ON alert_history(sent_at DESC);

-- 5. RLS POLICIES
ALTER TABLE ad_account_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE balance_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;

-- Policy: ad_account_balances
DROP POLICY IF EXISTS "Users can view balances for their org clients" ON ad_account_balances;
CREATE POLICY "Users can view balances for their org clients"
  ON ad_account_balances FOR SELECT
  USING (
    client_id IN (
      SELECT c.id FROM clients c
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can manage balances for their org clients" ON ad_account_balances;
CREATE POLICY "Users can manage balances for their org clients"
  ON ad_account_balances FOR ALL
  USING (
    client_id IN (
      SELECT c.id FROM clients c
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

-- Policy: balance_alerts
DROP POLICY IF EXISTS "Users can view alerts for their org clients" ON balance_alerts;
CREATE POLICY "Users can view alerts for their org clients"
  ON balance_alerts FOR SELECT
  USING (
    client_id IN (
      SELECT c.id FROM clients c
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can manage alerts for their org clients" ON balance_alerts;
CREATE POLICY "Users can manage alerts for their org clients"
  ON balance_alerts FOR ALL
  USING (
    client_id IN (
      SELECT c.id FROM clients c
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin')
    )
  );

-- Policy: alert_history
DROP POLICY IF EXISTS "Users can view alert history for their org" ON alert_history;
CREATE POLICY "Users can view alert history for their org"
  ON alert_history FOR SELECT
  USING (
    alert_id IN (
      SELECT ba.id FROM balance_alerts ba
      JOIN clients c ON c.id = ba.client_id
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

-- 6. GRANTS
GRANT ALL ON ad_account_balances TO service_role;
GRANT ALL ON balance_alerts TO service_role;
GRANT ALL ON alert_history TO service_role;

GRANT SELECT ON ad_account_balances TO authenticated;
GRANT SELECT ON balance_alerts TO authenticated;
GRANT SELECT ON alert_history TO authenticated;

-- 7. VERIFICAÇÃO
SELECT 
  'Tables' as type,
  tablename as name
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('ad_account_balances', 'balance_alerts', 'alert_history')

UNION ALL

SELECT 
  'Indexes' as type,
  indexname as name
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('ad_account_balances', 'balance_alerts', 'alert_history')

ORDER BY type, name;

-- ============================================
-- FIM - Sistema pronto para uso!
-- ============================================
