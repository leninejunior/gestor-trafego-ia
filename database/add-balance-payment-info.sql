-- Adicionar campos de meio de pagamento e limite de gastos
-- na tabela ad_account_balances

-- Adicionar coluna para tipo de meio de pagamento
ALTER TABLE ad_account_balances 
ADD COLUMN IF NOT EXISTS funding_source_type INTEGER;

-- Adicionar coluna para descrição do meio de pagamento
ALTER TABLE ad_account_balances 
ADD COLUMN IF NOT EXISTS funding_source_display TEXT;

-- Adicionar coluna para limite de gastos (spend cap)
ALTER TABLE ad_account_balances 
ADD COLUMN IF NOT EXISTS spend_cap DECIMAL(15, 2);

-- Adicionar coluna para gasto total
ALTER TABLE ad_account_balances 
ADD COLUMN IF NOT EXISTS amount_spent DECIMAL(15, 2);

-- Adicionar comentários
COMMENT ON COLUMN ad_account_balances.funding_source_type IS 'Tipo de meio de pagamento do Meta Ads (ex: 20 = Saldo disponível)';
COMMENT ON COLUMN ad_account_balances.funding_source_display IS 'Descrição do meio de pagamento exibida pelo Meta';
COMMENT ON COLUMN ad_account_balances.spend_cap IS 'Limite de gastos configurado na conta';
COMMENT ON COLUMN ad_account_balances.amount_spent IS 'Total gasto na conta';
