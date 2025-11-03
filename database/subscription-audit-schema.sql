-- ============================================================================
-- Subscription Audit Schema
-- ============================================================================
-- Tabela para registrar histórico de mudanças manuais em assinaturas
-- Permite rastreamento completo de todas as alterações feitas por administradores

-- Tabela de auditoria de assinaturas
CREATE TABLE IF NOT EXISTS subscription_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    admin_user_id UUID NOT NULL, -- ID do admin que fez a mudança
    
    -- Tipo de ação realizada
    action_type TEXT NOT NULL CHECK (action_type IN (
        'plan_change',
        'manual_approval', 
        'billing_adjustment',
        'status_change',
        'billing_cycle_change',
        'manual_activation',
        'manual_cancellation',
        'proration_adjustment'
    )),
    
    -- Detalhes da mudança
    reason TEXT NOT NULL, -- Motivo da mudança
    notes TEXT, -- Notas adicionais
    
    -- Dados antes e depois da mudança (JSON)
    previous_data JSONB,
    new_data JSONB,
    
    -- Data efetiva da mudança
    effective_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Metadados
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Índices para performance
    CONSTRAINT subscription_audit_log_subscription_id_idx 
        FOREIGN KEY (subscription_id) REFERENCES subscriptions(id),
    CONSTRAINT subscription_audit_log_organization_id_idx 
        FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

-- Índices para otimizar consultas
CREATE INDEX IF NOT EXISTS idx_subscription_audit_log_subscription_id 
    ON subscription_audit_log(subscription_id);
    
CREATE INDEX IF NOT EXISTS idx_subscription_audit_log_organization_id 
    ON subscription_audit_log(organization_id);
    
CREATE INDEX IF NOT EXISTS idx_subscription_audit_log_admin_user_id 
    ON subscription_audit_log(admin_user_id);
    
CREATE INDEX IF NOT EXISTS idx_subscription_audit_log_action_type 
    ON subscription_audit_log(action_type);
    
CREATE INDEX IF NOT EXISTS idx_subscription_audit_log_created_at 
    ON subscription_audit_log(created_at DESC);
    
CREATE INDEX IF NOT EXISTS idx_subscription_audit_log_effective_date 
    ON subscription_audit_log(effective_date DESC);

-- Índice composto para consultas por organização e período
CREATE INDEX IF NOT EXISTS idx_subscription_audit_log_org_date 
    ON subscription_audit_log(organization_id, created_at DESC);

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

-- Habilitar RLS
ALTER TABLE subscription_audit_log ENABLE ROW LEVEL SECURITY;

-- Política: Apenas super admins podem ver todos os logs
CREATE POLICY "subscription_audit_log_super_admin_all" 
    ON subscription_audit_log FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM admin_users au 
            WHERE au.id = auth.uid() 
            AND au.role = 'super_admin'
        )
    );

-- Política: Admins podem ver logs das organizações que gerenciam
CREATE POLICY "subscription_audit_log_admin_organization" 
    ON subscription_audit_log FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM admin_users au 
            WHERE au.id = auth.uid() 
            AND au.role IN ('admin', 'super_admin')
        )
        AND (
            -- Super admin vê tudo
            EXISTS (
                SELECT 1 FROM admin_users au 
                WHERE au.id = auth.uid() 
                AND au.role = 'super_admin'
            )
            OR
            -- Admin regular vê apenas suas organizações
            organization_id IN (
                SELECT om.organization_id 
                FROM organization_memberships om 
                WHERE om.user_id = auth.uid() 
                AND om.role IN ('admin', 'owner')
            )
        )
    );

-- ============================================================================
-- Funções Auxiliares
-- ============================================================================

