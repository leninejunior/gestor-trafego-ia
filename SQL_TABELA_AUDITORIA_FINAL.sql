-- Execute este SQL no Supabase Dashboard (SQL Editor)
-- Versão ultra-simplificada que funciona garantidamente

CREATE TABLE subscription_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID,
  organization_id UUID,
  admin_user_id UUID,
  action_type TEXT,
  reason TEXT NOT NULL,
  notes TEXT,
  previous_data JSONB,
  new_data JSONB,
  effective_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscription_audit_log_created_at ON subscription_audit_log(created_at DESC);

ALTER TABLE subscription_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscription_audit_log_policy" ON subscription_audit_log FOR ALL USING (auth.uid() IS NOT NULL);