-- ============================================================
-- FIX: Adicionar coluna token_expires_at na tabela google_ads_connections
-- ============================================================
-- PROBLEMA: Coluna token_expires_at não existe, causando erro no OAuth
-- SOLUÇÃO: Adicionar a coluna e atualizar conexões existentes
-- ============================================================

-- 1. Adicionar coluna token_expires_at se não existir
ALTER TABLE google_ads_connections 
ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;

-- 2. Atualizar conexões existentes com data de expiração padrão (1 hora a partir de agora)
UPDATE google_ads_connections 
SET token_expires_at = NOW() + INTERVAL '1 hour'
WHERE token_expires_at IS NULL;

-- 3. Verificar estrutura da tabela
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'google_ads_connections'
ORDER BY ordinal_position;

-- ============================================================
-- RESULTADO ESPERADO:
-- ============================================================
-- A tabela deve ter as seguintes colunas:
-- - id (uuid)
-- - client_id (uuid)
-- - user_id (uuid)
-- - access_token (text)
-- - refresh_token (text)
-- - token_expires_at (timestamptz) ← NOVA COLUNA
-- - customer_id (text)
-- - status (text)
-- - selected_accounts (jsonb)
-- - created_at (timestamptz)
-- - updated_at (timestamptz)
-- ============================================================
