-- =============================================
-- WEBHOOK LOGS AND PAYMENT ANALYTICS SCHEMA
-- =============================================
-- Implementa tabelas de auditoria e analytics para o sistema de pagamentos
-- Conforme especificado no design document

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- WEBHOOK LOGS TABLE
-- =============================================
-- Armazena logs detalhados de todos os eventos de webhook processados
CREATE TABLE IF NOT EXISTS webhook_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Identificação do evento
    event_type VARCHAR(100) NOT NULL,
    event_id VARCHAR(255), -- ID único do evento do provedor (Iugu, Stripe, etc.)
    
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
    provider VARCHAR(50) NOT NULL DEFAULT 'iugu', -- iugu, stripe, etc.
    source_ip INET,
    user_agent TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- PAYMENT ANALYTICS TABLE
-- =============================================
-- Armazena métricas agregadas de pagamentos e conversão por período
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
    conversion_rate DECIMAL(5,2) DEFAULT 0, -- Percentual
    average_time_to_complete INTEGER DEFAULT 0, -- Em segundos
    
    -- Métricas de abandono
    abandonment_rate DECIMAL(5,2) DEFAULT 0, -- Percentual
    abandonment_stage JSONB DEFAULT '{}', -- Onde abandonaram mais
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraint para evitar duplicatas
    UNIQUE(date, plan_id)
);

-- =============================================
-- WEBHOOK RETRY QUEUE TABLE
-- =============================================
-- Fila para retry de webhooks que falharam
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

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Webhook Logs Indexes
CREATE INDEX IF NOT EXISTS idx_webhook_logs_event_type ON webhook_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_event_id ON webhook_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_subscription_intent ON webhook_logs(subscription_intent_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status ON webhook_logs(status);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_provider ON webhook_logs(provider);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON webhook_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_retry_count ON webhook_logs(retry_count);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_next_retry ON webhook_logs(next_retry_at) WHERE next_retry_at IS NOT NULL;

-- Índices compostos para consultas comuns
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status_retry ON webhook_logs(status, retry_count);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_provider_status ON webhook_logs(provider, status);

-- Payment Analytics Indexes
CREATE INDEX IF NOT EXISTS idx_payment_analytics_date ON payment_analytics(date);
CREATE INDEX IF NOT EXISTS idx_payment_analytics_plan_id ON payment_analytics(plan_id);
CREATE INDEX IF NOT EXISTS idx_payment_analytics_date_plan ON payment_analytics(date, plan_id);

-- Webhook Retry Queue Indexes
CREATE INDEX IF NOT EXISTS idx_webhook_retry_queue_webhook_log ON webhook_retry_queue(webhook_log_id);
CREATE INDEX IF NOT EXISTS idx_webhook_retry_queue_scheduled ON webhook_retry_queue(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_webhook_retry_queue_status ON webhook_retry_queue(status);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_retry_queue ENABLE ROW LEVEL SECURITY;

-- Política: Apenas admins podem acessar logs de webhook
CREATE POLICY "webhook_logs_admin_access" ON webhook_logs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM memberships m
            WHERE m.user_id = auth.uid()
            AND m.role IN ('super_admin', 'admin')
        )
    );

-- Política: Apenas admins podem acessar analytics de pagamento
CREATE POLICY "payment_analytics_admin_access" ON payment_analytics
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM memberships m
            WHERE m.user_id = auth.uid()
            AND m.role IN ('super_admin', 'admin')
        )
    );

-- Política: Apenas service role pode acessar retry queue
CREATE POLICY "webhook_retry_queue_service_access" ON webhook_retry_queue
    FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- TRIGGERS
-- =============================================

-- Trigger para atualizar updated_at
CREATE TRIGGER update_webhook_logs_updated_at 
    BEFORE UPDATE ON webhook_logs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_analytics_updated_at 
    BEFORE UPDATE ON payment_analytics 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_webhook_retry_queue_updated_at 
    BEFORE UPDATE ON webhook_retry_queue 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger para agendar retry automático quando webhook falha
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

CREATE TRIGGER schedule_webhook_retry_trigger
    BEFORE UPDATE ON webhook_logs
    FOR EACH ROW EXECUTE FUNCTION schedule_webhook_retry();

-- =============================================
-- UTILITY FUNCTIONS
-- =============================================

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
    
    -- Calcular taxas de conversão e abandono
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

-- Função para limpeza automática de dados antigos
CREATE OR REPLACE FUNCTION cleanup_old_webhook_logs(
    retention_days INTEGER DEFAULT 90
)
RETURNS INTEGER AS $
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Deletar logs de webhook antigos (manter apenas os últimos X dias)
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

-- =============================================
-- GRANTS AND PERMISSIONS
-- =============================================

-- Grant permissions to service role (for API operations)
GRANT ALL ON webhook_logs TO service_role;
GRANT ALL ON payment_analytics TO service_role;
GRANT ALL ON webhook_retry_queue TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Grant read permissions to authenticated users for analytics (via RLS)
GRANT SELECT ON payment_analytics TO authenticated;

-- =============================================
-- COMMENTS
-- =============================================
COMMENT ON TABLE webhook_logs IS 'Logs detalhados de todos os eventos de webhook processados pelo sistema';
COMMENT ON TABLE payment_analytics IS 'Métricas agregadas de pagamentos e conversão por período e plano';
COMMENT ON TABLE webhook_retry_queue IS 'Fila para retry automático de webhooks que falharam';

COMMENT ON COLUMN webhook_logs.retry_count IS 'Número de tentativas de reprocessamento do webhook';
COMMENT ON COLUMN webhook_logs.next_retry_at IS 'Timestamp para próxima tentativa de processamento';
COMMENT ON COLUMN payment_analytics.conversion_rate IS 'Taxa de conversão em percentual (checkouts completados / iniciados)';
COMMENT ON COLUMN payment_analytics.abandonment_rate IS 'Taxa de abandono em percentual (checkouts abandonados / iniciados)';

COMMENT ON FUNCTION log_webhook_event IS 'Registra novo evento de webhook no sistema de auditoria';
COMMENT ON FUNCTION update_webhook_processing_status IS 'Atualiza status de processamento de um webhook';
COMMENT ON FUNCTION update_daily_payment_analytics IS 'Atualiza métricas de analytics para um dia específico';
COMMENT ON FUNCTION cleanup_old_webhook_logs IS 'Remove logs antigos de webhook para manter performance';