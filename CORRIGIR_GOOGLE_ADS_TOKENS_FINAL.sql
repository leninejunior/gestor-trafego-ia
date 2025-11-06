-- EXECUTAR NO SUPABASE - Correção Final dos Tokens Google Ads
-- Copie e cole este SQL no SQL Editor do Supabase

-- 1. Limpar dados inconsistentes
DELETE FROM google_ads_encryption_keys WHERE connection_id IS NULL;

-- 2. Adicionar colunas que faltam na tabela de chaves de criptografia
ALTER TABLE google_ads_encryption_keys 
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

ALTER TABLE google_ads_encryption_keys 
ADD COLUMN IF NOT EXISTS algorithm TEXT DEFAULT 'aes-256-gcm';

ALTER TABLE google_ads_encryption_keys 
ADD COLUMN IF NOT EXISTS connection_id UUID;

-- 3. Atualizar registros existentes
UPDATE google_ads_encryption_keys 
SET version = 1 
WHERE version IS NULL;

-- 4. Adicionar colunas que faltam na tabela de conexões (se necessário)
ALTER TABLE google_ads_connections 
ADD COLUMN IF NOT EXISTS customer_id TEXT DEFAULT 'pending';

ALTER TABLE google_ads_connections 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- 5. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_google_ads_encryption_keys_version 
ON google_ads_encryption_keys (version DESC);

CREATE INDEX IF NOT EXISTS idx_google_ads_encryption_keys_connection 
ON google_ads_encryption_keys (connection_id);

-- 6. Verificar estrutura final
SELECT 'google_ads_connections' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'google_ads_connections' 
ORDER BY ordinal_position;

SELECT 'google_ads_encryption_keys' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'google_ads_encryption_keys' 
ORDER BY ordinal_position;