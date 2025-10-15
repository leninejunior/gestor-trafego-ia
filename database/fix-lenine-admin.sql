-- Script para tornar lenine.engrene@gmail.com super admin
-- Execute este SQL no Supabase SQL Editor

-- 1. Verificar se o usuário lenine.engrene@gmail.com existe
SELECT 'VERIFICANDO USUÁRIO LENINE:' as info, id, email, created_at 
FROM auth.users 
WHERE email = 'lenine.engrene@gmail.com';

-- 2. Aplicar schema básico primeiro
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

ALTER TABLE memberships 
ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS removed_by UUID REFERENCES auth.users(id);

CREATE TABLE IF NOT EXISTS user_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    details JSONB,
    performed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_activities_user_id ON user_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activities_created_at ON user_activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activities_action ON user_activities(action);

ALTER TABLE organization_invites 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 3. Sincronizar user_profiles
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

-- 4. Atualizar user_profiles existentes
UPDATE user_profiles 
SET email = au.email,
    last_sign_in_at = au.last_sign_in_at
FROM auth.users au
WHERE user_profiles.user_id = au.id
AND (user_profiles.email IS NULL OR user_profiles.email != au.email);

-- 5. Criar role super_admin se não existir
INSERT INTO user_roles (name, description, permissions)
SELECT 
    'super_admin', 
    'Super Administrador do Sistema', 
    '["system_admin", "manage_all_orgs", "manage_billing", "manage_users", "manage_clients", "manage_campaigns", "view_reports", "manage_settings"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM user_roles WHERE name = 'super_admin');

-- 6. Criar organização se não existir
INSERT INTO organizations (name)
SELECT 'Organização Admin'
WHERE NOT EXISTS (SELECT 1 FROM organizations);

-- 7. Tornar lenine.engrene@gmail.com super admin
DO $$
DECLARE
    v_user_id UUID;
    v_super_admin_role_id UUID;
    v_org_id UUID;
BEGIN
    -- Pegar usuário lenine.engrene@gmail.com
    SELECT id INTO v_user_id 
    FROM auth.users 
    WHERE email = 'lenine.engrene@gmail.com'
    LIMIT 1;
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário lenine.engrene@gmail.com não encontrado';
    END IF;
    
    -- Pegar role de super_admin
    SELECT id INTO v_super_admin_role_id 
    FROM user_roles 
    WHERE name = 'super_admin';
    
    -- Pegar primeira organização
    SELECT id INTO v_org_id 
    FROM organizations 
    ORDER BY created_at ASC 
    LIMIT 1;
    
    -- Verificar se já existe membership
    IF NOT EXISTS (
        SELECT 1 FROM memberships 
        WHERE user_id = v_user_id AND org_id = v_org_id
    ) THEN
        -- Criar membership como super admin
        INSERT INTO memberships (
            user_id, 
            org_id, 
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
        WHERE user_id = v_user_id AND org_id = v_org_id;
    END IF;
    
    RAISE NOTICE 'Super admin criado para usuário: % (lenine.engrene@gmail.com)', v_user_id;
END $$;

-- 8. Configurar RLS
ALTER TABLE user_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can view all activities" ON user_activities;
DROP POLICY IF EXISTS "Users can view own activities" ON user_activities;
DROP POLICY IF EXISTS "Super admins can insert activities" ON user_activities;

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

CREATE POLICY "Users can view own activities" ON user_activities
    FOR SELECT USING (user_id = auth.uid());

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

-- 9. Verificar resultado
SELECT 
    'SUPER ADMIN CRIADO PARA LENINE:' as resultado,
    au.email,
    m.role,
    ur.name as role_name,
    m.status,
    o.name as organization_name
FROM auth.users au
JOIN memberships m ON au.id = m.user_id
JOIN user_roles ur ON m.role_id = ur.id
JOIN organizations o ON m.org_id = o.id
WHERE au.email = 'lenine.engrene@gmail.com'
AND ur.name = 'super_admin'
AND m.status = 'active';

-- 10. Inserir atividade de exemplo
INSERT INTO user_activities (user_id, action, details, performed_by)
SELECT 
    au.id,
    'super_admin_created',
    jsonb_build_object('email', au.email, 'created_via', 'script'),
    au.id
FROM auth.users au
WHERE au.email = 'lenine.engrene@gmail.com'
AND NOT EXISTS (
    SELECT 1 FROM user_activities ua 
    WHERE ua.user_id = au.id 
    AND ua.action = 'super_admin_created'
);

-- 11. Mostrar status final
SELECT 
    'STATUS FINAL:' as info,
    au.email,
    up.first_name,
    up.last_name,
    COALESCE(m.role, 'sem_role') as role,
    COALESCE(ur.name, 'sem_role') as role_name,
    COALESCE(m.status, 'sem_membership') as status
FROM auth.users au
LEFT JOIN user_profiles up ON au.id = up.user_id
LEFT JOIN memberships m ON au.id = m.user_id
LEFT JOIN user_roles ur ON m.role_id = ur.id
WHERE au.email = 'lenine.engrene@gmail.com';