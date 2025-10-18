-- Script para verificar e corrigir políticas RLS da tabela clients
-- Execute este script no SQL Editor do Supabase

-- 1. Verificar políticas RLS existentes para clients
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'clients'
ORDER BY policyname;

-- 2. Verificar se RLS está habilitado
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'clients';

-- 3. Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Users can view their own clients" ON clients;
DROP POLICY IF EXISTS "Users can insert their own clients" ON clients;
DROP POLICY IF EXISTS "Users can update their own clients" ON clients;
DROP POLICY IF EXISTS "Users can delete their own clients" ON clients;

-- 4. Criar políticas RLS corretas
-- Política para SELECT (visualizar)
CREATE POLICY "Users can view their organization clients" ON clients
    FOR SELECT USING (
        org_id IN (
            SELECT org_id FROM memberships 
            WHERE user_id = auth.uid()
        )
    );

-- Política para INSERT (criar)
CREATE POLICY "Users can insert clients in their organization" ON clients
    FOR INSERT WITH CHECK (
        org_id IN (
            SELECT org_id FROM memberships 
            WHERE user_id = auth.uid()
        )
    );

-- Política para UPDATE (atualizar)
CREATE POLICY "Users can update their organization clients" ON clients
    FOR UPDATE USING (
        org_id IN (
            SELECT org_id FROM memberships 
            WHERE user_id = auth.uid()
        )
    );

-- Política para DELETE (deletar)
CREATE POLICY "Users can delete their organization clients" ON clients
    FOR DELETE USING (
        org_id IN (
            SELECT org_id FROM memberships 
            WHERE user_id = auth.uid()
        )
    );

-- 5. Garantir que RLS está habilitado
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- 6. Verificar o resultado
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename = 'clients'
ORDER BY policyname;

-- 7. Testar se o usuário atual pode ver clientes
SELECT 
    c.id,
    c.name,
    c.org_id,
    o.name as organization_name,
    c.created_at
FROM clients c
JOIN organizations o ON c.org_id = o.id
WHERE c.org_id IN (
    SELECT org_id FROM memberships 
    WHERE user_id = auth.uid()
)
ORDER BY c.created_at DESC;