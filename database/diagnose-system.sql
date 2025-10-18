-- Script de diagnóstico completo do sistema
-- Execute este script no SQL Editor do Supabase para verificar o estado do sistema

-- ============================================================================
-- 1. VERIFICAR USUÁRIO ATUAL
-- ============================================================================
SELECT 
    'USUÁRIO ATUAL' as secao,
    auth.uid() as user_id,
    u.email,
    u.created_at
FROM auth.users u
WHERE u.id = auth.uid();

-- ============================================================================
-- 2. VERIFICAR ORGANIZAÇÕES
-- ============================================================================
SELECT 
    'ORGANIZAÇÕES' as secao,
    id,
    name,
    created_at
FROM organizations
ORDER BY created_at DESC;

-- ============================================================================
-- 3. VERIFICAR MEMBERSHIPS DO USUÁRIO ATUAL
-- ============================================================================
SELECT 
    'MEMBERSHIPS DO USUÁRIO' as secao,
    m.id,
    m.user_id,
    m.org_id,
    o.name as organization_name,
    m.role,
    m.created_at
FROM memberships m
JOIN organizations o ON m.org_id = o.id
WHERE m.user_id = auth.uid();

-- ============================================================================
-- 4. VERIFICAR CLIENTES
-- ============================================================================
SELECT 
    'CLIENTES' as secao,
    c.id,
    c.name,
    c.org_id,
    o.name as organization_name,
    c.created_at
FROM clients c
JOIN organizations o ON c.org_id = o.id
ORDER BY c.created_at DESC;

-- ============================================================================
-- 5. VERIFICAR CLIENTES ACESSÍVEIS PELO USUÁRIO ATUAL
-- ============================================================================
SELECT 
    'CLIENTES ACESSÍVEIS' as secao,
    c.id,
    c.name,
    c.org_id,
    o.name as organization_name
FROM clients c
JOIN organizations o ON c.org_id = o.id
WHERE c.org_id IN (
    SELECT org_id FROM memberships 
    WHERE user_id = auth.uid()
);

-- ============================================================================
-- 6. VERIFICAR CONEXÕES META
-- ============================================================================
SELECT 
    'CONEXÕES META' as secao,
    cmc.id,
    cmc.client_id,
    c.name as client_name,
    cmc.ad_account_id,
    cmc.account_name,
    cmc.is_active,
    cmc.created_at
FROM client_meta_connections cmc
JOIN clients c ON cmc.client_id = c.id
ORDER BY cmc.created_at DESC;

-- ============================================================================
-- 7. VERIFICAR POLÍTICAS RLS
-- ============================================================================
SELECT 
    'POLÍTICAS RLS' as secao,
    tablename,
    policyname,
    cmd,
    permissive
FROM pg_policies 
WHERE tablename IN ('organizations', 'memberships', 'clients', 'client_meta_connections')
ORDER BY tablename, policyname;

-- ============================================================================
-- 8. VERIFICAR TABELAS COM RLS HABILITADO
-- ============================================================================
SELECT 
    'TABELAS COM RLS' as secao,
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename IN ('organizations', 'memberships', 'clients', 'client_meta_connections')
ORDER BY tablename;

-- ============================================================================
-- 9. VERIFICAR ESTRUTURA DA TABELA MEMBERSHIPS
-- ============================================================================
SELECT 
    'ESTRUTURA MEMBERSHIPS' as secao,
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'memberships'
ORDER BY ordinal_position;

-- ============================================================================
-- 10. VERIFICAR ESTRUTURA DA TABELA CLIENTS
-- ============================================================================
SELECT 
    'ESTRUTURA CLIENTS' as secao,
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'clients'
ORDER BY ordinal_position;

-- ============================================================================
-- RESUMO
-- ============================================================================
SELECT 
    'RESUMO' as secao,
    (SELECT COUNT(*) FROM organizations) as total_organizations,
    (SELECT COUNT(*) FROM memberships WHERE user_id = auth.uid()) as user_memberships,
    (SELECT COUNT(*) FROM clients) as total_clients,
    (SELECT COUNT(*) FROM clients WHERE org_id IN (
        SELECT org_id FROM memberships WHERE user_id = auth.uid()
    )) as accessible_clients,
    (SELECT COUNT(*) FROM client_meta_connections) as total_meta_connections;