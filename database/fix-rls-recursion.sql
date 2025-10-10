-- Corrigir recursão infinita nas políticas RLS
-- Execute este script no Supabase SQL Editor

-- 1. Remover todas as políticas problemáticas da tabela memberships
DROP POLICY IF EXISTS "Users can view their own memberships" ON memberships;
DROP POLICY IF EXISTS "Users can insert their own memberships" ON memberships;
DROP POLICY IF EXISTS "Users can update their own memberships" ON memberships;
DROP POLICY IF EXISTS "Users can delete their own memberships" ON memberships;

-- 2. Criar políticas RLS mais simples e sem recursão
CREATE POLICY "Users can view memberships where they are the user" ON memberships
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own membership" ON memberships
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners and admins can view org memberships" ON memberships
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM memberships m2 
            WHERE m2.user_id = auth.uid() 
              AND m2.org_id = memberships.org_id 
              AND m2.role IN ('owner', 'admin')
        )
    );

-- 3. Verificar se as políticas foram criadas corretamente
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename = 'memberships'
ORDER BY policyname;

-- 4. Testar a query que estava falhando
SELECT 
    'TESTE QUERY MEMBERSHIPS:' as info,
    m.org_id,
    m.role,
    m.status
FROM memberships m
WHERE m.user_id = auth.uid()
LIMIT 1;

SELECT 'Políticas RLS corrigidas com sucesso!' as resultado;