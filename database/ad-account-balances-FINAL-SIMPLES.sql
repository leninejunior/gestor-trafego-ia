-- ============================================
-- SISTEMA DE SALDO DE CONTAS - SIMPLES
-- Para TODOS os usuários (não só admin)
-- ============================================

-- Tabela simples para armazenar saldo das contas
CREATE TABLE IF NOT EXISTS ad_account_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  ad_account_id TEXT NOT NULL,
  ad_account_name TEXT,
  platform TEXT NOT NULL CHECK (platform IN ('meta', 'google')),
  
  -- Saldo e limites
  balance DECIMAL(12,2) DEFAULT 0,
  currency TEXT DEFAULT 'BRL',
  spend_cap DECIMAL(12,2),
  daily_spend_limit DECIMAL(12,2),
  
  -- Gastos
  current_spend DECIMAL(12,2) DEFAULT 0,
  daily_spend DECIMAL(12,2) DEFAULT 0,
  
  -- Timestamps
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Índice único
  UNIQUE(client_id, ad_account_id, platform)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_ad_account_balances_client ON ad_account_balances(client_id);
CREATE INDEX IF NOT EXISTS idx_ad_account_balances_platform ON ad_account_balances(platform);
CREATE INDEX IF NOT EXISTS idx_ad_account_balances_updated ON ad_account_balances(last_updated);

-- ============================================
-- RLS POLICIES - Usuários veem suas contas
-- ============================================

ALTER TABLE ad_account_balances ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver saldos dos clientes da sua organização
CREATE POLICY "Users can view balances for their org clients"
  ON ad_account_balances FOR SELECT
  USING (
    client_id IN (
      SELECT c.id FROM clients c
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

-- Service role pode fazer tudo (para APIs)
CREATE POLICY "Service role can manage all balances"
  ON ad_account_balances FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- FUNCTION - Atualizar timestamp
-- ============================================

CREATE OR REPLACE FUNCTION update_ad_account_balance_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ad_account_balance_timestamp
  BEFORE UPDATE ON ad_account_balances
  FOR EACH ROW
  EXECUTE FUNCTION update_ad_account_balance_timestamp();

-- ============================================
-- VIEW - Saldos com status calculado
-- ============================================

CREATE OR REPLACE VIEW ad_account_balances_with_status AS
SELECT 
  ab.*,
  c.name as client_name,
  c.org_id as organization_id,
  
  -- Calcular percentual do saldo
  CASE 
    WHEN ab.spend_cap > 0 THEN (ab.balance / ab.spend_cap) * 100
    ELSE 100
  END as balance_percentage,
  
  -- Calcular dias restantes (estimativa)
  CASE 
    WHEN ab.daily_spend > 0 THEN ab.balance / ab.daily_spend
    ELSE 999
  END as estimated_days_remaining,
  
  -- Status do saldo
  CASE 
    WHEN ab.balance <= 0 THEN 'critical'
    WHEN ab.spend_cap > 0 AND (ab.balance / ab.spend_cap) < 0.2 THEN 'critical'
    WHEN ab.spend_cap > 0 AND (ab.balance / ab.spend_cap) < 0.4 THEN 'warning'
    WHEN ab.daily_spend > 0 AND (ab.balance / ab.daily_spend) < 3 THEN 'critical'
    WHEN ab.daily_spend > 0 AND (ab.balance / ab.daily_spend) < 7 THEN 'warning'
    ELSE 'healthy'
  END as status

FROM ad_account_balances ab
JOIN clients c ON c.id = ab.client_id;

-- ============================================
-- GRANTS
-- ============================================

GRANT ALL ON ad_account_balances TO service_role;
GRANT SELECT ON ad_account_balances TO authenticated;
GRANT SELECT ON ad_account_balances_with_status TO authenticated;

-- ============================================
-- COMENTÁRIOS
-- ============================================

COMMENT ON TABLE ad_account_balances IS 'Saldo das contas de anúncios (Meta e Google)';
COMMENT ON COLUMN ad_account_balances.balance IS 'Saldo atual da conta';
COMMENT ON COLUMN ad_account_balances.spend_cap IS 'Limite total de gasto da conta';
COMMENT ON COLUMN ad_account_balances.daily_spend_limit IS 'Limite de gasto diário';
COMMENT ON COLUMN ad_account_balances.current_spend IS 'Gasto total atual';
COMMENT ON COLUMN ad_account_balances.daily_spend IS 'Média de gasto diário (últimos 7 dias)';

-- ============================================
-- VERIFICAÇÃO
-- ============================================

SELECT 
  'Table' as type,
  'ad_account_balances' as name,
  'Created' as status
WHERE EXISTS (
  SELECT 1 FROM pg_tables 
  WHERE schemaname = 'public' 
  AND tablename = 'ad_account_balances'
);
