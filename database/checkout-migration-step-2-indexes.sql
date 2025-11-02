-- =====================================================
-- MIGRAÇÃO CHECKOUT - PASSO 2: ÍNDICES E PERFORMANCE
-- =====================================================
-- Execute este SQL após o Passo 1
-- Cria índices para otimização de performance

-- ÍNDICES PARA subscription_intents
-- Índices básicos para queries frequentes
CREATE INDEX IF NOT EXISTS idx_subscription_intents_status 
    ON subscription_intents(status);

CREATE INDEX IF NOT EXISTS idx_subscription_intents_user_email 
    ON subscription_intents(user_email);

CREATE INDEX IF NOT EXISTS idx_subscription_intents_expires_at 
    ON subscription_intents(expires_at);

CREATE INDEX IF NOT EXISTS idx_subscription_intents_created_at 
    ON subscription_intents(created_at);

CREATE INDEX IF NOT EXISTS idx_subscription_intents_iugu_customer 
    ON subscription_intents(iugu_customer_id);

CREATE INDEX IF NOT EXISTS idx_subscription_intents_plan_id 
    ON subscription_intents(plan_id);

-- Índice composto para consultas de status por usuário
CREATE INDEX IF NOT EXISTS idx_subscription_intents_user_status 
    ON subscription_intents(user_email, status);

-- Índice para limpeza de registros expirados
CREATE INDEX IF NOT EXISTS idx_subscription_intents_cleanup 
    ON subscription_intents(status, expires_at) 
    WHERE status IN ('pending', 'processing');

-- Índice para consultas por user_id
CREATE INDEX IF NOT EXISTS idx_subscription_intents_user_id 
    ON subscription_intents(user_id) 
    WHERE user_id IS NOT NULL;

-- ÍNDICES PARA subscription_intent_transitions
CREATE INDEX IF NOT EXISTS idx_transitions_intent_id 
    ON subscription_intent_transitions(subscription_intent_id);

CREATE INDEX IF NOT EXISTS idx_transitions_created_at 
    ON subscription_intent_transitions(created_at);

CREATE INDEX IF NOT EXISTS idx_transitions_status 
    ON subscription_intent_transitions(to_status);

-- Índice composto para auditoria
CREATE INDEX IF NOT EXISTS idx_transitions_intent_status_date 
    ON subscription_intent_transitions(subscription_intent_id, to_status, created_at);

-- ÍNDICES PARA webhook_logs
CREATE INDEX IF NOT EXISTS idx_webhook_logs_event_type 
    ON webhook_logs(event_type);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_status 
    ON webhook_logs(status);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at 
    ON webhook_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_intent_id 
    ON webhook_logs(subscription_intent_id);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_event_id 
    ON webhook_logs(event_id);

-- Índice único para deduplicação (apenas se event_id não for nulo)
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_logs_dedup 
    ON webhook_logs(event_id, source) 
    WHERE event_id IS NOT NULL;

-- Índice para retry processing
CREATE INDEX IF NOT EXISTS idx_webhook_logs_retry 
    ON webhook_logs(status, retry_count, created_at) 
    WHERE status IN ('failed', 'received');

-- Índice composto para monitoramento
CREATE INDEX IF NOT EXISTS idx_webhook_logs_monitoring 
    ON webhook_logs(event_type, status, created_at);

-- ÍNDICES PARA payment_analytics
CREATE INDEX IF NOT EXISTS idx_payment_analytics_date 
    ON payment_analytics(date);

CREATE INDEX IF NOT EXISTS idx_payment_analytics_plan 
    ON payment_analytics(plan_id);

CREATE INDEX IF NOT EXISTS idx_payment_analytics_revenue 
    ON payment_analytics(revenue_total);

-- Índice composto para relatórios
CREATE INDEX IF NOT EXISTS idx_payment_analytics_date_plan 
    ON payment_analytics(date DESC, plan_id);

-- Índice para métricas de conversão
CREATE INDEX IF NOT EXISTS idx_payment_analytics_conversion 
    ON payment_analytics(date, checkouts_started, checkouts_completed) 
    WHERE checkouts_started > 0;

-- ÍNDICES PARCIAIS PARA PERFORMANCE
-- Índices parciais para queries específicas de status ativo
CREATE INDEX IF NOT EXISTS idx_active_intents 
    ON subscription_intents(created_at, status)
    WHERE status IN ('pending', 'processing');

-- Índice para webhooks falhados
CREATE INDEX IF NOT EXISTS idx_failed_webhooks 
    ON webhook_logs(created_at, retry_count)
    WHERE status = 'failed';

-- Índice para intents completados recentemente
CREATE INDEX IF NOT EXISTS idx_recent_completed_intents 
    ON subscription_intents(completed_at, plan_id)
    WHERE status = 'completed' AND completed_at IS NOT NULL;

-- ÍNDICES PARA JSONB (metadados)
-- Índice GIN para busca em metadados de subscription_intents
CREATE INDEX IF NOT EXISTS idx_subscription_intents_metadata_gin 
    ON subscription_intents USING GIN (metadata);

-- Índice GIN para busca em payload de webhooks
CREATE INDEX IF NOT EXISTS idx_webhook_logs_payload_gin 
    ON webhook_logs USING GIN (payload);

-- Verificação dos índices criados
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename IN (
    'subscription_intents', 
    'subscription_intent_transitions', 
    'webhook_logs', 
    'payment_analytics'
)
AND schemaname = 'public'
ORDER BY tablename, indexname;