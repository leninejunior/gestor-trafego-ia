-- =============================================
-- SUBSCRIPTION INTENTS SCHEMA
-- =============================================
-- Implementa a tabela subscription_intents conforme especificado no design document
-- Esta tabela é crítica para o fluxo de checkout e pagamentos

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- SUBSCRIPTION INTENTS TABLE
-- =============================================
-- Armazena intenções de assinatura durante o processo de checkout
CREATE TABLE IF NOT EXISTS subscription_intents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
    billing_cycle VARCHAR(10) NOT NULL CHECK (billing_cycle IN ('monthly', 'annual')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'expired')),
    
    -- Dados do usuário
    user_email VARCHAR(255) NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    organization_name VARCHAR(255) NOT NULL,
    cpf_cnpj VARCHAR(20),
    phone VARCHAR(20),
    
    -- Integração com Iugu
    iugu_customer_id VARCHAR(255),
    iugu_subscription_id VARCHAR(255),
    checkout_url TEXT,
    
    -- Referência ao usuário criado (preenchido após webhook)
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Metadados adicionais
    metadata JSONB DEFAULT '{}',
    
    -- Controle de expiração
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
    
    -- Timestamps de controle
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================
CREATE INDEX IF NOT EXISTS idx_subscription_intents_status ON subscription_intents(status);
CREATE INDEX IF NOT EXISTS idx_subscription_intents_email ON subscription_intents(user_email);
CREATE INDEX IF NOT EXISTS idx_subscription_intents_plan_id ON subscription_intents(plan_id);
CREATE INDEX IF NOT EXISTS idx_subscription_intents_iugu_customer ON subscription_intents(iugu_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscription_intents_iugu_subscription ON subscription_intents(iugu_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_intents_user_id ON subscription_intents(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_intents_expires_at ON subscription_intents(expires_at);
CREATE INDEX IF NOT EXISTS idx_subscription_intents_created_at ON subscription_intents(created_at);

-- Índice composto para consultas de status por email/CPF
CREATE INDEX IF NOT EXISTS idx_subscription_intents_email_status ON subscription_intents(user_email, status);
CREATE INDEX IF NOT EXISTS idx_subscription_intents_cpf_status ON subscription_intents(cpf_cnpj, status) WHERE cpf_cnpj IS NOT NULL;

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================
ALTER TABLE subscription_intents ENABLE ROW LEVEL SECURITY;

-- Política: Apenas admins e super_admins podem acessar subscription_intents
CREATE POLICY "subscription_intents_admin_access" ON subscription_intents
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM memberships m
            WHERE m.user_id = auth.uid()
            AND m.role IN ('super_admin', 'admin')
        )
    );

-- Política: Usuários podem consultar seus próprios intents por email (para página de status)
CREATE POLICY "subscription_intents_user_own_access" ON subscription_intents
    FOR SELECT USING (
        user_email = (
            SELECT email FROM auth.users 
            WHERE id = auth.uid()
        )
    );

-- =============================================
-- TRIGGERS
-- =============================================

-- Trigger para atualizar updated_at automaticamente
CREATE TRIGGER update_subscription_intents_updated_at 
    BEFORE UPDATE ON subscription_intents 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger para validar transições de estado
CREATE OR REPLACE FUNCTION validate_subscription_intent_status_transition()
RETURNS TRIGGER AS $
DECLARE
    valid_transition BOOLEAN := FALSE;
BEGIN
    -- Se é um INSERT, qualquer status inicial é válido
    IF TG_OP = 'INSERT' THEN
        RETURN NEW;
    END IF;
    
    -- Se o status não mudou, permitir
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;
    
    -- Validar transições válidas baseado na state machine do design
    CASE OLD.status
        WHEN 'pending' THEN
            valid_transition := NEW.status IN ('processing', 'expired', 'failed');
        WHEN 'processing' THEN
            valid_transition := NEW.status IN ('completed', 'failed', 'expired');
        WHEN 'failed' THEN
            valid_transition := NEW.status IN ('pending', 'expired');
        WHEN 'completed' THEN
            valid_transition := FALSE; -- Estado final
        WHEN 'expired' THEN
            valid_transition := FALSE; -- Estado final
    END CASE;
    
    IF NOT valid_transition THEN
        RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
    END IF;
    
    -- Se mudou para completed, definir completed_at
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        NEW.completed_at := NOW();
    END IF;
    
    RETURN NEW;
END;
$ LANGUAGE plpgsql;

CREATE TRIGGER validate_subscription_intent_status_transition_trigger
    BEFORE UPDATE ON subscription_intents
    FOR EACH ROW EXECUTE FUNCTION validate_subscription_intent_status_transition();

-- =============================================
-- UTILITY FUNCTIONS
-- =============================================

-- Função para limpar intents expirados (executar via cron)
CREATE OR REPLACE FUNCTION cleanup_expired_subscription_intents()
RETURNS INTEGER AS $
DECLARE
    expired_count INTEGER;
BEGIN
    -- Marcar como expirados intents pendentes que passaram do prazo
    UPDATE subscription_intents 
    SET status = 'expired', updated_at = NOW()
    WHERE status IN ('pending', 'processing')
    AND expires_at < NOW();
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    
    -- Log da operação
    INSERT INTO webhook_logs (event_type, payload, status, processed_at)
    VALUES (
        'cleanup.expired_intents',
        jsonb_build_object('expired_count', expired_count, 'timestamp', NOW()),
        'completed',
        NOW()
    );
    
    RETURN expired_count;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para buscar intent por email e CPF (para página de status público)
CREATE OR REPLACE FUNCTION get_subscription_intent_by_identifier(
    email_param VARCHAR(255),
    cpf_param VARCHAR(20) DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    status VARCHAR(20),
    plan_name VARCHAR(100),
    billing_cycle VARCHAR(10),
    created_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    checkout_url TEXT
) AS $
BEGIN
    RETURN QUERY
    SELECT 
        si.id,
        si.status,
        sp.name as plan_name,
        si.billing_cycle,
        si.created_at,
        si.expires_at,
        si.checkout_url
    FROM subscription_intents si
    JOIN subscription_plans sp ON sp.id = si.plan_id
    WHERE si.user_email = email_param
    AND (cpf_param IS NULL OR si.cpf_cnpj = cpf_param)
    AND si.status NOT IN ('expired')
    ORDER BY si.created_at DESC
    LIMIT 1;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para criar subscription intent
CREATE OR REPLACE FUNCTION create_subscription_intent(
    plan_id_param UUID,
    billing_cycle_param VARCHAR(10),
    user_email_param VARCHAR(255),
    user_name_param VARCHAR(255),
    organization_name_param VARCHAR(255),
    cpf_cnpj_param VARCHAR(20) DEFAULT NULL,
    phone_param VARCHAR(20) DEFAULT NULL,
    metadata_param JSONB DEFAULT '{}'
)
RETURNS UUID AS $
DECLARE
    new_intent_id UUID;
    plan_exists BOOLEAN;
BEGIN
    -- Verificar se o plano existe e está ativo
    SELECT EXISTS(
        SELECT 1 FROM subscription_plans 
        WHERE id = plan_id_param AND is_active = true
    ) INTO plan_exists;
    
    IF NOT plan_exists THEN
        RAISE EXCEPTION 'Invalid or inactive subscription plan';
    END IF;
    
    -- Validar billing_cycle
    IF billing_cycle_param NOT IN ('monthly', 'annual') THEN
        RAISE EXCEPTION 'Invalid billing cycle. Must be monthly or annual';
    END IF;
    
    -- Validar email
    IF user_email_param IS NULL OR user_email_param = '' THEN
        RAISE EXCEPTION 'Email is required';
    END IF;
    
    -- Criar o intent
    INSERT INTO subscription_intents (
        plan_id,
        billing_cycle,
        user_email,
        user_name,
        organization_name,
        cpf_cnpj,
        phone,
        metadata
    ) VALUES (
        plan_id_param,
        billing_cycle_param,
        user_email_param,
        user_name_param,
        organization_name_param,
        cpf_cnpj_param,
        phone_param,
        metadata_param
    ) RETURNING id INTO new_intent_id;
    
    RETURN new_intent_id;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para atualizar status do intent (usada pelos webhooks)
CREATE OR REPLACE FUNCTION update_subscription_intent_status(
    intent_id_param UUID,
    new_status_param VARCHAR(20),
    iugu_customer_id_param VARCHAR(255) DEFAULT NULL,
    iugu_subscription_id_param VARCHAR(255) DEFAULT NULL,
    user_id_param UUID DEFAULT NULL,
    metadata_update_param JSONB DEFAULT NULL
)
RETURNS BOOLEAN AS $
DECLARE
    intent_exists BOOLEAN;
    current_metadata JSONB;
BEGIN
    -- Verificar se o intent existe
    SELECT EXISTS(
        SELECT 1 FROM subscription_intents 
        WHERE id = intent_id_param
    ) INTO intent_exists;
    
    IF NOT intent_exists THEN
        RETURN FALSE;
    END IF;
    
    -- Obter metadata atual se precisar fazer merge
    IF metadata_update_param IS NOT NULL THEN
        SELECT metadata INTO current_metadata
        FROM subscription_intents
        WHERE id = intent_id_param;
        
        -- Fazer merge dos metadados
        metadata_update_param := COALESCE(current_metadata, '{}'::jsonb) || metadata_update_param;
    END IF;
    
    -- Atualizar o intent
    UPDATE subscription_intents
    SET 
        status = new_status_param,
        iugu_customer_id = COALESCE(iugu_customer_id_param, iugu_customer_id),
        iugu_subscription_id = COALESCE(iugu_subscription_id_param, iugu_subscription_id),
        user_id = COALESCE(user_id_param, user_id),
        metadata = COALESCE(metadata_update_param, metadata),
        updated_at = NOW()
    WHERE id = intent_id_param;
    
    RETURN TRUE;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- GRANTS AND PERMISSIONS
-- =============================================

-- Grant permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON subscription_intents TO authenticated;
GRANT EXECUTE ON FUNCTION get_subscription_intent_by_identifier TO authenticated;

-- Grant full permissions to service role (for API operations)
GRANT ALL ON subscription_intents TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- =============================================
-- COMMENTS
-- =============================================
COMMENT ON TABLE subscription_intents IS 'Armazena intenções de assinatura durante o processo de checkout antes da criação da conta do usuário';
COMMENT ON COLUMN subscription_intents.status IS 'Estado atual do intent: pending, processing, completed, failed, expired';
COMMENT ON COLUMN subscription_intents.expires_at IS 'Data de expiração do intent (padrão: 7 dias após criação)';
COMMENT ON COLUMN subscription_intents.metadata IS 'Dados adicionais em formato JSON para extensibilidade';
COMMENT ON FUNCTION cleanup_expired_subscription_intents() IS 'Função para limpeza automática de intents expirados (executar via cron)';
COMMENT ON FUNCTION create_subscription_intent IS 'Função para criar novo subscription intent com validações';
COMMENT ON FUNCTION update_subscription_intent_status IS 'Função para atualizar status do intent (usada pelos webhooks)';