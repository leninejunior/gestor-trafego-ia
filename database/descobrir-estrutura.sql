-- Script para descobrir a estrutura real das tabelas
-- Execute este SQL no Supabase SQL Editor

-- 1. Descobrir estrutura da tabela memberships
SELECT 'ESTRUTURA DA TABELA MEMBERSHIPS:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'memberships' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Descobrir estrutura da tabela user_profiles
SELECT 'ESTRUTURA DA TABELA USER_PROFILES:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Descobrir estrutura da tabela organizations
SELECT 'ESTRUTURA DA TABELA ORGANIZATIONS:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'organizations' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. Descobrir estrutura da tabela user_roles
SELECT 'ESTRUTURA DA TABELA USER_ROLES:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'user_roles' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 5. Ver dados da tabela memberships (primeiras 5 linhas)
SELECT 'DADOS DA TABELA MEMBERSHIPS:' as info;
SELECT * FROM memberships LIMIT 5;

-- 6. Ver dados da tabela user_profiles (primeiras 5 linhas)
SELECT 'DADOS DA TABELA USER_PROFILES:' as info;
SELECT * FROM user_profiles LIMIT 5;

-- 7. Ver dados da tabela organizations
SELECT 'DADOS DA TABELA ORGANIZATIONS:' as info;
SELECT * FROM organizations LIMIT 5;

-- 8. Ver dados da tabela user_roles
SELECT 'DADOS DA TABELA USER_ROLES:' as info;
SELECT * FROM user_roles LIMIT 5;

-- 9. Verificar usuários na tabela auth.users
SELECT 'USUÁRIOS EM AUTH.USERS:' as info;
SELECT id, email, created_at FROM auth.users ORDER BY created_at LIMIT 5;

-- 10. Tentar query simples com a estrutura que existe
SELECT 'QUERY SIMPLES MEMBERSHIPS:' as info;
SELECT 
    user_id,
    role,
    status,
    created_at
FROM memberships 
LIMIT 5;