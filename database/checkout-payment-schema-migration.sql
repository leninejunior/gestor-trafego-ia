-- =============================================
-- CHECKOUT PAYMENT FLOW SCHEMA MIGRATION
-- =============================================
-- Script completo para aplicar todas as correções críticas do schema
-- Executa as subtarefas 1.1, 1.2 e 1.3 da tarefa de correção do schema

-- Verificar se as extensões necessárias estão habilitadas
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- STEP 1: SUBSCRIPTION INTENTS TABLE
-- =============================================
\echo 'Creating subscription_intents table...'

-- Criar tabela subscription_intents
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

-- Índices para subscription_intents
CREATE INDEX IF NOT EXISTS idx_subscription_intents_status ON subscription_intents(status);
CREATE INDEX IF NOT EXISTS idx_subscription_intents_email ON subscription_intents(user_email);
CREATE INDEX IF NOT EXISTS idx_subscription_intents_plan_id ON subscription_intents(plan_id);
CREATE INDEX IF NOT EXISTS idx_subscription_intents_iugu_customer ON subscription_intents(iugu_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscription_intents_iugu_subscription ON subscription_intents(iugu_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_intents_user_id ON subscription_intents(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_intents_expires_at ON subscription_intents(expires_at);
CREATE INDEX IF NOT EXISTS idx_subscription_intents_created_at ON subscription_intents(created_at);
CREATE INDEX IF NOT EXISTS idx_subscription_intents_email_status ON subscription_intents(user_email, status);
CREATE INDEX IF NOT EXISTS idx_subscription_intents_cpf_status ON subscription_intents(cpf_cnpj, status) WHERE cpf_cnpj IS NOT NULL;

-- RLS para subscription_intents
ALTER TABLE subscription_intents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscription_intents_admin_access" ON subscription_intents;
CREATE POLICY "subscription_intents_admin_access" ON subscription_intents
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM memberships m
            WHERE m.user_id = auth.uid()
            AND m.role IN ('super_admin', 'admin')
        )
    );

DROP POLICY IF EXISTS "subscription_intents_user_own_access" ON subscription_intents;
CREATE POLICY "subscription_intents_user_own_access" ON subscription_intents
    FOR SELECT USING (
        user_email = (
            SELECT email FROM auth.users 
            WHERE id = auth.uid()
        )
    );

-- =============================================
-- STEP 2: WEBHOOK LOGS TABLE
-- =============================================
\echo 'Creating webhook_logs table...'

CREATE TABLE IF NOT EXISTS webhook_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Identificação do evento
    event_type VARCHAR(100) NOT NULL,
    event_id VARCHAR(255),
    
    -- Relacionamento com subscription intent
    subscription_intent_id UUID REFERENCES subscription_intents(id) ON DELETE SET NULL,
    
    -- Dados do webhook
    payload JSONB NOT NULL,
    headers JSONB DEFAULT '{}',
    
    -- Status de processamento
    status VARCHAR(20) NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processing', 'completed', 'failed', 'retrying')),
    
    -- Controle de processamento
    processed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    error_details JSONB,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 5,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadados adicionais
    provider VARCHAR(50) NOT NULL DEFAULT 'iugu',
    source_ip INET,
    user_agent TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para webhook_logs
CREATE INDEX IF NOT EXISTS idx_webhook_logs_event_type ON webhook_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_event_id ON webhook_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_subscription_intent ON webhook_logs(subscription_intent_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status ON webhook_logs(status);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_provider ON webhook_logs(provider);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON webhook_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_retry_count ON webhook_logs(retry_count);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_next_retry ON webhook_logs(next_retry_at) WHERE next_retry_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status_retry ON webhook_logs(status, retry_count);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_provider_status ON webhook_logs(provider, status);

-- RLS para webhook_logs
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "webhook_logs_admin_access" ON webhook_logs;
CREATE POLICY "webhook_logs_admin_access" ON webhook_logs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM memberships m
            WHERE m.user_id = auth.uid()
            AND m.role IN ('super_admin', 'admin')
        )
    );

-- =============================================
-- STEP 3: PAYMENT ANALYTICS TABLE
-- =============================================
\echo 'Creating payment_analytics table...'

