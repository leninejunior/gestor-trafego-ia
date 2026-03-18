-- Schema SaaS: Planos, Assinaturas e Sistema de Pagamentos
-- Execute após o complete-schema.sql

-- 1. Tabela de Planos
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price_monthly DECIMAL NOT NULL DEFAULT 0,
  price_yearly DECIMAL NOT NULL DEFAULT 0,
  max_ad_accounts INTEGER NOT NULL DEFAULT 1,
  max_users INTEGER NOT NULL DEFAULT 1,
  max_clients INTEGER NOT NULL DEFAULT 5,
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabela de Assinaturas
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'active', -- active, canceled, past_due, unpaid
  billing_cycle TEXT NOT NULL DEFAULT 'monthly', -- monthly, yearly
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabela de Faturas
CREATE TABLE IF NOT EXISTS invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  amount DECIMAL NOT NULL,
  currency TEXT DEFAULT 'BRL',
  status TEXT NOT NULL DEFAULT 'pending', -- pending, paid, failed, canceled
  stripe_invoice_id TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabela de Uso (para controle de limites)
CREATE TABLE IF NOT EXISTS usage_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL, -- ad_accounts, users, clients, api_calls
  current_usage INTEGER NOT NULL DEFAULT 0,
  period_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(org_id, resource_type, period_start)
);

-- 5. Tabela de Roles expandida
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  permissions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Atualizar memberships para usar roles
ALTER TABLE memberships 
ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES user_roles(id),
ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS invited_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE;

-- 7. Tabela de Convites
CREATE TABLE IF NOT EXISTS organization_invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role_id UUID NOT NULL REFERENCES user_roles(id),
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Inserir planos padrão
INSERT INTO subscription_plans (name, description, price_monthly, price_yearly, max_ad_accounts, max_users, max_clients, features) VALUES
('Starter', 'Ideal para freelancers e pequenas agências', 97.00, 970.00, 3, 2, 10, 
 '["Dashboard básico", "Relatórios mensais", "Suporte por email"]'::jsonb),
('Professional', 'Para agências em crescimento', 197.00, 1970.00, 10, 5, 25, 
 '["Dashboard avançado", "Relatórios ilimitados", "WhatsApp automático", "Suporte prioritário"]'::jsonb),
('Enterprise', 'Para grandes agências', 397.00, 3970.00, 50, 15, 100, 
 '["Dashboard completo", "API access", "White label", "Suporte dedicado", "Treinamento"]'::jsonb),
('Free Trial', 'Teste grátis por 14 dias', 0.00, 0.00, 1, 1, 3, 
 '["Dashboard básico", "1 conta de anúncios", "Relatórios limitados"]'::jsonb);

-- 9. Inserir roles padrão
INSERT INTO user_roles (name, description, permissions) VALUES
('owner', 'Proprietário da organização', 
 '["manage_billing", "manage_users", "manage_clients", "manage_campaigns", "view_reports", "manage_settings"]'::jsonb),
('admin', 'Administrador', 
 '["manage_users", "manage_clients", "manage_campaigns", "view_reports", "manage_settings"]'::jsonb),
('manager', 'Gestor de tráfego', 
 '["manage_clients", "manage_campaigns", "view_reports"]'::jsonb),
('viewer', 'Visualizador', 
 '["view_reports"]'::jsonb);

