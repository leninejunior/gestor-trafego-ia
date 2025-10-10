-- SETUP COMPLETO DO SISTEMA SAAS
-- Execute este script completo no Supabase SQL Editor
-- Ordem: complete-schema.sql + saas-schema.sql + auth-roles-schema.sql

-- ============================================================================
-- PARTE 1: SCHEMA BÁSICO (do complete-schema.sql)
-- ============================================================================

-- 1. Criar tabela de organizações
CREATE TABLE IF NOT EXISTS organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Organização Padrão',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Criar tabela de memberships (associação usuário-organização)
CREATE TABLE IF NOT EXISTS memberships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'admin',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, org_id)
);

-- 3. Criar tabela de clientes
CREATE TABLE IF NOT EXISTS clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Criar tabela para conexões Meta Ads
CREATE TABLE IF NOT EXISTS client_meta_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  ad_account_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  account_name TEXT,
  currency TEXT DEFAULT 'BRL',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(client_id, ad_account_id)
);

-- 5. Criar tabela para contas de anúncios (Google Ads e outros)
CREATE TABLE IF NOT EXISTS ad_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'google', 'meta', etc.
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  currency TEXT DEFAULT 'BRL',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(client_id, external_id, provider)
);

-- 6. Criar tabela para tokens OAuth
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ad_account_id UUID NOT NULL REFERENCES ad_accounts(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(ad_account_id)
);

-- 7. Criar tabela para campanhas Meta
CREATE TABLE IF NOT EXISTS meta_campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id UUID NOT NULL REFERENCES client_meta_connections(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  objective TEXT,
  daily_budget DECIMAL,
  lifetime_budget DECIMAL,
  created_time TIMESTAMP WITH TIME ZONE,
  updated_time TIMESTAMP WITH TIME ZONE,
  start_time TIMESTAMP WITH TIME ZONE,
  stop_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(connection_id, external_id)
);

-- 8. Criar tabela para insights de campanhas Meta
CREATE TABLE IF NOT EXISTS meta_campaign_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES meta_campaigns(id) ON DELETE CASCADE,
  date_start DATE NOT NULL,
  date_stop DATE NOT NULL,
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  spend DECIMAL DEFAULT 0,
  reach BIGINT DEFAULT 0,
  frequency DECIMAL DEFAULT 0,
  cpm DECIMAL DEFAULT 0,
  cpc DECIMAL DEFAULT 0,
  ctr DECIMAL DEFAULT 0,
  cost_per_conversion DECIMAL DEFAULT 0,
  conversions BIGINT DEFAULT 0,
  conversion_rate DECIMAL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(campaign_id, date_start, date_stop)
);

-- ============================================================================
-- PARTE 2: SCHEMA SAAS (do saas-schema.sql)
-- ============================================================================

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

-- 5. Tabela de Roles
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  permissions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- PARTE 3: SCHEMA DE AUTENTICAÇÃO AVANÇADA (do auth-roles-schema.sql)
-- ============================================================================

-- 1. Atualizar tabela de memberships com novos campos
ALTER TABLE memberships 
ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES user_roles(id),
ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS invited_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'; -- active, pending, suspended

-- 2. Tabela de convites para organizações
CREATE TABLE IF NOT EXISTS organization_invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role_id UUID NOT NULL REFERENCES user_roles(id),
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending', -- pending, accepted, rejected, expired
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabela de perfis de usuário (dados extras)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  timezone TEXT DEFAULT 'America/Sao_Paulo',
  language TEXT DEFAULT 'pt-BR',
  onboarding_completed BOOLEAN DEFAULT false,
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- PARTE 4: INSERIR DADOS PADRÃO
-- ============================================================================

-- Inserir planos padrão (apenas se não existirem)
INSERT INTO subscription_plans (name, description, price_monthly, price_yearly, max_ad_accounts, max_users, max_clients, features) 
SELECT 'Starter', 'Ideal para freelancers e pequenas agências', 97.00, 970.00, 3, 2, 10, 
       '["Dashboard básico", "Relatórios mensais", "Suporte por email"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE name = 'Starter');

INSERT INTO subscription_plans (name, description, price_monthly, price_yearly, max_ad_accounts, max_users, max_clients, features) 
SELECT 'Professional', 'Para agências em crescimento', 197.00, 1970.00, 10, 5, 25, 
       '["Dashboard avançado", "Relatórios ilimitados", "WhatsApp automático", "Suporte prioritário"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE name = 'Professional');

