-- Script FINAL para garantir que Lenine seja super admin
-- Execute este SQL no Supabase SQL Editor

-- 1. Ver situação atual
SELECT 'SITUAÇÃO ATUAL:' as info;
SELECT 
    au.id,
    au.email,
    m.role,
    m.status
FROM auth.users au
LEFT JOIN memberships m ON au.id = m.user_id
ORDER BY au.created_at;

-- 2. Garantir que lenine.engrene@gmail.com seja super_admin
UPDATE memberships 
SET role = 'super_admin'
WHERE user_id IN (
    SELECT id FROM auth.users WHERE email = 'lenine.engrene@gmail.com'
);

-- 3. Se não existir membership para o Lenine, criar
INSERT INTO memberships (user_id, org_id, role, status, created_at, accepted_at)
SELECT 
    au.id,
    (SELECT id FROM organizations ORDER BY created_at ASC LIMIT 1),
    'super_admin',
    'active',
    NOW(),
    NOW()
FROM auth.users au
WHERE au.email = 'lenine.engrene@gmail.com'
AND NOT EXISTS (
    SELECT 1 FROM memberships m WHERE m.user_id = au.id
);

-- 4. Garantir que existe user_profile para o Lenine
INSERT INTO user_profiles (user_id, email, first_name, last_name, created_at)
SELECT 
    au.id,
    au.email,
    'Lenine',
    'Engrene',
    au.created_at
FROM auth.users au
WHERE au.email = 'lenine.engrene@gmail.com'
AND NOT EXISTS (
    SELECT 1 FROM user_profiles up WHERE up.user_id = au.id
);

-- 5. Atualizar user_profile existente
UPDATE user_profiles 
SET 
    email = 'lenine.engrene@gmail.com',
    first_name = COALESCE(first_name, 'Lenine'),
    last_name = COALESCE(last_name, 'Engrene')
WHERE user_id IN (
    SELECT id FROM auth.users WHERE email = 'lenine.engrene@gmail.com'
);

-- 6. Verificar resultado final
SELECT 'RESULTADO FINAL:' as info;
SELECT 
    au.id,
    au.email,
    up.first_name,
    up.last_name,
    m.role,
    m.status,
    'LENINE É SUPER ADMIN!' as confirmacao
FROM auth.users au
LEFT JOIN user_profiles up ON au.id = up.user_id
LEFT JOIN memberships m ON au.id = m.user_id
WHERE au.email = 'lenine.engrene@gmail.com';

-- 7. Mostrar todos os usuários
SELECT 'TODOS OS USUÁRIOS:' as info;
SELECT 
    au.id,
    au.email,
    up.first_name,
    up.last_name,
    m.role,
    m.status
FROM auth.users au
LEFT JOIN user_profiles up ON au.id = up.user_id
LEFT JOIN memberships m ON au.id = m.user_id
ORDER BY au.created_at;