-- Atualizar tabela subscription_intents para suportar checkout sem cadastro prévio

-- Adicionar novos campos
ALTER TABLE subscription_intents
ADD COLUMN IF NOT EXISTS user_email TEXT,
ADD COLUMN IF NOT EXISTS user_name TEXT,
ADD COLUMN IF NOT EXISTS organization_name TEXT,
ADD COLUMN IF NOT EXISTS cpf_cnpj TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Tornar organization_id opcional (pode ser NULL até criar a conta)
ALTER TABLE subscription_intents
ALTER COLUMN organization_id DROP NOT NULL;

-- Tornar user_id opcional (pode ser NULL até criar a conta)
ALTER TABLE subscription_intents
ALTER COLUMN user_id DROP NOT NULL;

-- Adicionar índice para buscar por email
CREATE INDEX IF NOT EXISTS idx_subscription_intents_user_email 
ON subscription_intents(user_email);

-- Adicionar índice para buscar por customer_id do Iugu
CREATE INDEX IF NOT EXISTS idx_subscription_intents_iugu_customer 
ON subscription_intents(iugu_customer_id);

-- Comentários
COMMENT ON COLUMN subscription_intents.user_email IS 'Email do usuário (antes de criar conta)';
COMMENT ON COLUMN subscription_intents.user_name IS 'Nome do usuário (antes de criar conta)';
COMMENT ON COLUMN subscription_intents.organization_name IS 'Nome da organização (antes de criar)';
COMMENT ON COLUMN subscription_intents.cpf_cnpj IS 'CPF/CNPJ do cliente';
COMMENT ON COLUMN subscription_intents.phone IS 'Telefone do cliente';
COMMENT ON COLUMN subscription_intents.metadata IS 'Dados adicionais em JSON';
