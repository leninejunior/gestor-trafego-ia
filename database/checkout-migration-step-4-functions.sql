-- =====================================================
-- MIGRAÇÃO CHECKOUT - PASSO 4: FUNÇÕES DO SISTEMA
-- =====================================================
-- Execute este SQL após o Passo 3
-- Cria funções para operações do sistema de checkout

-- FUNÇÃO: Criar subscription intent
CREATE OR REPLACE FUNCTION create_subscription_intent(
    plan_id_param UUID,
    billing_cycle_param VARCHAR(10),
    user_email_param VARCHAR(255),
    user_name_param VARCHAR(255),
    organization_name_param VARCHAR(255),
    cpf_cnpj_param VARCHAR(20) DEFAULT NULL,
    phone_param VARCHAR(20) DEFAULT NULL,
    metadata_param JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
    new_intent_id UUID;
BEGIN
    -- Validar se o plano existe (assumindo que existe uma tabela subscription_plans)
    IF NOT EXISTS (SELECT 1 FROM subscription_plans WHERE id = plan_id_param AND is_active = true) THEN
        RAISE EXCEPTION 'Plan not found or inactive: %', plan_id_param;
    END IF;
    
    -- Validar billing_cycle
    IF billing_cycle_param NOT IN ('monthly', 'annual') THEN
        RAISE EXCEPTION 'Invalid billing cycle: %. Must be monthly or annual', billing_cycle_param;
    END IF;
    
    -- Inserir nova intenção
    INSERT INTO subscription_intents (
        plan_id,
        billing_cycle,
        user_email,
        user_name,
        organization_name,
        cpf_cnpj,
        phone,
        metadata,
        status,
        expires_at
    ) VALUES (
        plan_id_param,
        billing_cycle_param,
        lower(trim(user_email_param)),
        trim(user_name_param),
        trim(organization_name_param),
        cpf_cnpj_param,
        phone_param,
        metadata_param || jsonb_build_object(
            'created_by', 'api',
            'created_at', NOW(),
            'ip_address', COALESCE(metadata_param->>'ip_address', 'unknown')
        ),
        'pending',
        NOW() + INTERVAL '24 hours'
    ) RETURNING id INTO new_intent_id;
    
    RETURN new_intent_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- FUNÇÃO: Atualizar status de subscription intent
CREATE OR REPLACE FUNCTION update_subscription_intent_status(
    intent_id_param UUID,
    new_status_param VARCHAR(20),
    iugu_customer_id_param VARCHAR(255) DEFAULT NULL,
    iugu_subscription_id_param VARCHAR(255) DEFAULT NULL,
    checkout_url_param TEXT DEFAULT NULL,
    metadata_update_param JSONB DEFAULT '{}'::jsonb
)
RETURNS BOOLEAN AS $$
DECLARE
    current_status VARCHAR(20);
    rows_affected INTEGER;
BEGIN
    -- Verificar se o intent existe e obter status atual
    SELECT status INTO current_status 
    FROM subscription_intents 
    WHERE id = intent_id_param;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Subscription intent not found: %', intent_id_param;
    END IF;
    
    -- Atualizar o intent
    UPDATE subscription_intents 
    SET 
        status = new_status_param,
        iugu_customer_id = COALESCE(iugu_customer_id_param, iugu_customer_id),
        iugu_subscription_id = COALESCE(iugu_subscription_id_param, iugu_subscription_id),
        checkout_url = COALESCE(checkout_url_param, checkout_url),
        metadata = metadata || metadata_update_param || jsonb_build_object(
            'status_updated_at', NOW(),
            'previous_status', current_status
        )
    WHERE id = intent_id_param;
    
    GET DIAGNOSTICS rows_affected = ROW_COUNT;
    
    RETURN rows_affected > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- FUNÇÃO: Registrar evento de webhook
CREATE OR REPLACE FUNCTION log_webhook_event(
    event_type_param VARCHAR(100),
    event_id_param VARCHAR(255),
    payload_param JSONB,
    provider_param VARCHAR(50) DEFAULT 'iugu',
    subscription_intent_id_param UUID DEFAULT NULL,
    headers_param JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
    new_log_id UUID;
    existing_log_id UUID;
BEGIN
    -- Verificar se já existe um log para este event_id (deduplicação)
    IF event_id_param IS NOT NULL THEN
        SELECT id INTO existing_log_id 
        FROM webhook_logs 
        WHERE event_id = event_id_param AND source = provider_param;
        
        IF FOUND THEN
            -- Atualizar log existente com nova tentativa
            UPDATE webhook_logs 
            SET 
                retry_count = retry_count + 1,
                payload = payload_param,
                headers = headers_param,
                metadata = metadata || jsonb_build_object(
                    'duplicate_received_at', NOW(),
                    'duplicate_count', COALESCE((metadata->>'duplicate_count')::integer, 0) + 1
                )
            WHERE id = existing_log_id;
            
            RETURN existing_log_id;
        END IF;
    END IF;
    
    -- Inserir novo log
    INSERT INTO webhook_logs (
        event_type,
        event_id,
        subscription_intent_id,
        payload,
        headers,
        source,
        status,
        metadata
    ) VALUES (
        event_type_param,
        event_id_param,
        subscription_intent_id_param,
        payload_param,
        headers_param,
        provider_param,
        'received',
        jsonb_build_object(
            'received_at', NOW(),
            'processed_by', 'webhook_processor'
        )
    ) RETURNING id INTO new_log_id;
    
    RETURN new_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- FUNÇÃO: Atualizar status de processamento de webhook
CREATE OR REPLACE FUNCTION update_webhook_processing_status(
    log_id_param UUID,
    new_status_param VARCHAR(20),
    error_message_param TEXT DEFAULT NULL,
    error_details_param JSONB DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    rows_affected INTEGER;
BEGIN
    UPDATE webhook_logs 
    SET 
        status = new_status_param,
        processed_at = CASE 
            WHEN new_status_param IN ('processed', 'failed', 'dead_letter') 
            THEN NOW() 
            ELSE processed_at 
        END,
        error_message = error_message_param,
        metadata = metadata || COALESCE(error_details_param, '{}'::jsonb) || jsonb_build_object(
            'status_updated_at', NOW(),
            'processing_duration_ms', 
            CASE 
                WHEN new_status_param IN ('processed', 'failed', 'dead_letter') 
                THEN EXTRACT(EPOCH FROM (NOW() - created_at)) * 1000
                ELSE NULL 
            END
        )
    WHERE id = log_id_param;
    
    GET DIAGNOSTICS rows_affected = ROW_COUNT;
    
    RETURN rows_affected > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- FUNÇÃO: Limpeza de subscription intents expirados
CREATE OR REPLACE FUNCTION cleanup_expired_subscription_intents(
    older_than_days INTEGER DEFAULT 30
)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
    expired_count INTEGER := 0;
BEGIN
    -- Primeiro, marcar intents pendentes como expirados
    UPDATE subscription_intents 
    SET status = 'expired',
        metadata = metadata || jsonb_build_object(
            'auto_expired', true,
            'expired_at', NOW(),
            'cleanup_run', true
        )
    WHERE status IN ('pending', 'processing')
      AND expires_at < NOW();
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    
    -- Depois, deletar intents expirados antigos
    DELETE FROM subscription_intents
    WHERE status = 'expired'
      AND created_at < NOW() - (older_than_days || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log da operação
    RAISE NOTICE 'Cleanup completed: % intents expired, % old intents deleted', expired_count, deleted_count;
    
    RETURN expired_count + deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- FUNÇÃO: Limpeza de webhook logs antigos
CREATE OR REPLACE FUNCTION cleanup_webhook_logs(
    older_than_days INTEGER DEFAULT 90
)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM webhook_logs
    WHERE created_at < NOW() - (older_than_days || ' days')::INTERVAL
      AND status IN ('processed', 'dead_letter');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RAISE NOTICE 'Webhook logs cleanup: % logs deleted', deleted_count;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- FUNÇÃO: Atualizar analytics diárias
CREATE OR REPLACE FUNCTION update_daily_payment_analytics(
    target_date DATE DEFAULT CURRENT_DATE,
    target_plan_id UUID DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    processed_plans INTEGER := 0;
    plan_record RECORD;
BEGIN
    -- Se target_plan_id for especificado, processar apenas esse plano
    IF target_plan_id IS NOT NULL THEN
        -- Processar plano específico
        INSERT INTO payment_analytics (
            date,
            plan_id,
            checkouts_started,
            checkouts_completed,
            payments_confirmed,
            payments_failed,
            revenue_total,
            revenue_monthly,
            revenue_annual,
            avg_completion_time_minutes
        )
        SELECT 
            target_date,
            target_plan_id,
            COUNT(*) as checkouts_started,
            COUNT(*) FILTER (WHERE status IN ('completed', 'processing')) as checkouts_completed,
            COUNT(*) FILTER (WHERE status = 'completed') as payments_confirmed,
            COUNT(*) FILTER (WHERE status = 'failed') as payments_failed,
            COALESCE(SUM(
                CASE 
                    WHEN status = 'completed' THEN 
                        CASE billing_cycle 
                            WHEN 'monthly' THEN sp.monthly_price 
                            WHEN 'annual' THEN sp.annual_price 
                        END
                    ELSE 0 
                END
            ), 0) as revenue_total,
            COALESCE(SUM(
                CASE 
                    WHEN status = 'completed' AND billing_cycle = 'monthly' THEN sp.monthly_price 
                    ELSE 0 
                END
            ), 0) as revenue_monthly,
            COALESCE(SUM(
                CASE 
                    WHEN status = 'completed' AND billing_cycle = 'annual' THEN sp.annual_price 
                    ELSE 0 
                END
            ), 0) as revenue_annual,
            COALESCE(AVG(
                CASE 
                    WHEN status = 'completed' AND completed_at IS NOT NULL THEN 
                        EXTRACT(EPOCH FROM (completed_at - created_at)) / 60
                    ELSE NULL 
                END
            )::INTEGER, 0) as avg_completion_time_minutes
        FROM subscription_intents si
        JOIN subscription_plans sp ON si.plan_id = sp.id
        WHERE DATE(si.created_at) = target_date
          AND si.plan_id = target_plan_id
        GROUP BY si.plan_id
        ON CONFLICT (date, plan_id) 
        DO UPDATE SET
            checkouts_started = EXCLUDED.checkouts_started,
            checkouts_completed = EXCLUDED.checkouts_completed,
            payments_confirmed = EXCLUDED.payments_confirmed,
            payments_failed = EXCLUDED.payments_failed,
            revenue_total = EXCLUDED.revenue_total,
            revenue_monthly = EXCLUDED.revenue_monthly,
            revenue_annual = EXCLUDED.revenue_annual,
            avg_completion_time_minutes = EXCLUDED.avg_completion_time_minutes,
            updated_at = NOW();
        
        processed_plans := 1;
    ELSE
        -- Processar todos os planos para a data
        FOR plan_record IN 
            SELECT DISTINCT plan_id 
            FROM subscription_intents 
            WHERE DATE(created_at) = target_date
        LOOP
            PERFORM update_daily_payment_analytics(target_date, plan_record.plan_id);
            processed_plans := processed_plans + 1;
        END LOOP;
    END IF;
    
    RETURN processed_plans;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentários nas funções
COMMENT ON FUNCTION create_subscription_intent IS 'Cria uma nova intenção de assinatura com validações';
COMMENT ON FUNCTION update_subscription_intent_status IS 'Atualiza o status de uma intenção de assinatura';
COMMENT ON FUNCTION log_webhook_event IS 'Registra um evento de webhook com deduplicação';
COMMENT ON FUNCTION update_webhook_processing_status IS 'Atualiza o status de processamento de um webhook';
COMMENT ON FUNCTION cleanup_expired_subscription_intents IS 'Limpa intenções de assinatura expiradas';
COMMENT ON FUNCTION cleanup_webhook_logs IS 'Limpa logs de webhook antigos';
COMMENT ON FUNCTION update_daily_payment_analytics IS 'Atualiza métricas diárias de pagamento';

-- Verificação das funções criadas
SELECT 
    routine_name as funcao,
    routine_type as tipo,
    data_type as retorno
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name LIKE '%subscription%' 
     OR routine_name LIKE '%webhook%' 
     OR routine_name LIKE '%payment%'
ORDER BY routine_name;