INSERT INTO subscription_plans (name, description, price_monthly, price_yearly, max_ad_accounts, max_users, max_clients, features) 
SELECT 'Enterprise', 'Para grandes agências', 397.00, 3970.00, 50, 15, 100, 
       '["Dashboard completo", "API access", "White label", "Suporte dedicado", "Treinamento"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE name = 'Enterprise');

INSERT INTO subscription_plans (name, description, price_monthly, price_yearly, max_ad_accounts, max_users, max_clients, features) 
SELECT 'Free Trial', 'Teste grátis por 14 dias', 0.00, 0.00, 1, 1, 3, 
       '["Dashboard básico", "1 conta de anúncios", "Relatórios limitados"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE name = 'Free Trial');

-- Inserir roles padrão (apenas se não existirem)
INSERT INTO user_roles (name, description, permissions) 
SELECT 'super_admin', 'Super Administrador do Sistema', 
       '["system_admin", "manage_all_orgs", "manage_billing", "manage_users", "manage_clients", "manage_campaigns", "view_reports", "manage_settings"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM user_roles WHERE name = 'super_admin');

INSERT INTO user_roles (name, description, permissions) 
SELECT 'owner', 'Proprietário da Organização', 
       '["manage_billing", "manage_users", "manage_clients", "manage_campaigns", "view_reports", "manage_settings", "delete_org"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM user_roles WHERE name = 'owner');

INSERT INTO user_roles (name, description, permissions) 
SELECT 'admin', 'Administrador', 
       '["manage_users", "manage_clients", "manage_campaigns", "view_reports", "manage_settings"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM user_roles WHERE name = 'admin');

INSERT INTO user_roles (name, description, permissions) 
SELECT 'manager', 'Gestor de Tráfego', 
       '["manage_clients", "manage_campaigns", "view_reports", "manage_own_clients"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM user_roles WHERE name = 'manager');

INSERT INTO user_roles (name, description, permissions) 
SELECT 'analyst', 'Analista', 
       '["view_reports", "view_campaigns", "export_data"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM user_roles WHERE name = 'analyst');

INSERT INTO user_roles (name, description, permissions) 
SELECT 'viewer', 'Visualizador', 
       '["view_reports"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM user_roles WHERE name = 'viewer');

-- ============================================================================
-- PARTE 5: FUNÇÕES DO BANCO
-- ============================================================================

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Função para gerar token de convite
CREATE OR REPLACE FUNCTION generate_invite_token()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'base64url');
END;
$$;