-- Função para registrar mudança de plano
CREATE OR REPLACE FUNCTION log_subscription_plan_change(
    p_subscription_id UUID,
    p_organization_id UUID,
    p_admin_user_id UUID,
    p_old_plan_id UUID,
    p_new_plan_id UUID,
    p_reason TEXT,
    p_notes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_audit_id UUID;
    v_old_plan RECORD;
    v_new_plan RECORD;
BEGIN
    -- Buscar dados dos planos
    SELECT id, name, monthly_price, annual_price 
    INTO v_old_plan 
    FROM subscription_plans 
    WHERE id = p_old_plan_id;
    
    SELECT id, name, monthly_price, annual_price 
    INTO v_new_plan 
    FROM subscription_plans 
    WHERE id = p_new_plan_id;
    
    -- Inserir log de auditoria
    INSERT INTO subscription_audit_log (
        subscription_id,
        organization_id,
        admin_user_id,
        action_type,
        reason,
        notes,
        previous_data,
        new_data,
        effective_date
    ) VALUES (
        p_subscription_id,
        p_organization_id,
        p_admin_user_id,
        'plan_change',
        p_reason,
        p_notes,
        jsonb_build_object(
            'plan_id', v_old_plan.id,
            'plan_name', v_old_plan.name,
            'monthly_price', v_old_plan.monthly_price,
            'annual_price', v_old_plan.annual_price
        ),
        jsonb_build_object(
            'plan_id', v_new_plan.id,
            'plan_name', v_new_plan.name,
            'monthly_price', v_new_plan.monthly_price,
            'annual_price', v_new_plan.annual_price
        ),
        NOW()
    ) RETURNING id INTO v_audit_id;
    
    RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para registrar ajuste de cobrança
CREATE OR REPLACE FUNCTION log_billing_adjustment(
    p_subscription_id UUID,
    p_organization_id UUID,
    p_admin_user_id UUID,
    p_amount DECIMAL,
    p_reason TEXT,
    p_notes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_audit_id UUID;
BEGIN
    INSERT INTO subscription_audit_log (
        subscription_id,
        organization_id,
        admin_user_id,
        action_type,
        reason,
        notes,
        previous_data,
        new_data,
        effective_date
    ) VALUES (
        p_subscription_id,
        p_organization_id,
        p_admin_user_id,
        'billing_adjustment',
        p_reason,
        p_notes,
        jsonb_build_object('adjustment_amount', 0),
        jsonb_build_object(
            'adjustment_amount', p_amount,
            'adjustment_type', CASE 
                WHEN p_amount > 0 THEN 'charge' 
                ELSE 'credit' 
            END
        ),
        NOW()
    ) RETURNING id INTO v_audit_id;
    
    RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para registrar mudança de status
CREATE OR REPLACE FUNCTION log_status_change(
    p_subscription_id UUID,
    p_organization_id UUID,
    p_admin_user_id UUID,
    p_old_status TEXT,
    p_new_status TEXT,
    p_reason TEXT,
    p_notes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_audit_id UUID;
BEGIN
    INSERT INTO subscription_audit_log (
        subscription_id,
        organization_id,
        admin_user_id,
        action_type,
        reason,
        notes,
        previous_data,
        new_data,
        effective_date
    ) VALUES (
        p_subscription_id,
        p_organization_id,
        p_admin_user_id,
        'status_change',
        p_reason,
        p_notes,
        jsonb_build_object('status', p_old_status),
        jsonb_build_object('status', p_new_status),
        NOW()
    ) RETURNING id INTO v_audit_id;
    
    RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Views para Relatórios
-- ============================================================================

-- View para relatório de mudanças de planos
CREATE OR REPLACE VIEW subscription_plan_changes AS
SELECT 
    sal.id,
    sal.subscription_id,
    o.name as organization_name,
    au.email as admin_email,
    au.full_name as admin_name,
    sal.previous_data->>'plan_name' as old_plan,
    sal.new_data->>'plan_name' as new_plan,
    (sal.previous_data->>'monthly_price')::decimal as old_monthly_price,
    (sal.new_data->>'monthly_price')::decimal as new_monthly_price,
    sal.reason,
    sal.notes,
    sal.effective_date,
    sal.created_at
FROM subscription_audit_log sal
JOIN organizations o ON sal.organization_id = o.id
LEFT JOIN admin_users au ON sal.admin_user_id = au.id
WHERE sal.action_type = 'plan_change'
ORDER BY sal.created_at DESC;

-- View para relatório de ajustes de cobrança
CREATE OR REPLACE VIEW billing_adjustments AS
SELECT 
    sal.id,
    sal.subscription_id,
    o.name as organization_name,
    au.email as admin_email,
    au.full_name as admin_name,
    (sal.new_data->>'adjustment_amount')::decimal as adjustment_amount,
    sal.new_data->>'adjustment_type' as adjustment_type,
    sal.reason,
    sal.notes,
    sal.effective_date,
    sal.created_at
FROM subscription_audit_log sal
JOIN organizations o ON sal.organization_id = o.id
LEFT JOIN admin_users au ON sal.admin_user_id = au.id
WHERE sal.action_type = 'billing_adjustment'
ORDER BY sal.created_at DESC;

-- View para estatísticas de auditoria
CREATE OR REPLACE VIEW audit_statistics AS
SELECT 
    DATE_TRUNC('month', created_at) as month,
    action_type,
    COUNT(*) as action_count,
    COUNT(DISTINCT admin_user_id) as unique_admins,
    COUNT(DISTINCT organization_id) as affected_organizations
FROM subscription_audit_log
WHERE created_at >= NOW() - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', created_at), action_type
ORDER BY month DESC, action_type;

-- ============================================================================
-- Comentários para Documentação
-- ============================================================================

COMMENT ON TABLE subscription_audit_log IS 'Log de auditoria para mudanças manuais em assinaturas';
COMMENT ON COLUMN subscription_audit_log.action_type IS 'Tipo de ação: plan_change, manual_approval, billing_adjustment, status_change, etc.';
COMMENT ON COLUMN subscription_audit_log.reason IS 'Motivo obrigatório para a mudança';
COMMENT ON COLUMN subscription_audit_log.previous_data IS 'Dados antes da mudança (JSON)';
COMMENT ON COLUMN subscription_audit_log.new_data IS 'Dados após a mudança (JSON)';
COMMENT ON COLUMN subscription_audit_log.effective_date IS 'Data efetiva da mudança';

COMMENT ON FUNCTION log_subscription_plan_change IS 'Registra mudança de plano com dados completos';
COMMENT ON FUNCTION log_billing_adjustment IS 'Registra ajuste de cobrança (crédito ou débito)';
COMMENT ON FUNCTION log_status_change IS 'Registra mudança de status da assinatura';

COMMENT ON VIEW subscription_plan_changes IS 'Relatório de mudanças de planos com detalhes';
COMMENT ON VIEW billing_adjustments IS 'Relatório de ajustes de cobrança';
COMMENT ON VIEW audit_statistics IS 'Estatísticas mensais de ações de auditoria';