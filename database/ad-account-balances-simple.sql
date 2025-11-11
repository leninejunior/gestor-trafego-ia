-- Tabela Simples para Armazenar Saldos das Contas
-- SEM RLS - Acesso direto pelo admin

CREATE TABLE IF NOT EXISTS ad_account_balances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ad_account_id TEXT UNIQUE NOT NULL,
  ad_account_name TEXT,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  
  -- Dados de saldo
  currency TEXT DEFAULT 'BRL',
  balance DECIMAL(10,2) DEFAULT 0,
  daily_spend DECIMAL(10,2) DEFAULT 0,
  account_spend_limit DECIMAL(10,2) DEFAULT 0,
  
  -- Status
  status TEXT CHECK (status IN ('healthy', 'warning', 'critical')) DEFAULT 'healthy',
  
  -- Timestamps
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_ad_account_balances_status ON ad_account_balances(status);
CREATE INDEX IF NOT EXISTS idx_ad_account_balances_client ON ad_account_balances(client_id);
CREATE INDEX IF NOT EXISTS idx_ad_account_balances_checked ON ad_account_balances(last_checked_at);

-- SEM RLS - Acesso livre para admin
ALTER TABLE ad_account_balances DISABLE ROW LEVEL SECURITY;

-- Grants
GRANT ALL ON ad_account_balances TO service_role;
GRANT SELECT ON ad_account_balances TO authenticated;

-- View para estatísticas
CREATE OR REPLACE VIEW balance_statistics AS
SELECT 
  COUNT(*) as total_accounts,
  COUNT(*) FILTER (WHERE status = 'healthy') as healthy_accounts,
  COUNT(*) FILTER (WHERE status = 'warning') as warning_accounts,
  COUNT(*) FILTER (WHERE status = 'critical') as critical_accounts,
  SUM(balance) as total_balance,
  SUM(daily_spend) as total_daily_spend,
  MAX(last_checked_at) as last_check_time
FROM ad_account_balances;

COMMENT ON TABLE ad_account_balances IS 'Saldos das contas de anúncios - atualizado a cada 5 minutos';
