-- Correção: Impedir criação automática de admin para novos usuários
-- Este script remove usuários que foram criados automaticamente como admin

-- 1. Verificar usuários que foram criados recentemente com organizações automáticas
SELECT 
    u.id,
    u.email,
    u.created_at as user_created,
    o.name as org_name,
    o.created_at as org_created,
    m.role,
    m.created_at as membership_created
FROM auth.users u
JOIN memberships m ON u.id = m.user_id
JOIN organizations o ON m.org_id = o.id
WHERE u.email = 'leninejunior@gmail.com'
ORDER BY u.created_at DESC;

-- 2. Remover o usuário leninejunior@gmail.com se foi criado incorretamente
-- ATENÇÃO: Só execute se tiver certeza que quer remover este usuário

-- Primeiro, remover dados relacionados
DELETE FROM memberships 
WHERE user_id IN (
    SELECT id FROM auth.users WHERE email = 'leninejunior@gmail.com'
);

-- Remover organizações órfãs (sem membros)
DELETE FROM organizations 
WHERE id NOT IN (
    SELECT DISTINCT org_id FROM memberships WHERE org_id IS NOT NULL
);

-- Remover perfil do usuário
DELETE FROM user_profiles 
WHERE user_id IN (
    SELECT id FROM auth.users WHERE email = 'leninejunior@gmail.com'
);

-- Por último, remover o usuário (isso deve ser feito no Supabase Auth Dashboard)
-- DELETE FROM auth.users WHERE email = 'leninejunior@gmail.com';

-- 3. Verificar se a limpeza foi bem-sucedida
SELECT 
    'Usuários restantes' as tipo,
    COUNT(*) as quantidade
FROM auth.users
UNION ALL
SELECT 
    'Organizações restantes' as tipo,
    COUNT(*) as quantidade
FROM organizations
UNION ALL
SELECT 
    'Memberships restantes' as tipo,
    COUNT(*) as quantidade
FROM memberships;