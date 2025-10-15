-- Script para criar super admin temporário
-- Execute este SQL no Supabase SQL Editor

-- 1. Verificar usuário atual logado
SELECT 
    au.id,
    au.email,
    up.first_name,
    up.last_name
FROM auth.users au
LEFT JOIN user_profiles up ON au.id = up.user_id
ORDER BY au.created_at DESC
LIMIT 5;

-- 2. Buscar role de super_admin
SELECT id, name, permissions FROM user_roles WHERE name = 'super_admin';

-- 3. Criar super admin para o primeiro usuário (substitua o ID se necessário)
DO $$
DECLARE
    v_user_id UUID;
    v_super_admin_role_id UUID;
    v_org_id UUID;
BEGIN
    -- Pegar o primeiro usuário
    SELECT id INTO v_user_id 
    FROM auth.users 
    ORDER BY created_at ASC 
    LIMIT 1;
    
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
    
    RAISE NOTICE 'Super admin criado para usuário: %', v_user_id;
END $$;

-- 4. Verificar se foi criado corretamente
SELECT 
    au.email,
    up.first_name,
    up.last_name,
    m.role,
    ur.name as role_name,
    ur.permissions,
    o.name as organization_name
FROM auth.users au
JOIN user_profiles up ON au.id = up.user_id
JOIN memberships m ON au.id = m.user_id
JOIN user_roles ur ON m.role_id = ur.id
JOIN organizations o ON m.organization_id = o.id
WHERE ur.name = 'super_admin'
AND m.status = 'active';

-- 5. Aplicar schema de usuários se ainda não foi aplicado
-- (Copie e cole o conteúdo de user-management-simple.sql aqui se necessário)