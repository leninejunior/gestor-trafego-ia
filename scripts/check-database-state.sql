-- Script para verificar o estado atual do banco de dados
-- Execute este script no SQL Editor do Supabase para diagnosticar o problema

-- 1. Verificar se as tabelas existem
SELECT 
    schemaname,
    tablename 
FROM pg_tables 
WHERE tablename IN ('organizations', 'memberships', 'clients')
ORDER BY tablename;

-- 2. Verificar usuários autenticados
SELECT 
    id,
    email,
    created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

-- 3. Verificar organizações existentes
SELECT 
    id,
    name,
    created_at
FROM organizations
ORDER BY created_at DESC;

-- 4. Verificar memberships existentes
SELECT 
    m.id,
    u.email,
    o.name as organization_name,
    m.role,
    m.created_at
FROM memberships m
JOIN auth.users u ON m.user_id = u.id
JOIN organizations o ON m.org_id = o.id
ORDER BY m.created_at DESC;

-- 5. Verificar clientes existentes
SELECT 
    c.id,
    c.name,
    o.name as organization_name,
    c.created_at
FROM clients c
JOIN organizations o ON c.org_id = o.id
ORDER BY c.created_at DESC;

-- 6. Verificar políticas RLS ativas
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename IN ('organizations', 'memberships', 'clients')
ORDER BY tablename, policyname;