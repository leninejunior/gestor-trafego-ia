-- =====================================================
-- MIGRAÇÃO CHECKOUT - PASSO 1: TABELAS PRINCIPAIS
-- =====================================================
-- Execute este SQL primeiro no Supabase
-- Cria as tabelas principais do sistema de checkout

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABELA: subscription_intents
-- Armazena intenções de assinatura antes da confirmação do pagamento
CREATE TABLE IF NOT EXISTS subscription_intents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id UUID NOT NULL,
    billing_cycle VARCHAR(10) NOT NULL CHECK (billing_cycle IN ('monthly', 'annual')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'expired')),
    
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
    
    -- Relacionamento com usuário criado
    user_id UUID,
    
    -- Metadados e timestamps
    metadata JSONB DEFAULT '{}',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. TABELA: subscription_intent_transitions
-- Auditoria de mudanças de status das intenções
CREATE TABLE IF NOT EXISTS subscription_intent_transitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_intent_id UUID NOT NULL REFERENCES subscription_intents(id) ON DELETE CASCADE,
    from_status VARCHAR(20),
    to_status VARCHAR(20) NOT NULL,
    reason TEXT,
    triggered_by VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TABELA: webhook_logs
-- Registra todos os webhooks recebidos e seu processamento
CREATE TABLE IF NOT EXISTS webhook_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,
    event_id VARCHAR(255),
    subscription_intent_id UUID REFERENCES subscription_intents(id),
    
    -- Dados do webhook
    payload JSONB NOT NULL,
    headers JSONB DEFAULT '{}',
    source VARCHAR(50) NOT NULL DEFAULT 'iugu',
    
    -- Status de processamento
    status VARCHAR(20) NOT NULL DEFAULT 'received' 
        CHECK (status IN ('received', 'processing', 'processed', 'failed', 'dead_letter')),
    processed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Metadados
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. TABELA: payment_analytics
-- Métricas agregadas para business intelligence
CREATE TABLE IF NOT EXISTS payment_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    plan_id UUID,
    
    -- Métricas de conversão
    checkouts_started INTEGER DEFAULT 0,
    checkouts_completed INTEGER DEFAULT 0,
    payments_confirmed INTEGER DEFAULT 0,
    payments_failed INTEGER DEFAULT 0,
    
    -- Métricas financeiras
    revenue_total DECIMAL(10,2) DEFAULT 0,
    revenue_monthly DECIMAL(10,2) DEFAULT 0,
    revenue_annual DECIMAL(10,2) DEFAULT 0,
    
    -- Métricas de tempo
    avg_completion_time_minutes INTEGER DEFAULT 0,
    avg_payment_time_minutes INTEGER DEFAULT 0,
    
    -- Metadados
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraint para evitar duplicatas
    UNIQUE(date, plan_id)
);

-- Comentários nas tabelas
COMMENT ON TABLE subscription_intents IS 'Intenções de assinatura antes da confirmação do pagamento';
COMMENT ON TABLE subscription_intent_transitions IS 'Auditoria de mudanças de status das intenções';
COMMENT ON TABLE webhook_logs IS 'Logs de todos os webhooks recebidos e processados';
COMMENT ON TABLE payment_analytics IS 'Métricas agregadas para análise de negócio';

-- Comentários em colunas importantes
COMMENT ON COLUMN subscription_intents.status IS 'Status: pending, processing, completed, failed, expired';
COMMENT ON COLUMN subscription_intents.billing_cycle IS 'Ciclo de cobrança: monthly ou annual';
COMMENT ON COLUMN subscription_intents.expires_at IS 'Data de expiração da intenção (padrão: 24h)';
COMMENT ON COLUMN webhook_logs.status IS 'Status: received, processing, processed, failed, dead_letter';
COMMENT ON COLUMN webhook_logs.retry_count IS 'Número de tentativas de reprocessamento';

-- Verificação final
SELECT 
    'subscription_intents' as tabela,
    COUNT(*) as registros_existentes
FROM subscription_intents
UNION ALL
SELECT 
    'subscription_intent_transitions' as tabela,
    COUNT(*) as registros_existentes
FROM subscription_intent_transitions
UNION ALL
SELECT 
    'webhook_logs' as tabela,
    COUNT(*) as registros_existentes
FROM webhook_logs
UNION ALL
SELECT 
    'payment_analytics' as tabela,
    COUNT(*) as registros_existentes
FROM payment_analytics;