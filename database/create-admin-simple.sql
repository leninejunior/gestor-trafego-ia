-- Script SIMPLES para criar super admin
-- Execute este SQL no Supabase SQL Editor

-- 1. Ver usuários existentes
SELECT 'USUÁRIOS DISPONÍVEIS:' as info, id, email, created_at FROM auth.users ORDER BY created_at;

-- 2. Aplicar schema básico
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

ALTER TABLE organization_invites 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 3. Criar role super_admin se não existir
INSERT INTO user_roles (name, description, permissions)
SELECT 
    'super_admin', 
    'Super Administrador do Sistema', 
    '["system_admin", "manage_all_orgs", "manage_billing", "manage_users", "manage_clients", "manage_campaigns", "view_reports", "manage_settings"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM user_roles WHERE name = 'super_admin');

-- 4. Criar organização se não existir
INSERT INTO organizations (name)
SELECT 'Organização Admin'
WHERE NOT EXISTS (SELECT 1 FROM organizations);

-- 5. Sincronizar user_profiles
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

-- 6. Tornar o PRIMEIRO usuário super admin
INSERT INTO memberships (user_id, organization_id, role, role_id, status, accepted_at)
SELECT 
    (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1),
    (SELECT id FROM organizations ORDER BY created_at ASC LIMIT 1),
    'super_admin',
    (SELECT id FROM user_roles WHERE name = 'super_admin'),
    'active',
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM memberships m
    JOIN user_roles ur ON m.role_id = ur.id
    WHERE ur.name = 'super_admin'
    AND m.status = 'active'
);

-- 7. Atualizar membership existente se necessário
UPDATE memberships 
SET 
    role = 'super_admin',
    role_id = (SELECT id FROM user_roles WHERE name = 'super_admin'),
    status = 'active',
    accepted_at = COALESCE(accepted_at, NOW())
WHERE user_id = (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
AND organization_id = (SELECT id FROM organizations ORDER BY created_at ASC LIMIT 1);

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
    'SUPER ADMIN CRIADO:' as resultado,
    au.email,
    m.role,
    ur.name as role_name,
    m.status
FROM auth.users au
JOIN memberships m ON au.id = m.user_id
JOIN user_roles ur ON m.role_id = ur.id
WHERE ur.name = 'super_admin'
AND m.status = 'active';

-- 10. Mostrar todos os usuários e suas roles
SELECT 
    'TODOS OS USUÁRIOS:' as info,
    au.email,
    COALESCE(m.role, 'sem_role') as role,
    COALESCE(ur.name, 'sem_role') as role_name,
    COALESCE(m.status, 'sem_membership') as status
FROM auth.users au
LEFT JOIN memberships m ON au.id = m.user_id
LEFT JOIN user_roles ur ON m.role_id = ur.id
ORDER BY au.created_at;