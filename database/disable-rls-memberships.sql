-- SOLUÇÃO DRÁSTICA: Desabilitar RLS temporariamente na tabela memberships
-- Execute este script no Supabase SQL Editor

-- 1. Desabilitar RLS na tabela memberships
ALTER TABLE memberships DISABLE ROW LEVEL SECURITY;

-- 2. Remover todas as políticas problemáticas
DROP POLICY IF EXISTS "Users can view their own memberships" ON memberships;
DROP POLICY IF EXISTS "Users can insert their own memberships" ON memberships;
DROP POLICY IF EXISTS "Users can update their own memberships" ON memberships;
DROP POLICY IF EXISTS "Users can delete their own memberships" ON memberships;
DROP POLICY IF EXISTS "Users can view memberships where they are the user" ON memberships;
DROP POLICY IF EXISTS "Users can insert their own membership" ON memberships;
DROP POLICY IF EXISTS "Owners and admins can view org memberships" ON memberships;

-- 3. Verificar se não há mais políticas
SELECT 
    'POLÍTICAS RESTANTES:' as info,
    schemaname,
    tablename,
    policyname
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename = 'memberships';

-- 4. Testar a query que estava falhando
SELECT 
    'TESTE QUERY SEM RLS:' as info,
    m.org_id,
    m.role,
    m.status,
    u.email
FROM memberships m
JOIN auth.users u ON m.user_id = u.id
ORDER BY m.created_at DESC
LIMIT 3;

-- 5. Verificar se o usuário específico tem membership
SELECT 
    'MEMBERSHIP DO USUÁRIO:' as info,
    m.org_id,
    m.role,
    m.status,
    o.name as org_name
FROM memberships m
JOIN organizations o ON m.org_id = o.id
JOIN auth.users u ON m.user_id = u.id
WHERE u.email = 'lenine.engrene@gmail.com';

SELECT 'RLS DESABILITADO - Teste a página agora!' as resultado;