-- Função para convidar usuário
CREATE OR REPLACE FUNCTION invite_user_to_org(
  p_org_id UUID,
  p_email TEXT,
  p_role_name TEXT,
  p_invited_by UUID DEFAULT auth.uid()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role_id UUID;
  v_invite_id UUID;
  v_token TEXT;
  v_expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Verificar se o usuário tem permissão para convidar
  IF NOT EXISTS (
    SELECT 1 FROM memberships m
    LEFT JOIN user_roles r ON m.role_id = r.id
    WHERE m.user_id = p_invited_by 
      AND m.org_id = p_org_id
      AND (r.permissions ? 'manage_users' OR r.name = 'owner' OR m.role = 'owner' OR m.role = 'admin')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para convidar usuários';
  END IF;

  -- Buscar role_id
  SELECT id INTO v_role_id
  FROM user_roles
  WHERE name = p_role_name;

  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'Role não encontrada: %', p_role_name;
  END IF;

  -- Verificar se já existe convite pendente
  IF EXISTS (
    SELECT 1 FROM organization_invites
    WHERE org_id = p_org_id 
      AND email = p_email 
      AND status = 'pending'
      AND expires_at > NOW()
  ) THEN
    RAISE EXCEPTION 'Já existe um convite pendente para este email';
  END IF;

  -- Verificar se usuário já é membro
  IF EXISTS (
    SELECT 1 FROM memberships m
    JOIN auth.users u ON m.user_id = u.id
    WHERE m.org_id = p_org_id AND u.email = p_email
  ) THEN
    RAISE EXCEPTION 'Usuário já é membro desta organização';
  END IF;

  -- Gerar token e data de expiração
  v_token := generate_invite_token();
  v_expires_at := NOW() + INTERVAL '7 days';

  -- Criar convite
  INSERT INTO organization_invites (
    org_id, email, role_id, invited_by, token, expires_at
  ) VALUES (
    p_org_id, p_email, v_role_id, p_invited_by, v_token, v_expires_at
  ) RETURNING id INTO v_invite_id;

  RETURN v_invite_id;
END;
$$;

-- Função para aceitar convite
CREATE OR REPLACE FUNCTION accept_invite(p_token TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invite organization_invites%ROWTYPE;
  v_user_id UUID;
  v_membership_id UUID;
  v_role_name TEXT;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- Buscar convite
  SELECT * INTO v_invite
  FROM organization_invites
  WHERE token = p_token
    AND status = 'pending'
    AND expires_at > NOW();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite inválido ou expirado';
  END IF;

  -- Verificar se o email do usuário confere
  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = v_user_id AND email = v_invite.email
  ) THEN
    RAISE EXCEPTION 'Email do usuário não confere com o convite';
  END IF;

  -- Verificar se já é membro
  IF EXISTS (
    SELECT 1 FROM memberships
    WHERE user_id = v_user_id AND org_id = v_invite.org_id
  ) THEN
    RAISE EXCEPTION 'Usuário já é membro desta organização';
  END IF;

  -- Buscar nome da role
  SELECT name INTO v_role_name
  FROM user_roles
  WHERE id = v_invite.role_id;

  -- Criar membership
  INSERT INTO memberships (
    user_id, org_id, role, role_id, invited_by, invited_at, accepted_at, status
  ) VALUES (
    v_user_id, v_invite.org_id, v_role_name, v_invite.role_id, 
    v_invite.invited_by, v_invite.created_at, NOW(), 'active'
  ) RETURNING id INTO v_membership_id;

  -- Atualizar convite
  UPDATE organization_invites
  SET status = 'accepted', accepted_at = NOW()
  WHERE id = v_invite.id;

  RETURN v_membership_id;
END;
$$;

-- Função para verificar permissões
CREATE OR REPLACE FUNCTION user_has_permission(
  p_user_id UUID,
  p_org_id UUID,
  p_permission TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_has_permission BOOLEAN := false;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM memberships m
    LEFT JOIN user_roles r ON m.role_id = r.id
    WHERE m.user_id = p_user_id 
      AND m.org_id = p_org_id
      AND m.status = 'active'
      AND (r.permissions ? p_permission OR r.name = 'super_admin' OR m.role = 'owner')
  ) INTO v_has_permission;

  RETURN v_has_permission;
END;
$$;

-- Função para criar assinatura trial
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

-- Função para criar perfil de usuário automaticamente
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO user_profiles (user_id, first_name, last_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );
  RETURN NEW;
END;
$$;

-- Atualizar função de criação de organização
CREATE OR REPLACE FUNCTION create_org_and_add_admin(p_org_name TEXT DEFAULT 'Minha Organização')
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
  VALUES (p_org_name)
  RETURNING id INTO new_org_id;

  -- Adicionar usuário como owner
  INSERT INTO memberships (user_id, org_id, role, role_id, accepted_at, status)
  VALUES (current_user_id, new_org_id, 'owner', owner_role_id, NOW(), 'active');

  -- Criar assinatura trial
  BEGIN
    SELECT create_trial_subscription(new_org_id) INTO trial_subscription_id;
  EXCEPTION
    WHEN OTHERS THEN
      -- Se falhar, continuar sem trial
      NULL;
  END;

  RETURN new_org_id;
END;
$$;

-- Função para limpar convites expirados
CREATE OR REPLACE FUNCTION cleanup_expired_invites()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE organization_invites
  SET status = 'expired'
  WHERE status = 'pending' 
    AND expires_at < NOW();
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ============================================================================
-- PARTE 6: ÍNDICES PARA PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_org_id ON memberships(org_id);
CREATE INDEX IF NOT EXISTS idx_memberships_role_id ON memberships(role_id);
CREATE INDEX IF NOT EXISTS idx_clients_org_id ON clients(org_id);
CREATE INDEX IF NOT EXISTS idx_client_meta_connections_client_id ON client_meta_connections(client_id);
CREATE INDEX IF NOT EXISTS idx_ad_accounts_client_id ON ad_accounts(client_id);
CREATE INDEX IF NOT EXISTS idx_ad_accounts_org_id ON ad_accounts(org_id);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_ad_account_id ON oauth_tokens(ad_account_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_org_id ON subscriptions(org_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_invoices_subscription_id ON invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_org_id ON usage_tracking(org_id);
CREATE INDEX IF NOT EXISTS idx_organization_invites_token ON organization_invites(token);
CREATE INDEX IF NOT EXISTS idx_organization_invites_email ON organization_invites(email);
CREATE INDEX IF NOT EXISTS idx_organization_invites_org_id ON organization_invites(org_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

-- ============================================================================
-- PARTE 7: TRIGGERS
-- ============================================================================

-- Trigger para criar perfil automaticamente
DROP TRIGGER IF EXISTS create_user_profile_trigger ON auth.users;
CREATE TRIGGER create_user_profile_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_user_profile();

-- Aplicar trigger em todas as tabelas (remover se já existir)
DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
CREATE TRIGGER update_organizations_updated_at 
    BEFORE UPDATE ON organizations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_memberships_updated_at ON memberships;
CREATE TRIGGER update_memberships_updated_at 
    BEFORE UPDATE ON memberships 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_clients_updated_at ON clients;
CREATE TRIGGER update_clients_updated_at 
    BEFORE UPDATE ON clients 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_client_meta_connections_updated_at ON client_meta_connections;
CREATE TRIGGER update_client_meta_connections_updated_at 
    BEFORE UPDATE ON client_meta_connections 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ad_accounts_updated_at ON ad_accounts;
CREATE TRIGGER update_ad_accounts_updated_at 
    BEFORE UPDATE ON ad_accounts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_oauth_tokens_updated_at ON oauth_tokens;
CREATE TRIGGER update_oauth_tokens_updated_at 
    BEFORE UPDATE ON oauth_tokens 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscription_plans_updated_at ON subscription_plans;
CREATE TRIGGER update_subscription_plans_updated_at 
    BEFORE UPDATE ON subscription_plans 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at 
    BEFORE UPDATE ON subscriptions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
CREATE TRIGGER update_invoices_updated_at 
    BEFORE UPDATE ON invoices 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_usage_tracking_updated_at ON usage_tracking;
CREATE TRIGGER update_usage_tracking_updated_at 
    BEFORE UPDATE ON usage_tracking 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_organization_invites_updated_at ON organization_invites;
CREATE TRIGGER update_organization_invites_updated_at 
    BEFORE UPDATE ON organization_invites 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at 
    BEFORE UPDATE ON user_profiles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PARTE 8: ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_meta_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_campaign_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para organizations
DROP POLICY IF EXISTS "Users can view their own organizations" ON organizations;
CREATE POLICY "Users can view their own organizations" ON organizations
    FOR SELECT USING (
        id IN (
            SELECT org_id FROM memberships 
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update their own organizations" ON organizations;
CREATE POLICY "Users can update their own organizations" ON organizations
    FOR UPDATE USING (
        id IN (
            SELECT org_id FROM memberships 
            WHERE user_id = auth.uid() AND (role = 'admin' OR role = 'owner')
        )
    );

-- Políticas RLS para memberships
DROP POLICY IF EXISTS "Users can view their own memberships" ON memberships;
CREATE POLICY "Users can view their own memberships" ON memberships
    FOR SELECT USING (
        user_id = auth.uid() 
        OR org_id IN (
            SELECT org_id FROM memberships 
            WHERE user_id = auth.uid() 
              AND (role = 'owner' OR role = 'admin')
        )
    );

DROP POLICY IF EXISTS "Users can insert their own memberships" ON memberships;
CREATE POLICY "Users can insert their own memberships" ON memberships
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Políticas RLS para clients
DROP POLICY IF EXISTS "Users can view their own clients" ON clients;
CREATE POLICY "Users can view their own clients" ON clients
    FOR SELECT USING (
        org_id IN (
            SELECT org_id FROM memberships 
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert their own clients" ON clients;
CREATE POLICY "Users can insert their own clients" ON clients
    FOR INSERT WITH CHECK (
        org_id IN (
            SELECT org_id FROM memberships 
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update their own clients" ON clients;
CREATE POLICY "Users can update their own clients" ON clients
    FOR UPDATE USING (
        org_id IN (
            SELECT org_id FROM memberships 
            WHERE user_id = auth.uid()
        )
    );

-- Políticas RLS para client_meta_connections
DROP POLICY IF EXISTS "Users can view their own client meta connections" ON client_meta_connections;
CREATE POLICY "Users can view their own client meta connections" ON client_meta_connections
    FOR SELECT USING (
        client_id IN (
            SELECT c.id FROM clients c
            JOIN memberships m ON c.org_id = m.org_id
            WHERE m.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert their own client meta connections" ON client_meta_connections;
CREATE POLICY "Users can insert their own client meta connections" ON client_meta_connections
    FOR INSERT WITH CHECK (
        client_id IN (
            SELECT c.id FROM clients c
            JOIN memberships m ON c.org_id = m.org_id
            WHERE m.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update their own client meta connections" ON client_meta_connections;
CREATE POLICY "Users can update their own client meta connections" ON client_meta_connections
    FOR UPDATE USING (
        client_id IN (
            SELECT c.id FROM clients c
            JOIN memberships m ON c.org_id = m.org_id
            WHERE m.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete their own client meta connections" ON client_meta_connections;
CREATE POLICY "Users can delete their own client meta connections" ON client_meta_connections
    FOR DELETE USING (
        client_id IN (
            SELECT c.id FROM clients c
            JOIN memberships m ON c.org_id = m.org_id
            WHERE m.user_id = auth.uid()
        )
    );

-- Políticas RLS para subscription_plans
DROP POLICY IF EXISTS "Anyone can view subscription plans" ON subscription_plans;
CREATE POLICY "Anyone can view subscription plans" ON subscription_plans
    FOR SELECT USING (is_active = true);

-- Políticas RLS para subscriptions
DROP POLICY IF EXISTS "Users can view their org subscriptions" ON subscriptions;
CREATE POLICY "Users can view their org subscriptions" ON subscriptions
    FOR SELECT USING (
        org_id IN (
            SELECT org_id FROM memberships 
            WHERE user_id = auth.uid()
        )
    );

-- Políticas RLS para invoices
DROP POLICY IF EXISTS "Users can view their org invoices" ON invoices;
CREATE POLICY "Users can view their org invoices" ON invoices
    FOR SELECT USING (
        org_id IN (
            SELECT org_id FROM memberships 
            WHERE user_id = auth.uid()
        )
    );

-- Políticas RLS para usage_tracking
DROP POLICY IF EXISTS "Users can view their org usage" ON usage_tracking;
CREATE POLICY "Users can view their org usage" ON usage_tracking
    FOR SELECT USING (
        org_id IN (
            SELECT org_id FROM memberships 
            WHERE user_id = auth.uid()
        )
    );

-- Políticas RLS para user_roles
DROP POLICY IF EXISTS "Anyone can view user roles" ON user_roles;
CREATE POLICY "Anyone can view user roles" ON user_roles
    FOR SELECT USING (true);

-- Políticas RLS para organization_invites
DROP POLICY IF EXISTS "Users can view invites for their orgs" ON organization_invites;
CREATE POLICY "Users can view invites for their orgs" ON organization_invites
    FOR SELECT USING (
        org_id IN (
            SELECT org_id FROM memberships 
            WHERE user_id = auth.uid()
              AND (role = 'owner' OR role = 'admin')
        )
    );

DROP POLICY IF EXISTS "Users can create invites for their orgs" ON organization_invites;
CREATE POLICY "Users can create invites for their orgs" ON organization_invites
    FOR INSERT WITH CHECK (
        org_id IN (
            SELECT org_id FROM memberships 
            WHERE user_id = auth.uid()
              AND (role = 'owner' OR role = 'admin')
        )
    );

-- Políticas RLS para user_profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
CREATE POLICY "Users can view their own profile" ON user_profiles
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
CREATE POLICY "Users can update their own profile" ON user_profiles
    FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;
CREATE POLICY "Users can insert their own profile" ON user_profiles
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- FIM DO SETUP COMPLETO
-- ============================================================================

-- Verificar se tudo foi criado corretamente
SELECT 'Setup completo executado com sucesso!' as status;