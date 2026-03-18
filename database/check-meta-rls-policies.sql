-- Verificar políticas RLS das tabelas Meta

-- 1. Verificar se RLS está habilitado
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename IN ('meta_campaigns', 'meta_adsets', 'meta_ads', 'client_meta_connections')
ORDER BY tablename;

-- 2. Listar todas as políticas
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('meta_campaigns', 'meta_adsets', 'meta_ads', 'client_meta_connections')
ORDER BY tablename, policyname;

-- 3. Verificar colunas de relacionamento
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name IN ('meta_campaigns', 'meta_adsets', 'meta_ads')
  AND column_name IN ('connection_id', 'campaign_id', 'adset_id', 'client_id')
ORDER BY table_name, column_name;
