-- Script para identificar qual usuário é o Lenine
-- Execute este SQL no Supabase SQL Editor

-- 1. Verificar qual ID corresponde ao lenine.engrene@gmail.com
SELECT 
    'IDENTIFICANDO LENINE:' as info,
    au.id,
    au.email,
    up.first_name,
    up.last_name,
    m.role,
    m.status
FROM auth.users au
LEFT JOIN user_profiles up ON au.id = up.user_id
LEFT JOIN memberships m ON au.id = m.user_id
WHERE au.email = 'lenine.engrene@gmail.com';

-- 2. Verificar todos os usuários com seus IDs
SELECT 
    'TODOS OS USUÁRIOS COM IDS:' as info,
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

-- 3. Se lenine não for super_admin, torná-lo super_admin
UPDATE memberships 
SET role = 'super_admin'
WHERE user_id = (
    SELECT id FROM auth.users WHERE email = 'lenine.engrene@gmail.com'
)
AND role != 'super_admin';

-- 4. Verificar resultado
SELECT 
    'RESULTADO FINAL:' as info,
    au.id,
    au.email,
    m.role,
    m.status
FROM auth.users au
JOIN memberships m ON au.id = m.user_id
WHERE au.email = 'lenine.engrene@gmail.com';