CREATE TABLE IF NOT EXISTS payment_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Período de análise
    date DATE NOT NULL,
    plan_id UUID REFERENCES subscription_plans(id) ON DELETE CASCADE,
    
    -- Métricas de checkout
    checkouts_started INTEGER DEFAULT 0,
    checkouts_completed INTEGER DEFAULT 0,
    checkouts_abandoned INTEGER DEFAULT 0,
    
    -- Métricas de pagamento
    payments_confirmed INTEGER DEFAULT 0,
    payments_failed INTEGER DEFAULT 0,
    payments_pending INTEGER DEFAULT 0,
    
    -- Métricas financeiras
    revenue_total DECIMAL(10,2) DEFAULT 0,
    revenue_monthly DECIMAL(10,2) DEFAULT 0,
    revenue_annual DECIMAL(10,2) DEFAULT 0,
    
    -- Métricas de conversão
    conversion_rate DECIMAL(5,2) DEFAULT 0,
    average_time_to_complete INTEGER DEFAULT 0,
    
    -- Métricas de abandono
    abandonment_rate DECIMAL(5,2) DEFAULT 0,
    abandonment_stage JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraint para evitar duplicatas
    UNIQUE(date, plan_id)
);

-- Índices para payment_analytics
CREATE INDEX IF NOT EXISTS idx_payment_analytics_date ON payment_analytics(date);
CREATE INDEX IF NOT EXISTS idx_payment_analytics_plan_id ON payment_analytics(plan_id);
CREATE INDEX IF NOT EXISTS idx_payment_analytics_date_plan ON payment_analytics(date, plan_id);

-- RLS para payment_analytics
ALTER TABLE payment_analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_analytics_admin_access" ON payment_analytics;
CREATE POLICY "payment_analytics_admin_access" ON payment_analytics
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM memberships m
            WHERE m.user_id = auth.uid()
            AND m.role IN ('super_admin', 'admin')
        )
    );

-- =============================================
-- STEP 4: WEBHOOK RETRY QUEUE TABLE
-- =============================================
\echo 'Creating webhook_retry_queue table...'

CREATE TABLE IF NOT EXISTS webhook_retry_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webhook_log_id UUID NOT NULL REFERENCES webhook_logs(id) ON DELETE CASCADE,
    
    -- Configuração do retry
    retry_attempt INTEGER NOT NULL DEFAULT 1,
    scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Status da fila
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    
    -- Resultado do retry
    processed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para webhook_retry_queue
