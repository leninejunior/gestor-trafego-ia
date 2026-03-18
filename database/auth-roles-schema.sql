-- Sistema de Autenticação e Roles Completo
-- Execute após o complete-schema.sql e saas-schema.sql

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

-- 4. Inserir roles padrão se não existirem
INSERT INTO user_roles (name, description, permissions) VALUES
('super_admin', 'Super Administrador do Sistema', 
 '["system_admin", "manage_all_orgs", "manage_billing", "manage_users", "manage_clients", "manage_campaigns", "view_reports", "manage_settings"]'::jsonb),
('owner', 'Proprietário da Organização', 
 '["manage_billing", "manage_users", "manage_clients", "manage_campaigns", "view_reports", "manage_settings", "delete_org"]'::jsonb),
('admin', 'Administrador', 
 '["manage_users", "manage_clients", "manage_campaigns", "view_reports", "manage_settings"]'::jsonb),
('manager', 'Gestor de Tráfego', 
 '["manage_clients", "manage_campaigns", "view_reports", "manage_own_clients"]'::jsonb),
('analyst', 'Analista', 
 '["view_reports", "view_campaigns", "export_data"]'::jsonb),
('viewer', 'Visualizador', 
 '["view_reports"]'::jsonb)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  permissions = EXCLUDED.permissions;

-- 5. Função para gerar token de convite
CREATE OR REPLACE FUNCTION generate_invite_token()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'base64url');
END;
$$;

-- 6. Função para convidar usuário
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
    JOIN user_roles r ON m.role_id = r.id
    WHERE m.user_id = p_invited_by 
      AND m.org_id = p_org_id
      AND (r.permissions ? 'manage_users' OR r.name = 'owner')
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

-- 7. Função para aceitar convite
CREATE OR REPLACE FUNCTION accept_invite(p_token TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invite organization_invites%ROWTYPE;
  v_user_id UUID;
  v_membership_id UUID;
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

  -- Criar membership
  INSERT INTO memberships (
    user_id, org_id, role_id, invited_by, invited_at, accepted_at, status
  ) VALUES (
    v_user_id, v_invite.org_id, v_invite.role_id, 
    v_invite.invited_by, v_invite.created_at, NOW(), 'active'
  ) RETURNING id INTO v_membership_id;

  -- Atualizar convite
  UPDATE organization_invites
  SET status = 'accepted', accepted_at = NOW()
  WHERE id = v_invite.id;

  RETURN v_membership_id;
END;
$$;

-- 8. Função para verificar permissões
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
    JOIN user_roles r ON m.role_id = r.id
    WHERE m.user_id = p_user_id 
      AND m.org_id = p_org_id
      AND m.status = 'active'
      AND (r.permissions ? p_permission OR r.name = 'super_admin')
  ) INTO v_has_permission;

  RETURN v_has_permission;
END;
$$;

-- 9. Função para criar perfil de usuário automaticamente
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

-- 10. Trigger para criar perfil automaticamente
DROP TRIGGER IF EXISTS create_user_profile_trigger ON auth.users;
CREATE TRIGGER create_user_profile_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_user_profile();

-- 11. Atualizar função de criação de organização
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

  -- Criar assinatura trial (se a função existir)
  BEGIN
    SELECT create_trial_subscription(new_org_id) INTO trial_subscription_id;
  EXCEPTION
    WHEN undefined_function THEN
      -- Função não existe ainda, ignorar
      NULL;
  END;

  RETURN new_org_id;
END;
$$;

-- 12. Índices para performance
CREATE INDEX IF NOT EXISTS idx_organization_invites_token ON organization_invites(token);
CREATE INDEX IF NOT EXISTS idx_organization_invites_email ON organization_invites(email);
CREATE INDEX IF NOT EXISTS idx_organization_invites_org_id ON organization_invites(org_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_role_id ON memberships(role_id);

-- 13. RLS para novas tabelas
ALTER TABLE organization_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 14. Políticas RLS para organization_invites
CREATE POLICY "Users can view invites for their orgs" ON organization_invites
    FOR SELECT USING (
        org_id IN (
            SELECT org_id FROM memberships 
            WHERE user_id = auth.uid()
              AND (role = 'owner' OR role = 'admin')
        )
    );

CREATE POLICY "Users can create invites for their orgs" ON organization_invites
    FOR INSERT WITH CHECK (
        org_id IN (
            SELECT org_id FROM memberships 
            WHERE user_id = auth.uid()
              AND (role = 'owner' OR role = 'admin')
        )
    );

-- 15. Políticas RLS para user_profiles
CREATE POLICY "Users can view their own profile" ON user_profiles
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own profile" ON user_profiles
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own profile" ON user_profiles
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- 16. Atualizar políticas de memberships
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

-- 17. Políticas para client_meta_connections (UPDATE e DELETE)
CREATE POLICY "Users can update their own client meta connections" ON client_meta_connections
    FOR UPDATE USING (
        client_id IN (
            SELECT c.id FROM clients c
            JOIN memberships m ON c.org_id = m.org_id
            WHERE m.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their own client meta connections" ON client_meta_connections
    FOR DELETE USING (
        client_id IN (
            SELECT c.id FROM clients c
            JOIN memberships m ON c.org_id = m.org_id
            WHERE m.user_id = auth.uid()
        )
    );

-- 18. Triggers para updated_at nas novas tabelas
CREATE TRIGGER update_organization_invites_updated_at 
    BEFORE UPDATE ON organization_invites 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at 
    BEFORE UPDATE ON user_profiles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 19. Função para limpar convites expirados (executar periodicamente)
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

-- Fim do script