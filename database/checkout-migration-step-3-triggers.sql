-- =====================================================
-- MIGRAÇÃO CHECKOUT - PASSO 3: TRIGGERS E AUTOMAÇÃO
-- =====================================================
-- Execute este SQL após o Passo 2
-- Cria triggers para automação e auditoria

-- FUNÇÃO: Atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- FUNÇÃO: Validar transições de status
CREATE OR REPLACE FUNCTION validate_status_transition()
RETURNS TRIGGER AS $$
BEGIN
    -- Validar transições válidas de status apenas se o status mudou
    IF OLD.status IS NOT NULL AND OLD.status != NEW.status THEN
        -- pending -> processing, failed, expired
        IF OLD.status = 'pending' AND NEW.status NOT IN ('processing', 'failed', 'expired') THEN
            RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
        END IF;
        
        -- processing -> completed, failed, expired
        IF OLD.status = 'processing' AND NEW.status NOT IN ('completed', 'failed', 'expired') THEN
            RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
        END IF;
        
        -- Estados finais não podem ser alterados (exceto para retry de failed)
        IF OLD.status IN ('completed', 'expired') THEN
            RAISE EXCEPTION 'Cannot change status from final state %', OLD.status;
        END IF;
        
        -- failed pode voltar para pending (retry)
        IF OLD.status = 'failed' AND NEW.status NOT IN ('pending', 'expired') THEN
            RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
        END IF;
    END IF;
    
    -- Definir completed_at quando status muda para completed
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        NEW.completed_at = NOW();
    END IF;
    
    -- Limpar completed_at se status não for completed
    IF NEW.status != 'completed' THEN
        NEW.completed_at = NULL;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- FUNÇÃO: Registrar transições de status automaticamente
CREATE OR REPLACE FUNCTION log_status_transition()
RETURNS TRIGGER AS $$
BEGIN
    -- Registrar transição apenas se o status mudou
    IF OLD.status IS NULL OR OLD.status != NEW.status THEN
        INSERT INTO subscription_intent_transitions (
            subscription_intent_id,
            from_status,
            to_status,
            reason,
            triggered_by,
            metadata
        ) VALUES (
            NEW.id,
            OLD.status,
            NEW.status,
            COALESCE(NEW.metadata->>'transition_reason', 'Status updated'),
            COALESCE(NEW.metadata->>'triggered_by', 'system'),
            jsonb_build_object(
                'timestamp', NOW(),
                'previous_metadata', COALESCE(OLD.metadata, '{}'::jsonb),
                'new_metadata', NEW.metadata,
                'ip_address', COALESCE(NEW.metadata->>'ip_address', 'unknown'),
                'user_agent', COALESCE(NEW.metadata->>'user_agent', 'unknown')
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- FUNÇÃO: Validar dados de entrada
CREATE OR REPLACE FUNCTION validate_subscription_intent_data()
RETURNS TRIGGER AS $$
BEGIN
    -- Validar email
    IF NEW.user_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        RAISE EXCEPTION 'Invalid email format: %', NEW.user_email;
    END IF;
    
    -- Validar CPF/CNPJ se fornecido
    IF NEW.cpf_cnpj IS NOT NULL THEN
        -- Remover caracteres não numéricos para validação
        NEW.cpf_cnpj = regexp_replace(NEW.cpf_cnpj, '[^0-9]', '', 'g');
        
        -- Validar tamanho (11 para CPF, 14 para CNPJ)
        IF length(NEW.cpf_cnpj) NOT IN (11, 14) THEN
            RAISE EXCEPTION 'CPF must have 11 digits or CNPJ must have 14 digits';
        END IF;
    END IF;
    
    -- Validar telefone se fornecido
    IF NEW.phone IS NOT NULL THEN
        -- Deve começar com + e ter entre 10 e 15 dígitos
        IF NEW.phone !~ '^\+[1-9][0-9]{9,14}$' THEN
            RAISE EXCEPTION 'Phone must be in international format (+country + number)';
        END IF;
    END IF;
    
    -- Validar nomes (não podem estar vazios)
    IF trim(NEW.user_name) = '' THEN
        RAISE EXCEPTION 'User name cannot be empty';
    END IF;
    
    IF trim(NEW.organization_name) = '' THEN
        RAISE EXCEPTION 'Organization name cannot be empty';
    END IF;
    
    -- Garantir que expires_at seja no futuro para novos registros
    IF TG_OP = 'INSERT' AND NEW.expires_at <= NOW() THEN
        NEW.expires_at = NOW() + INTERVAL '24 hours';
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- TRIGGERS PARA subscription_intents

-- Trigger para atualizar updated_at automaticamente
DROP TRIGGER IF EXISTS update_subscription_intents_updated_at ON subscription_intents;
CREATE TRIGGER update_subscription_intents_updated_at 
    BEFORE UPDATE ON subscription_intents 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger para validar transições de status
DROP TRIGGER IF EXISTS validate_subscription_intent_status_transition ON subscription_intents;
CREATE TRIGGER validate_subscription_intent_status_transition
    BEFORE UPDATE ON subscription_intents
    FOR EACH ROW 
    EXECUTE FUNCTION validate_status_transition();

-- Trigger para registrar transições de status
DROP TRIGGER IF EXISTS log_subscription_intent_transitions ON subscription_intents;
CREATE TRIGGER log_subscription_intent_transitions
    AFTER UPDATE ON subscription_intents
    FOR EACH ROW 
    EXECUTE FUNCTION log_status_transition();

-- Trigger para validar dados de entrada
DROP TRIGGER IF EXISTS validate_subscription_intent_data_trigger ON subscription_intents;
CREATE TRIGGER validate_subscription_intent_data_trigger
    BEFORE INSERT OR UPDATE ON subscription_intents
    FOR EACH ROW 
    EXECUTE FUNCTION validate_subscription_intent_data();

-- TRIGGERS PARA payment_analytics

-- Trigger para atualizar updated_at automaticamente
DROP TRIGGER IF EXISTS update_payment_analytics_updated_at ON payment_analytics;
CREATE TRIGGER update_payment_analytics_updated_at 
    BEFORE UPDATE ON payment_analytics 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- FUNÇÃO: Limpar registros expirados automaticamente
CREATE OR REPLACE FUNCTION cleanup_expired_records()
RETURNS TRIGGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    -- Marcar intents pendentes como expirados se passaram do prazo
    UPDATE subscription_intents 
    SET status = 'expired',
        metadata = metadata || jsonb_build_object(
            'auto_expired', true,
            'expired_at', NOW(),
            'original_expires_at', expires_at
        )
    WHERE status IN ('pending', 'processing')
      AND expires_at < NOW();
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    
    -- Log da operação se houver registros expirados
    IF expired_count > 0 THEN
        RAISE NOTICE 'Auto-expired % subscription intents', expired_count;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para limpeza automática (executado em inserções)
DROP TRIGGER IF EXISTS auto_cleanup_expired_intents ON subscription_intents;
CREATE TRIGGER auto_cleanup_expired_intents
    AFTER INSERT ON subscription_intents
    FOR EACH STATEMENT
    EXECUTE FUNCTION cleanup_expired_records();

-- Verificação dos triggers criados
SELECT 
    event_object_table as tabela,
    trigger_name,
    event_manipulation as evento,
    action_timing as timing
FROM information_schema.triggers 
WHERE event_object_table IN (
    'subscription_intents', 
    'payment_analytics'
)
AND trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;