CREATE INDEX IF NOT EXISTS idx_webhook_retry_queue_webhook_log ON webhook_retry_queue(webhook_log_id);
CREATE INDEX IF NOT EXISTS idx_webhook_retry_queue_scheduled ON webhook_retry_queue(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_webhook_retry_queue_status ON webhook_retry_queue(status);

-- RLS para webhook_retry_queue
ALTER TABLE webhook_retry_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "webhook_retry_queue_service_access" ON webhook_retry_queue;
CREATE POLICY "webhook_retry_queue_service_access" ON webhook_retry_queue
    FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- STEP 5: TRIGGERS
-- =============================================
\echo 'Creating triggers...'

-- Trigger para updated_at (reutiliza função existente)
DROP TRIGGER IF EXISTS update_subscription_intents_updated_at ON subscription_intents;
CREATE TRIGGER update_subscription_intents_updated_at 
    BEFORE UPDATE ON subscription_intents 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_webhook_logs_updated_at ON webhook_logs;
CREATE TRIGGER update_webhook_logs_updated_at 
    BEFORE UPDATE ON webhook_logs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_payment_analytics_updated_at ON payment_analytics;
CREATE TRIGGER update_payment_analytics_updated_at 
    BEFORE UPDATE ON payment_analytics 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_webhook_retry_queue_updated_at ON webhook_retry_queue;
CREATE TRIGGER update_webhook_retry_queue_updated_at 
    BEFORE UPDATE ON webhook_retry_queue 
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

DROP TRIGGER IF EXISTS validate_subscription_intent_status_transition_trigger ON subscription_intents;
CREATE TRIGGER validate_subscription_intent_status_transition_trigger
    BEFORE UPDATE ON subscription_intents
    FOR EACH ROW EXECUTE FUNCTION validate_subscription_intent_status_transition();

-- Trigger para agendar retry automático
CREATE OR REPLACE FUNCTION schedule_webhook_retry()
RETURNS TRIGGER AS $
DECLARE
    retry_delay INTERVAL;
    max_retries_reached BOOLEAN;
BEGIN
    -- Só processar se mudou para status 'failed' e ainda tem tentativas
    IF NEW.status = 'failed' AND (OLD.status IS NULL OR OLD.status != 'failed') THEN
        max_retries_reached := NEW.retry_count >= NEW.max_retries;
        
        IF NOT max_retries_reached THEN
            -- Calcular delay exponencial: 2^retry_count minutos
            retry_delay := INTERVAL '1 minute' * POWER(2, NEW.retry_count);
            
            -- Limitar delay máximo a 1 hora
            IF retry_delay > INTERVAL '1 hour' THEN
                retry_delay := INTERVAL '1 hour';
            END IF;
            
            -- Definir próximo retry
            NEW.next_retry_at := NOW() + retry_delay;
            
            -- Adicionar à fila de retry
            INSERT INTO webhook_retry_queue (webhook_log_id, retry_attempt, scheduled_for)
            VALUES (NEW.id, NEW.retry_count + 1, NEW.next_retry_at);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS schedule_webhook_retry_trigger ON webhook_logs;
CREATE TRIGGER schedule_webhook_retry_trigger
    BEFORE UPDATE ON webhook_logs
    FOR EACH ROW EXECUTE FUNCTION schedule_webhook_retry();

-- =============================================
-- STEP 6: UTILITY FUNCTIONS
-- =============================================
\echo 'Creating utility functions...'

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

-- Função para atualizar status do intent
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

-- Função para limpeza de intents expirados
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

-- Função para registrar evento de webhook
CREATE OR REPLACE FUNCTION log_webhook_event(
    event_type_param VARCHAR(100),
    event_id_param VARCHAR(255),
    payload_param JSONB,
    provider_param VARCHAR(50) DEFAULT 'iugu',
    subscription_intent_id_param UUID DEFAULT NULL,
    headers_param JSONB DEFAULT NULL,
    source_ip_param INET DEFAULT NULL,
    user_agent_param TEXT DEFAULT NULL
)
RETURNS UUID AS $
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO webhook_logs (
        event_type,
        event_id,
        payload,
        provider,
        subscription_intent_id,
        headers,
        source_ip,
        user_agent
    ) VALUES (
        event_type_param,
        event_id_param,
        payload_param,
        provider_param,
        subscription_intent_id_param,
        COALESCE(headers_param, '{}'::jsonb),
        source_ip_param,
        user_agent_param
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para atualizar status de processamento do webhook
CREATE OR REPLACE FUNCTION update_webhook_processing_status(
    log_id_param UUID,
    new_status_param VARCHAR(20),
    error_message_param TEXT DEFAULT NULL,
    error_details_param JSONB DEFAULT NULL
)
RETURNS BOOLEAN AS $
BEGIN
    UPDATE webhook_logs
    SET 
        status = new_status_param,
        processed_at = CASE WHEN new_status_param IN ('completed', 'failed') THEN NOW() ELSE processed_at END,
        error_message = COALESCE(error_message_param, error_message),
        error_details = COALESCE(error_details_param, error_details),
        retry_count = CASE WHEN new_status_param = 'retrying' THEN retry_count + 1 ELSE retry_count END,
        updated_at = NOW()
    WHERE id = log_id_param;
    
    RETURN FOUND;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para limpeza de logs antigos
CREATE OR REPLACE FUNCTION cleanup_old_webhook_logs(
    retention_days INTEGER DEFAULT 90
)
RETURNS INTEGER AS $
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Deletar logs de webhook antigos
    DELETE FROM webhook_logs
    WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL
    AND status IN ('completed', 'failed')
    AND retry_count >= max_retries;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Limpar fila de retry para logs deletados
    DELETE FROM webhook_retry_queue
    WHERE webhook_log_id NOT IN (SELECT id FROM webhook_logs);
    
    RETURN deleted_count;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter webhooks pendentes de retry
CREATE OR REPLACE FUNCTION get_pending_webhook_retries(
    limit_param INTEGER DEFAULT 100
)
RETURNS TABLE (
    webhook_log_id UUID,
    event_type VARCHAR(100),
    payload JSONB,
    retry_attempt INTEGER,
    original_error TEXT
) AS $
BEGIN
    RETURN QUERY
    SELECT 
        wl.id,
        wl.event_type,
        wl.payload,
        wrq.retry_attempt,
        wl.error_message
    FROM webhook_retry_queue wrq
    JOIN webhook_logs wl ON wl.id = wrq.webhook_log_id
    WHERE wrq.status = 'pending'
    AND wrq.scheduled_for <= NOW()
    ORDER BY wrq.scheduled_for ASC
    LIMIT limit_param;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para atualizar analytics diárias
CREATE OR REPLACE FUNCTION update_daily_payment_analytics(
    target_date DATE DEFAULT CURRENT_DATE,
    target_plan_id UUID DEFAULT NULL
)
RETURNS INTEGER AS $
DECLARE
    updated_count INTEGER := 0;
    plan_record RECORD;
BEGIN
    -- Se plan_id específico foi fornecido, processar apenas ele
    IF target_plan_id IS NOT NULL THEN
        PERFORM update_analytics_for_plan(target_date, target_plan_id);
        updated_count := 1;
    ELSE
        -- Processar todos os planos
        FOR plan_record IN SELECT id FROM subscription_plans WHERE is_active = true LOOP
            PERFORM update_analytics_for_plan(target_date, plan_record.id);
            updated_count := updated_count + 1;
        END LOOP;
    END IF;
    
    RETURN updated_count;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função auxiliar para atualizar analytics de um plano específico
CREATE OR REPLACE FUNCTION update_analytics_for_plan(
    target_date DATE,
    target_plan_id UUID
)
RETURNS VOID AS $
DECLARE
    analytics_data RECORD;
BEGIN
    -- Calcular métricas para o dia e plano específicos
    SELECT 
        COUNT(CASE WHEN si.created_at::date = target_date THEN 1 END) as checkouts_started,
        COUNT(CASE WHEN si.completed_at::date = target_date THEN 1 END) as checkouts_completed,
        COUNT(CASE WHEN si.status = 'expired' AND si.created_at::date = target_date THEN 1 END) as checkouts_abandoned,
        COUNT(CASE WHEN si.status = 'completed' AND si.completed_at::date = target_date THEN 1 END) as payments_confirmed,
        COUNT(CASE WHEN si.status = 'failed' AND si.updated_at::date = target_date THEN 1 END) as payments_failed,
        COUNT(CASE WHEN si.status = 'pending' AND si.created_at::date = target_date THEN 1 END) as payments_pending,
        COALESCE(SUM(
            CASE 
                WHEN si.completed_at::date = target_date AND si.billing_cycle = 'monthly' THEN sp.monthly_price
                WHEN si.completed_at::date = target_date AND si.billing_cycle = 'annual' THEN sp.annual_price
                ELSE 0
            END
        ), 0) as revenue_total,
        COALESCE(SUM(
            CASE WHEN si.completed_at::date = target_date AND si.billing_cycle = 'monthly' THEN sp.monthly_price ELSE 0 END
        ), 0) as revenue_monthly,
        COALESCE(SUM(
            CASE WHEN si.completed_at::date = target_date AND si.billing_cycle = 'annual' THEN sp.annual_price ELSE 0 END
        ), 0) as revenue_annual,
        COALESCE(AVG(
            CASE 
                WHEN si.completed_at IS NOT NULL AND si.created_at::date = target_date 
                THEN EXTRACT(EPOCH FROM (si.completed_at - si.created_at))
                ELSE NULL
            END
        ), 0) as avg_completion_time
    INTO analytics_data
    FROM subscription_intents si
    JOIN subscription_plans sp ON sp.id = si.plan_id
    WHERE si.plan_id = target_plan_id
    AND (si.created_at::date = target_date OR si.completed_at::date = target_date OR si.updated_at::date = target_date);
    
    -- Inserir/atualizar analytics
    INSERT INTO payment_analytics (
        date,
        plan_id,
        checkouts_started,
        checkouts_completed,
        checkouts_abandoned,
        payments_confirmed,
        payments_failed,
        payments_pending,
        revenue_total,
        revenue_monthly,
        revenue_annual,
        conversion_rate,
        average_time_to_complete,
        abandonment_rate
    ) VALUES (
        target_date,
        target_plan_id,
        analytics_data.checkouts_started,
        analytics_data.checkouts_completed,
        analytics_data.checkouts_abandoned,
        analytics_data.payments_confirmed,
        analytics_data.payments_failed,
        analytics_data.payments_pending,
        analytics_data.revenue_total,
        analytics_data.revenue_monthly,
        analytics_data.revenue_annual,
        CASE 
            WHEN analytics_data.checkouts_started > 0 
            THEN ROUND((analytics_data.checkouts_completed::DECIMAL / analytics_data.checkouts_started * 100), 2)
            ELSE 0
        END,
        ROUND(analytics_data.avg_completion_time),
        CASE 
            WHEN analytics_data.checkouts_started > 0 
            THEN ROUND((analytics_data.checkouts_abandoned::DECIMAL / analytics_data.checkouts_started * 100), 2)
            ELSE 0
        END
    )
    ON CONFLICT (date, plan_id) 
    DO UPDATE SET
        checkouts_started = EXCLUDED.checkouts_started,
        checkouts_completed = EXCLUDED.checkouts_completed,
        checkouts_abandoned = EXCLUDED.checkouts_abandoned,
        payments_confirmed = EXCLUDED.payments_confirmed,
        payments_failed = EXCLUDED.payments_failed,
        payments_pending = EXCLUDED.payments_pending,
        revenue_total = EXCLUDED.revenue_total,
        revenue_monthly = EXCLUDED.revenue_monthly,
        revenue_annual = EXCLUDED.revenue_annual,
        conversion_rate = EXCLUDED.conversion_rate,
        average_time_to_complete = EXCLUDED.average_time_to_complete,
        abandonment_rate = EXCLUDED.abandonment_rate,
        updated_at = NOW();
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- STEP 7: GRANTS AND PERMISSIONS
-- =============================================
\echo 'Setting up permissions...'

-- Grant permissions to service role
GRANT ALL ON subscription_intents TO service_role;
GRANT ALL ON webhook_logs TO service_role;
GRANT ALL ON payment_analytics TO service_role;
GRANT ALL ON webhook_retry_queue TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Grant read permissions to authenticated users (via RLS)
GRANT SELECT ON subscription_intents TO authenticated;
GRANT SELECT ON payment_analytics TO authenticated;
GRANT EXECUTE ON FUNCTION create_subscription_intent TO authenticated;

-- =============================================
-- STEP 8: VALIDATION
-- =============================================
\echo 'Validating schema...'

-- Verificar se as tabelas foram criadas
DO $
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('subscription_intents', 'webhook_logs', 'payment_analytics', 'webhook_retry_queue');
    
    IF table_count != 4 THEN
        RAISE EXCEPTION 'Not all required tables were created. Expected 4, found %', table_count;
    END IF;
    
    RAISE NOTICE 'Schema validation passed: All % tables created successfully', table_count;
END;
$;

-- Verificar se as funções foram criadas
DO $
DECLARE
    function_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO function_count
    FROM information_schema.routines
    WHERE routine_schema = 'public'
    AND routine_name IN (
        'create_subscription_intent',
        'update_subscription_intent_status',
        'cleanup_expired_subscription_intents',
        'log_webhook_event',
        'update_webhook_processing_status',
        'cleanup_old_webhook_logs',
        'get_pending_webhook_retries',
        'update_daily_payment_analytics',
        'update_analytics_for_plan'
    );
    
    IF function_count < 9 THEN
        RAISE NOTICE 'Warning: Expected 9 functions, found %. Some functions may not have been created.', function_count;
    ELSE
        RAISE NOTICE 'Function validation passed: All % functions created successfully', function_count;
    END IF;
END;
$;

\echo 'Checkout Payment Flow Schema Migration completed successfully!'
\echo 'Tables created: subscription_intents, webhook_logs, payment_analytics, webhook_retry_queue'
\echo 'Functions created: 9 utility functions for managing the checkout flow'
\echo 'Indexes created: Performance indexes for all tables'
\echo 'RLS policies: Security policies applied to all tables'
\echo 'Triggers: Status validation and retry scheduling triggers'