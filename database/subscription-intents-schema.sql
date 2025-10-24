-- Tabela para armazenar intenções de assinatura durante o processo de checkout
-- Útil para rastrear checkouts iniciados mas não concluídos

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
    
    -- Dados adicionais
    organization_name VARCHAR(255),
    user_email VARCHAR(255),
    user_name VARCHAR(255),
    
    -- Status do intent
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'abandoned')),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadados adicionais
    metadata JSONB DEFAULT '{}'
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_subscription_intents_org_id ON subscription_intents(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscription_intents_user_id ON subscription_intents(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_intents_status ON subscription_intents(status);
CREATE INDEX IF NOT EXISTS idx_subscription_intents_iugu_customer ON subscription_intents(iugu_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscription_intents_iugu_subscription ON subscription_intents(iugu_subscription_id);

-- RLS
ALTER TABLE subscription_intents ENABLE ROW LEVEL SECURITY;

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
    );

-- Trigger para updated_at
CREATE TRIGGER update_subscription_intents_updated_at 
    BEFORE UPDATE ON subscription_intents 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE subscription_intents IS 'Armazena intenções de assinatura durante o processo de checkout';
COMMENT ON COLUMN subscription_intents.status IS 'Status: pending (iniciado), processing (em processamento), completed (concluído), failed (falhou), abandoned (abandonado)';
