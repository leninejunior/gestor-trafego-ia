-- =============================================
-- SUBSCRIPTION INTENT TRANSITIONS SCHEMA
-- =============================================
-- Implementa auditoria e logs de mudanças de estado para subscription intents
-- Usado pela state machine para rastrear transições

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- SUBSCRIPTION INTENT TRANSITIONS TABLE
-- =============================================
-- Armazena logs de todas as transições de estado dos subscription intents
CREATE TABLE IF NOT EXISTS subscription_intent_transitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    intent_id UUID NOT NULL REFERENCES subscription_intents(id) ON DELETE CASCADE,
    
    -- Estado da transição
    from_status VARCHAR(20) NOT NULL CHECK (from_status IN ('pending', 'processing', 'completed', 'failed', 'expired')),
    to_status VARCHAR(20) NOT NULL CHECK (to_status IN ('pending', 'processing', 'completed', 'failed', 'expired')),
    
    -- Detalhes da transição
    reason TEXT,
    metadata JSONB DEFAULT '{}',
    success BOOLEAN NOT NULL DEFAULT true,
    
    -- Auditoria
    triggered_by VARCHAR(255), -- user_id, system, webhook, etc.
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================
CREATE INDEX IF NOT EXISTS idx_subscription_intent_transitions_intent_id ON subscription_intent_transitions(intent_id);
CREATE INDEX IF NOT EXISTS idx_subscription_intent_transitions_from_status ON subscription_intent_transitions(from_status);
CREATE INDEX IF NOT EXISTS idx_subscription_intent_transitions_to_status ON subscription_intent_transitions(to_status);
CREATE INDEX IF NOT EXISTS idx_subscription_intent_transitions_success ON subscription_intent_transitions(success);
CREATE INDEX IF NOT EXISTS idx_subscription_intent_transitions_created_at ON subscription_intent_transitions(created_at);
CREATE INDEX IF NOT EXISTS idx_subscription_intent_transitions_triggered_by ON subscription_intent_transitions(triggered_by);

-- Índice composto para consultas de histórico
CREATE INDEX IF NOT EXISTS idx_subscription_intent_transitions_intent_created ON subscription_intent_transitions(intent_id, created_at);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================
ALTER TABLE subscription_intent_transitions ENABLE ROW LEVEL SECURITY;

-- Política: Apenas admins e super_admins podem acessar logs de transição
CREATE POLICY "subscription_intent_transitions_admin_access" ON subscription_intent_transitions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM memberships m
            WHERE m.user_id = auth.uid()
            AND m.role IN ('super_admin', 'admin')
        )
    );

-- =============================================
-- UTILITY FUNCTIONS
-- =============================================

-- Função para obter histórico de transições de um intent
CREATE OR REPLACE FUNCTION get_subscription_intent_transition_history(
    intent_id_param UUID
)
RETURNS TABLE (
    id UUID,
    from_status VARCHAR(20),
    to_status VARCHAR(20),
    reason TEXT,
    metadata JSONB,
    success BOOLEAN,
    triggered_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE
) AS $
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        t.from_status,
        t.to_status,
        t.reason,
        t.metadata,
        t.success,
        t.triggered_by,
        t.created_at
    FROM subscription_intent_transitions t
    WHERE t.intent_id = intent_id_param
    ORDER BY t.created_at ASC;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter estatísticas de transições
