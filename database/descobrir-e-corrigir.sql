-- Script para descobrir estrutura e corrigir
-- Execute este SQL no Supabase SQL Editor

-- 1. Descobrir estrutura da tabela memberships
SELECT 'COLUNAS DA TABELA MEMBERSHIPS:' as info;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'memberships' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Ver dados atuais da tabela memberships
SELECT 'DADOS ATUAIS MEMBERSHIPS:' as info;
SELECT * FROM memberships;

-- 3. Ver usuários
SELECT 'USUÁRIOS:' as info;
SELECT id, email FROM auth.users;

-- 4. Apenas atualizar role do Lenine (sem inserir)
UPDATE memberships 
SET role = 'super_admin'
WHERE user_id IN (
    SELECT id FROM auth.users WHERE email = 'lenine.engrene@gmail.com'
);

-- 5. Garantir user_profile para Lenine
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
)
ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = COALESCE(user_profiles.first_name, EXCLUDED.first_name),
    last_name = COALESCE(user_profiles.last_name, EXCLUDED.last_name);

-- 6. Verificar resultado
SELECT 'RESULTADO:' as info;
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