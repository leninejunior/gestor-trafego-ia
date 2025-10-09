-- Script para verificar todas as políticas RLS existentes
-- Execute este SQL no Supabase Dashboard para diagnóstico

-- 1. Listar todas as políticas da tabela client_meta_connections
SELECT 
    schemaname as "Schema",
    tablename as "Tabela", 
    policyname as "Nome da Política",
    cmd as "Operação",
    permissive as "Permissiva",
    qual as "Condição WHERE",
    with_check as "Condição WITH CHECK"
FROM pg_policies 
WHERE tablename = 'client_meta_connections'
ORDER BY cmd, policyname;

-- 2. Verificar se RLS está habilitado na tabela
SELECT 
    schemaname,
    tablename,
    rowsecurity as "RLS Habilitado"
FROM pg_tables 
WHERE tablename = 'client_meta_connections';

-- 3. Testar se as políticas estão funcionando (como usuário autenticado)
-- Esta query deve retornar apenas as conexões que o usuário tem acesso
SELECT 
    cmc.id,
    cmc.account_name,
    cmc.client_id,
    c.name as client_name,
    c.org_id,
    'Usuário tem acesso' as status
FROM client_meta_connections cmc
JOIN clients c ON cmc.client_id = c.id
JOIN memberships m ON c.org_id = m.org_id
WHERE m.user_id = auth.uid()
LIMIT 5;

-- 4. Verificar se existem conexões sem acesso (não devem aparecer)
SELECT 
    COUNT(*) as "Total de Conexões no Sistema",
    COUNT(CASE WHEN m.user_id = auth.uid() THEN 1 END) as "Conexões com Acesso",
    COUNT(CASE WHEN m.user_id != auth.uid() OR m.user_id IS NULL THEN 1 END) as "Conexões sem Acesso"
FROM client_meta_connections cmc
JOIN clients c ON cmc.client_id = c.id
LEFT JOIN memberships m ON c.org_id = m.org_id;