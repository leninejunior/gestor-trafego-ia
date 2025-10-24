-- Criar tabela subscription_intents completa com todos os campos necessários

-- Criar tabela se não existir
CREATE TABLE IF NOT EXISTS subscription_intents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
    billing_cycle VARCHAR(10) NOT NULL CHECK (billing_cycle IN ('monthly', 'annual')),
    
    -- Dados do Iugu
    iugu_customer_id VARCHAR(255),
    iugu_plan_identifier VARCHAR(255),
    iugu_subscription_id VARCHAR(255),
    
    -- Dados do usuário (antes de criar conta)
    user_email TEXT,
    user_name TEXT,
    organization_name TEXT,
    cpf_cnpj TEXT,
    phone TEXT,
    
    -- Status do intent
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'abandoned')),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadados adicionais
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Adicionar novos campos se a tabela já existir
DO $$ 
BEGIN
    -- Adicionar user_email se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='subscription_intents' AND column_name='user_email') THEN
        ALTER TABLE subscription_intents ADD COLUMN user_email TEXT;
    END IF;
    
    -- Adicionar user_name se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='subscription_intents' AND column_name='user_name') THEN
        ALTER TABLE subscription_intents ADD COLUMN user_name TEXT;
    END IF;
    
    -- Adicionar organization_name se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='subscription_intents' AND column_name='organization_name') THEN
        ALTER TABLE subscription_intents ADD COLUMN organization_name TEXT;
    END IF;
    
    -- Adicionar cpf_cnpj se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='subscription_intents' AND column_name='cpf_cnpj') THEN
        ALTER TABLE subscription_intents ADD COLUMN cpf_cnpj TEXT;
    END IF;
    
    -- Adicionar phone se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='subscription_intents' AND column_name='phone') THEN
        ALTER TABLE subscription_intents ADD COLUMN phone TEXT;
    END IF;
    
    -- Adicionar metadata se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='subscription_intents' AND column_name='metadata') THEN
        ALTER TABLE subscription_intents ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- Tornar organization_id e user_id opcionais (podem ser NULL até criar a conta)
ALTER TABLE subscription_intents ALTER COLUMN organization_id DROP NOT NULL;
ALTER TABLE subscription_intents ALTER COLUMN user_id DROP NOT NULL;

-- Índices
CREATE INDEX IF NOT EXISTS idx_subscription_intents_org_id ON subscription_intents(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscription_intents_user_id ON subscription_intents(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_intents_status ON subscription_intents(status);
CREATE INDEX IF NOT EXISTS idx_subscription_intents_iugu_customer ON subscription_intents(iugu_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscription_intents_iugu_subscription ON subscription_intents(iugu_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_intents_user_email ON subscription_intents(user_email);

-- RLS
ALTER TABLE subscription_intents ENABLE ROW LEVEL SECURITY;

-- Drop política antiga se existir
DROP POLICY IF EXISTS "subscription_intents_user_access" ON subscription_intents;

-- Usuários podem ver seus próprios intents
CREATE POLICY "subscription_intents_user_access" ON subscription_intents
    FOR ALL USING (
        user_id = auth.uid()
        OR
        organization_id IN (
            SELECT m.organization_id 
            FROM memberships m 
            WHERE m.user_id = auth.uid()
        )
        OR
        user_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    );

-- Trigger para updated_at (criar função se não existir)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger se não existir
DROP TRIGGER IF EXISTS update_subscription_intents_updated_at ON subscription_intents;
CREATE TRIGGER update_subscription_intents_updated_at 
    BEFORE UPDATE ON subscription_intents 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE subscription_intents IS 'Armazena intenções de assinatura durante o processo de checkout';
COMMENT ON COLUMN subscription_intents.status IS 'Status: pending (iniciado), processing (em processamento), completed (concluído), failed (falhou), abandoned (abandonado)';
COMMENT ON COLUMN subscription_intents.user_email IS 'Email do usuário (antes de criar conta)';
COMMENT ON COLUMN subscription_intents.user_name IS 'Nome do usuário (antes de criar conta)';
COMMENT ON COLUMN subscription_intents.organization_name IS 'Nome da organização (antes de criar)';
COMMENT ON COLUMN subscription_intents.cpf_cnpj IS 'CPF/CNPJ do cliente';
COMMENT ON COLUMN subscription_intents.phone IS 'Telefone do cliente';
COMMENT ON COLUMN subscription_intents.metadata IS 'Dados adicionais em JSON';
