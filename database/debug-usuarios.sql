-- Script para debugar problema dos usuários
-- Execute este SQL no Supabase SQL Editor

-- 1. Verificar usuários na tabela auth.users
SELECT 'USUÁRIOS EM AUTH.USERS:' as info, COUNT(*) as total FROM auth.users;
SELECT id, email, created_at FROM auth.users ORDER BY created_at;

-- 2. Verificar user_profiles
SELECT 'USUÁRIOS EM USER_PROFILES:' as info, COUNT(*) as total FROM user_profiles;
SELECT user_id, email, first_name, last_name FROM user_profiles ORDER BY created_at;

-- 3. Verificar memberships
SELECT 'MEMBERSHIPS:' as info, COUNT(*) as total FROM memberships;
SELECT user_id, org_id, role, status FROM memberships;

-- 4. Verificar user_roles
SELECT 'USER_ROLES:' as info, COUNT(*) as total FROM user_roles;
SELECT id, name, permissions FROM user_roles;

-- 5. Verificar organizations
SELECT 'ORGANIZATIONS:' as info, COUNT(*) as total FROM organizations;
SELECT id, name FROM organizations;

-- 6. Query completa que a API deveria usar
SELECT 
    'QUERY COMPLETA:' as info,
    up.user_id,
    up.first_name,
    up.last_name,
    up.email,
    up.created_at,
    up.last_sign_in_at,
    up.is_suspended,
    m.role,
    m.status as membership_status,
    ur.name as role_name,
    o.name as org_name
FROM user_profiles up
LEFT JOIN memberships m ON up.user_id = m.user_id
LEFT JOIN user_roles ur ON m.role_id = ur.id
LEFT JOIN organizations o ON m.org_id = o.id
ORDER BY up.created_at;

-- 7. Verificar se lenine tem super admin
SELECT 
    'LENINE SUPER ADMIN:' as info,
    au.email,
    m.role,
    ur.name as role_name,
    m.status
FROM auth.users au
LEFT JOIN memberships m ON au.id = m.user_id
LEFT JOIN user_roles ur ON m.role_id = ur.id
WHERE au.email = 'lenine.engrene@gmail.com';

-- 8. Testar política RLS
SELECT 
    'TESTE RLS:' as info,
    auth.uid() as current_user_id,
    (SELECT email FROM auth.users WHERE id = auth.uid()) as current_user_email;

-- 9. Verificar se existe super admin ativo
SELECT 
    'SUPER ADMINS ATIVOS:' as info,
    au.email,
    m.role,
    ur.name,
    m.status
FROM auth.users au
JOIN memberships m ON au.id = m.user_id
JOIN user_roles ur ON m.role_id = ur.id
WHERE ur.name = 'super_admin'
AND m.status = 'active';