CREATE OR REPLACE FUNCTION get_subscription_intent_transition_stats(
    start_date TIMESTAMP WITH TIME ZONE DEFAULT (NOW() - INTERVAL '30 days'),
    end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE (
    from_status VARCHAR(20),
    to_status VARCHAR(20),
    transition_count BIGINT,
    success_count BIGINT,
    failure_count BIGINT,
    success_rate NUMERIC
) AS $
BEGIN
    RETURN QUERY
    SELECT 
        t.from_status,
        t.to_status,
        COUNT(*) as transition_count,
        COUNT(*) FILTER (WHERE t.success = true) as success_count,
        COUNT(*) FILTER (WHERE t.success = false) as failure_count,
        ROUND(
            (COUNT(*) FILTER (WHERE t.success = true)::NUMERIC / COUNT(*)::NUMERIC) * 100,
            2
        ) as success_rate
    FROM subscription_intent_transitions t
    WHERE t.created_at >= start_date
    AND t.created_at <= end_date
    GROUP BY t.from_status, t.to_status
    ORDER BY transition_count DESC;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para limpar logs antigos de transições (executar via cron)
CREATE OR REPLACE FUNCTION cleanup_old_subscription_intent_transitions(
    retention_days INTEGER DEFAULT 90
)
RETURNS INTEGER AS $
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Deletar logs de transição mais antigos que o período de retenção
    DELETE FROM subscription_intent_transitions 
    WHERE created_at < (NOW() - (retention_days || ' days')::INTERVAL);
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log da operação de limpeza
    INSERT INTO webhook_logs (event_type, payload, status, processed_at)
    VALUES (
        'cleanup.transition_logs',
        jsonb_build_object(
            'deleted_count', deleted_count, 
            'retention_days', retention_days,
            'timestamp', NOW()
        ),
        'completed',
        NOW()
    );
    
    RETURN deleted_count;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- TRIGGERS
-- =============================================

-- Trigger para validar transições de estado
CREATE OR REPLACE FUNCTION validate_state_transition()
RETURNS TRIGGER AS $
DECLARE
    valid_transitions JSONB := '{
        "pending": ["processing", "expired", "failed"],
        "processing": ["completed", "failed", "expired"],
        "failed": ["pending", "expired"],
        "completed": [],
        "expired": []
    }';
    allowed_transitions JSONB;
BEGIN
    -- Obter transições permitidas para o estado atual
    allowed_transitions := valid_transitions->NEW.from_status;
    
    -- Verificar se a transição é válida
    IF NOT (allowed_transitions ? NEW.to_status) THEN
        RAISE EXCEPTION 'Invalid state transition from % to %', NEW.from_status, NEW.to_status;
    END IF;
    
    RETURN NEW;
END;
$ LANGUAGE plpgsql;

CREATE TRIGGER validate_state_transition_trigger
    BEFORE INSERT ON subscription_intent_transitions
    FOR EACH ROW EXECUTE FUNCTION validate_state_transition();

-- =============================================
-- GRANTS AND PERMISSIONS
-- =============================================

-- Grant permissions to service role (for API operations)
GRANT ALL ON subscription_intent_transitions TO service_role;
GRANT EXECUTE ON FUNCTION get_subscription_intent_transition_history TO service_role;
GRANT EXECUTE ON FUNCTION get_subscription_intent_transition_stats TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_subscription_intent_transitions TO service_role;

-- Grant read permissions to authenticated users for their own data
GRANT SELECT ON subscription_intent_transitions TO authenticated;
GRANT EXECUTE ON FUNCTION get_subscription_intent_transition_history TO authenticated;

-- =============================================
-- COMMENTS
-- =============================================
COMMENT ON TABLE subscription_intent_transitions IS 'Armazena logs de auditoria de todas as transições de estado dos subscription intents';
COMMENT ON COLUMN subscription_intent_transitions.from_status IS 'Estado anterior do subscription intent';
COMMENT ON COLUMN subscription_intent_transitions.to_status IS 'Novo estado do subscription intent';
COMMENT ON COLUMN subscription_intent_transitions.reason IS 'Motivo da transição (obrigatório para algumas transições)';
COMMENT ON COLUMN subscription_intent_transitions.metadata IS 'Dados adicionais da transição em formato JSON';
COMMENT ON COLUMN subscription_intent_transitions.success IS 'Indica se a transição foi bem-sucedida';
COMMENT ON COLUMN subscription_intent_transitions.triggered_by IS 'Identificador de quem/o que triggou a transição';
COMMENT ON FUNCTION get_subscription_intent_transition_history IS 'Obtém histórico completo de transições de um subscription intent';
COMMENT ON FUNCTION get_subscription_intent_transition_stats IS 'Obtém estatísticas de transições por período';
COMMENT ON FUNCTION cleanup_old_subscription_intent_transitions IS 'Remove logs antigos de transições (executar via cron)';