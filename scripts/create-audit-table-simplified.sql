-- ============================================================================
-- Tabela de Auditoria de Assinaturas - VERSÃO SIMPLIFICADA
-- ============================================================================
-- Esta versão funciona sem dependências de tabelas admin_users

-- Criar tabela de auditoria de assinaturas
CREATE TABLE IF NOT EXISTS subscription_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID,
  organization_id UUID,
  admin_user_id UUID,
  action_type TEXT CHECK (action_type IN (
    'plan_change',
    'manual_approval', 
    'billing_adjustment',
    'status_change'
  )),
  reason TEXT NOT NULL,
  notes TEXT,
  previous_data JSONB,
  new_data JSONB,
  effective_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_subscription_audit_log_subscription_id 
  ON subscription_audit_log(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_audit_log_organization_id 
  ON subscription_audit_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscription_audit_log_created_at 
  ON subscription_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_audit_log_admin_user_id 
  ON subscription_audit_log(admin_user_id);

-- Habilitar RLS
ALTER TABLE subscription_audit_log ENABLE ROW LEVEL SECURITY;

-- Política simples: apenas usuários autenticados podem ver e inserir
CREATE POLICY "subscription_audit_log_authenticated" 
ON subscription_audit_log FOR ALL 
USING (auth.uid() IS NOT NULL);

-- Comentários para documentação
COMMENT ON TABLE subscription_audit_log IS 'Log de auditoria para mudanças manuais em assinaturas';
COMMENT ON COLUMN subscription_audit_log.action_type IS 'Tipo de ação: plan_change, manual_approval, billing_adjustment, status_change';
COMMENT ON COLUMN subscription_audit_log.reason IS 'Motivo obrigatório para a mudança';
COMMENT ON COLUMN subscription_audit_log.previous_data IS 'Dados antes da mudança (JSON)';
COMMENT ON COLUMN subscription_audit_log.new_data IS 'Dados após a mudança (JSON)';
COMMENT ON COLUMN subscription_audit_log.effective_date IS 'Data efetiva da mudança';