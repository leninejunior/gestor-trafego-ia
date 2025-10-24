-- Adicionar campos do Iugu na tabela subscriptions

-- Adicionar coluna para ID da assinatura no Iugu
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS iugu_subscription_id VARCHAR(255);

-- Adicionar coluna para ID do cliente no Iugu
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS iugu_customer_id VARCHAR(255);

-- Adicionar índices
CREATE INDEX IF NOT EXISTS idx_subscriptions_iugu_subscription ON subscriptions(iugu_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_iugu_customer ON subscriptions(iugu_customer_id);

-- Adicionar coluna para ID da fatura no Iugu na tabela subscription_invoices
ALTER TABLE subscription_invoices 
ADD COLUMN IF NOT EXISTS iugu_invoice_id VARCHAR(255);

-- Adicionar índice
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_iugu_invoice ON subscription_invoices(iugu_invoice_id);

-- Comentários
COMMENT ON COLUMN subscriptions.iugu_subscription_id IS 'ID da assinatura no Iugu';
COMMENT ON COLUMN subscriptions.iugu_customer_id IS 'ID do cliente no Iugu';
COMMENT ON COLUMN subscription_invoices.iugu_invoice_id IS 'ID da fatura no Iugu';
