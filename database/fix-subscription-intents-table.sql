-- Criar tabela subscription_intents que está faltando
-- Esta tabela é essencial para o fluxo de checkout funcionar

CREATE TABLE IF NOT EXISTS subscription_intents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  billing_cycle VARCHAR(10) NOT NULL CHECK (billing_cycle IN ('monthly', 'annual')),
  iugu_customer_id VARCHAR(255),
  iugu_plan_identifier VARCHAR(255),
  iugu_subscription_id VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'expired')),
  user_email VARCHAR(255) NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  organization_name VARCHAR(255) NOT NULL,
  cpf_cnpj VARCHAR(20),
  phone VARCHAR(20),
  user_id UUID REFERENCES auth.users(id), -- Preenchido após criar usuário
  metadata JSONB DEFAULT '{}',
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_subscription_intents_status ON subscription_intents(status);
CREATE INDEX IF NOT EXISTS idx_subscription_intents_email ON subscription_intents(user_email);
CREATE INDEX IF NOT EXISTS idx_subscription_intents_iugu_customer ON subscription_intents(iugu_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscription_intents_iugu_subscription ON subscription_intents(iugu_subscription_id);

-- RLS
ALTER TABLE subscription_intents ENABLE ROW LEVEL SECURITY;

-- Política: Apenas admins podem ver intents
CREATE POLICY "subscription_intents_admin_access" ON subscription_intents
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM memberships m
            WHERE m.user_id = auth.uid()
            AND m.role IN ('super_admin', 'admin')
        )
    );

-- Trigger para updated_at
CREATE TRIGGER update_subscription_intents_updated_at 
    BEFORE UPDATE ON subscription_intents 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Função para limpar intents expirados (executar via cron)
CREATE OR REPLACE FUNCTION cleanup_expired_subscription_intents()
RETURNS INTEGER AS $
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Marcar como expirados intents pendentes há mais de 7 dias
  UPDATE subscription_intents 
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'pending' 
  AND created_at < NOW() - INTERVAL '7 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE subscription_intents IS 'Armazena intenções de assinatura durante o processo de checkout antes da criação da conta';