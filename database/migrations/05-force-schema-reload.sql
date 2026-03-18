-- =====================================================
-- Force Schema Reload - Google Ads Audit Log
-- =====================================================
-- Este script força o Supabase a recarregar o schema
-- da tabela google_ads_audit_log
-- =====================================================

-- 1. Verificar se a coluna client_id existe
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'google_ads_audit_log' 
    AND column_name = 'client_id'
  ) THEN
    RAISE NOTICE 'Coluna client_id NÃO existe - será criada';
    
    -- Adicionar coluna client_id se não existir
    ALTER TABLE google_ads_audit_log 
    ADD COLUMN client_id UUID REFERENCES clients(id) ON DELETE CASCADE;
    
    -- Criar índice
    CREATE INDEX IF NOT EXISTS idx_google_audit_client 
    ON google_ads_audit_log(client_id, created_at DESC);
    
    RAISE NOTICE 'Coluna client_id criada com sucesso';
  ELSE
    RAISE NOTICE 'Coluna client_id JÁ existe';
  END IF;
END $$;

-- 2. Forçar reload do cache do PostgREST (Supabase API)
-- Isso é feito através de uma notificação que o PostgREST escuta
NOTIFY pgrst, 'reload schema';

-- 3. Verificar estrutura final da tabela
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'google_ads_audit_log'
ORDER BY ordinal_position;

-- 4. Verificar políticas RLS
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'google_ads_audit_log';

-- =====================================================
-- Resultado Esperado
-- =====================================================
-- A tabela google_ads_audit_log deve ter:
-- - id (uuid)
-- - client_id (uuid) ← ESTA COLUNA DEVE EXISTIR
-- - connection_id (uuid)
-- - user_id (uuid)
-- - operation (text)
-- - resource_type (text)
-- - resource_id (text)
-- - action (text)
-- - details (jsonb)
-- - metadata (jsonb)
-- - success (boolean)
-- - error_message (text)
-- - sensitive_data (boolean)
-- - ip_address (inet)
-- - user_agent (text)
-- - created_at (timestamptz)
-- =====================================================