-- 10. Função para verificar limites do plano
CREATE OR REPLACE FUNCTION check_plan_limits(org_uuid UUID, resource_type TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_plan subscription_plans%ROWTYPE;
  current_usage INTEGER;
  max_allowed INTEGER;
BEGIN
  -- Buscar plano atual da organização
  SELECT sp.* INTO current_plan
  FROM subscription_plans sp
  JOIN subscriptions s ON s.plan_id = sp.id
  WHERE s.org_id = org_uuid 
    AND s.status = 'active'
    AND s.current_period_end > NOW()
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN FALSE; -- Sem plano ativo
  END IF;

  -- Verificar uso atual
  CASE resource_type
    WHEN 'ad_accounts' THEN
      SELECT COUNT(*) INTO current_usage
      FROM ad_accounts
      WHERE org_id = org_uuid;
      max_allowed := current_plan.max_ad_accounts;
    
    WHEN 'users' THEN
      SELECT COUNT(*) INTO current_usage
      FROM memberships
      WHERE org_id = org_uuid;
      max_allowed := current_plan.max_users;
    
    WHEN 'clients' THEN
      SELECT COUNT(*) INTO current_usage
      FROM clients
      WHERE org_id = org_uuid;
      max_allowed := current_plan.max_clients;
    
    ELSE
      RETURN FALSE;
  END CASE;

  RETURN current_usage < max_allowed;
END;
$$;

-- 11. Função para criar assinatura trial
CREATE OR REPLACE FUNCTION create_trial_subscription(org_uuid UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  trial_plan_id UUID;
  new_subscription_id UUID;
BEGIN
  -- Buscar plano trial
  SELECT id INTO trial_plan_id
  FROM subscription_plans
  WHERE name = 'Free Trial'
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plano trial não encontrado';
  END IF;

  -- Criar assinatura trial
  INSERT INTO subscriptions (
    org_id, 
    plan_id, 
    status, 
    current_period_start, 
    current_period_end
  ) VALUES (
    org_uuid,
    trial_plan_id,
    'active',
    NOW(),
    NOW() + INTERVAL '14 days'
  ) RETURNING id INTO new_subscription_id;

  RETURN new_subscription_id;
END;
$$;

-- 12. Atualizar função de criação de organização
CREATE OR REPLACE FUNCTION create_org_and_add_admin()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_org_id UUID;
  current_user_id UUID;
  owner_role_id UUID;
  trial_subscription_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- Buscar role de owner
  SELECT id INTO owner_role_id
  FROM user_roles
  WHERE name = 'owner'
  LIMIT 1;

  -- Criar nova organização
  INSERT INTO organizations (name)
  VALUES ('Minha Organização')
  RETURNING id INTO new_org_id;

  -- Adicionar usuário como owner
  INSERT INTO memberships (user_id, org_id, role, role_id, accepted_at)
  VALUES (current_user_id, new_org_id, 'owner', owner_role_id, NOW());

  -- Criar assinatura trial
  SELECT create_trial_subscription(new_org_id) INTO trial_subscription_id;

  RETURN new_org_id;
END;
$$;

-- 13. Índices para performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_org_id ON subscriptions(org_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_invoices_subscription_id ON invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_org_id ON usage_tracking(org_id);
CREATE INDEX IF NOT EXISTS idx_organization_invites_token ON organization_invites(token);

-- 14. RLS para novas tabelas
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invites ENABLE ROW LEVEL SECURITY;

-- 15. Políticas RLS
CREATE POLICY "Anyone can view subscription plans" ON subscription_plans
    FOR SELECT USING (is_active = true);

CREATE POLICY "Users can view their org subscriptions" ON subscriptions
    FOR SELECT USING (
        org_id IN (
            SELECT org_id FROM memberships 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can view their org invoices" ON invoices
    FOR SELECT USING (
        org_id IN (
            SELECT org_id FROM memberships 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can view their org usage" ON usage_tracking
    FOR SELECT USING (
        org_id IN (
            SELECT org_id FROM memberships 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Anyone can view user roles" ON user_roles
    FOR SELECT USING (true);

CREATE POLICY "Users can view their org invites" ON organization_invites
    FOR SELECT USING (
        org_id IN (
            SELECT org_id FROM memberships 
            WHERE user_id = auth.uid()
        )
    );

-- 16. Triggers para updated_at
CREATE TRIGGER update_subscription_plans_updated_at 
    BEFORE UPDATE ON subscription_plans 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at 
    BEFORE UPDATE ON subscriptions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at 
    BEFORE UPDATE ON invoices 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_usage_tracking_updated_at 
    BEFORE UPDATE ON usage_tracking 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();