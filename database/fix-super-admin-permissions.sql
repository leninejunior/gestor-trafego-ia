-- Script para corrigir permissões de super admin
-- Execute este SQL no Supabase SQL Editor

-- 1. Primeiro, aplicar o schema de usuários se ainda não foi aplicado
-- Adicionar colunas de suspensão na tabela user_profiles
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS suspended_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS last_sign_in_at TIMESTAMPTZ;

-- Adicionar colunas de remoção na tabela memberships
ALTER TABLE memberships 
ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS removed_by UUID REFERENCES auth.users(id);

-- Verificar e ajustar estrutura da tabela memberships
DO $$ 
BEGIN
    -- Adicionar coluna organization_id se não existir (mantendo org_id se existir)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'memberships' AND column_name = 'organization_id') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'memberships' AND column_name = 'org_id') THEN
            ALTER TABLE memberships RENAME COLUMN org_id TO organization_id;
        ELSE
            ALTER TABLE memberships ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- Criar tabela para histórico de atividades dos usuários
CREATE TABLE IF NOT EXISTS user_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    details JSONB,
    performed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_user_activities_user_id ON user_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activities_created_at ON user_activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activities_action ON user_activities(action);

-- Adicionar metadados aos convites
ALTER TABLE organization_invites 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 2. Função para sincronizar dados do auth.users com user_profiles
CREATE OR REPLACE FUNCTION sync_user_profiles_with_auth()
RETURNS VOID AS $$
BEGIN
    -- Atualizar emails dos user_profiles com dados do auth.users
    UPDATE user_profiles 
    SET email = au.email,
        last_sign_in_at = au.last_sign_in_at
    FROM auth.users au
    WHERE user_profiles.user_id = au.id
    AND (user_profiles.email IS NULL OR user_profiles.email != au.email);
    
    -- Criar user_profiles para usuários que não têm
    INSERT INTO user_profiles (user_id, email, first_name, last_name, created_at, last_sign_in_at)
    SELECT 
        au.id,
        au.email,
        COALESCE(au.raw_user_meta_data->>'first_name', ''),
        COALESCE(au.raw_user_meta_data->>'last_name', ''),
        au.created_at,
        au.last_sign_in_at
    FROM auth.users au
    WHERE NOT EXISTS (
        SELECT 1 FROM user_profiles up WHERE up.user_id = au.id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Executar sincronização
SELECT sync_user_profiles_with_auth();

-- 4. Criar super admin para admin@adsmanager.com
DO $$
DECLARE
    v_user_id UUID;
    v_super_admin_role_id UUID;
    v_org_id UUID;
BEGIN
    -- Pegar usuário admin@adsmanager.com
    SELECT id INTO v_user_id 
    FROM auth.users 
    WHERE email = 'admin@adsmanager.com'
    LIMIT 1;
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário admin@adsmanager.com não encontrado';
    END IF;
    
    -- Pegar role de super_admin
    SELECT id INTO v_super_admin_role_id 
    FROM user_roles 
    WHERE name = 'super_admin';
    
    -- Se não existir role de super_admin, criar
    IF v_super_admin_role_id IS NULL THEN
        INSERT INTO user_roles (name, description, permissions)
        VALUES (
            'super_admin', 
            'Super Administrador do Sistema', 
            '["system_admin", "manage_all_orgs", "manage_billing", "manage_users", "manage_clients", "manage_campaigns", "view_reports", "manage_settings"]'::jsonb
        )
        RETURNING id INTO v_super_admin_role_id;
    END IF;
    
    -- Pegar primeira organização ou criar uma
    SELECT id INTO v_org_id 
    FROM organizations 
    ORDER BY created_at ASC 
    LIMIT 1;
    
    IF v_org_id IS NULL THEN
        INSERT INTO organizations (name)
        VALUES ('Organização Admin')
        RETURNING id INTO v_org_id;
    END IF;
    
    -- Verificar se já existe membership
    IF NOT EXISTS (
        SELECT 1 FROM memberships 
        WHERE user_id = v_user_id AND organization_id = v_org_id
    ) THEN
        -- Criar membership como super admin
        INSERT INTO memberships (
            user_id, 
            organization_id, 
            role, 
            role_id, 
            status, 
            accepted_at
        ) VALUES (
            v_user_id,
            v_org_id,
            'super_admin',
            v_super_admin_role_id,
            'active',
            NOW()
        );
    ELSE
        -- Atualizar membership existente
        UPDATE memberships 
        SET 
            role = 'super_admin',
            role_id = v_super_admin_role_id,
            status = 'active',
            accepted_at = COALESCE(accepted_at, NOW())
        WHERE user_id = v_user_id AND organization_id = v_org_id;
    END IF;
    
    RAISE NOTICE 'Super admin criado para usuário: % (%)', v_user_id, 'admin@adsmanager.com';
END $$;

-- 5. RLS Policies para user_activities
ALTER TABLE user_activities ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes se houver
DROP POLICY IF EXISTS "Super admins can view all activities" ON user_activities;
DROP POLICY IF EXISTS "Users can view own activities" ON user_activities;
DROP POLICY IF EXISTS "Super admins can insert activities" ON user_activities;

-- Super admins podem ver todas as atividades
CREATE POLICY "Super admins can view all activities" ON user_activities
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM memberships m
            JOIN user_roles ur ON m.role_id = ur.id
            WHERE m.user_id = auth.uid()
            AND m.status = 'active'
            AND ur.name = 'super_admin'
        )
    );

-- Usuários podem ver suas próprias atividades
CREATE POLICY "Users can view own activities" ON user_activities
    FOR SELECT USING (user_id = auth.uid());

-- Super admins podem inserir atividades
CREATE POLICY "Super admins can insert activities" ON user_activities
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM memberships m
            JOIN user_roles ur ON m.role_id = ur.id
            WHERE m.user_id = auth.uid()
            AND m.status = 'active'
            AND ur.name = 'super_admin'
        )
    );

-- 6. Inserir atividade de exemplo
INSERT INTO user_activities (user_id, action, details, performed_by)
SELECT 
    up.user_id,
    'user_created',
    jsonb_build_object('email', up.email, 'created_via', 'system'),
    up.user_id
FROM user_profiles up
WHERE up.email = 'admin@adsmanager.com'
AND NOT EXISTS (
    SELECT 1 FROM user_activities ua 
    WHERE ua.user_id = up.user_id 
    AND ua.action = 'user_created'
);

-- 7. Verificar se foi criado corretamente
SELECT 
    'VERIFICAÇÃO: Super Admin Criado' as status,
    au.email,
    up.first_name,
    up.last_name,
    m.role,
    ur.name as role_name,
    ur.permissions,
    o.name as organization_name,
    m.status as membership_status
FROM auth.users au
JOIN user_profiles up ON au.id = up.user_id
JOIN memberships m ON au.id = m.user_id
JOIN user_roles ur ON m.role_id = ur.id
JOIN organizations o ON m.organization_id = o.id
WHERE au.email = 'admin@adsmanager.com'
AND ur.name = 'super_admin'
AND m.status = 'active';

-- Comentários
COMMENT ON TABLE user_activities IS 'Histórico de atividades e ações realizadas pelos usuários';
COMMENT ON COLUMN user_profiles.is_suspended IS 'Indica se o usuário está suspenso';
COMMENT ON COLUMN user_profiles.suspended_at IS 'Data e hora da suspensão';
COMMENT ON COLUMN user_profiles.suspended_by IS 'ID do usuário que realizou a suspensão';
COMMENT ON COLUMN user_profiles.suspension_reason IS 'Motivo da suspensão';