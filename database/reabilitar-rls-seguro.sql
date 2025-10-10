-- Reabilitar RLS na tabela memberships com políticas seguras
-- Execute este script no Supabase SQL Editor

-- 1. Reabilitar RLS na tabela memberships
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;

-- 2. Criar políticas RLS simples e seguras (sem recursão)

-- Política para SELECT: usuários podem ver apenas seus próprios memberships
CREATE POLICY "Users can view their own memberships" ON memberships
    FOR SELECT USING (user_id = auth.uid());

-- Política para INSERT: usuários podem inserir apenas seus próprios memberships
CREATE POLICY "Users can insert their own memberships" ON memberships
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Política para UPDATE: usuários podem atualizar apenas seus próprios memberships
CREATE POLICY "Users can update their own memberships" ON memberships
    FOR UPDATE USING (user_id = auth.uid());

-- 3. Testar as políticas
SELECT 
    'TESTE RLS REABILITADO:' as info,
    m.org_id,
    m.role,
    m.status
FROM memberships m
WHERE m.user_id = auth.uid()
LIMIT 1;

-- 4. Verificar políticas criadas
SELECT 
    'POLÍTICAS ATIVAS:' as info,
    policyname,
    cmd
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename = 'memberships'
ORDER BY policyname;

SELECT 'RLS reabilitado com políticas seguras!' as resultado;