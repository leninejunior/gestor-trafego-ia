-- =====================================================
-- Fix Google Ads RLS Policy
-- Alinha política RLS com APIs simplificadas
-- =====================================================

-- Remover política existente que usa organization_memberships
DROP POLICY IF EXISTS "Users can only access their client's Google connections" ON google_ads_connections;

-- Criar política simplificada (apenas usuários autenticados)
CREATE POLICY "Authenticated users can access Google connections"
  ON google_ads_connections
  FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Comentário para referência futura
COMMENT ON POLICY "Authenticated users can access Google connections" ON google_ads_connections IS 
'Política temporária simplificada para alinhar com APIs Google Auth e Callback que foram simplificadas. Pode ser refinada posteriormente.';

-- Verificar se a política foi aplicada
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'google_ads_connections';