-- Corrigir estrutura da tabela google_ads_encryption_keys
-- Execute este SQL no SQL Editor do Supabase

-- Adicionar colunas que faltam
ALTER TABLE google_ads_encryption_keys 
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

ALTER TABLE google_ads_encryption_keys 
ADD COLUMN IF NOT EXISTS algorithm TEXT DEFAULT 'aes-256-gcm';

ALTER TABLE google_ads_encryption_keys 
ADD COLUMN IF NOT EXISTS connection_id UUID;

-- Adicionar referência à tabela de conexões (opcional, pode falhar se houver dados inconsistentes)
-- ALTER TABLE google_ads_encryption_keys 
-- ADD CONSTRAINT fk_google_ads_encryption_keys_connection 
-- FOREIGN KEY (connection_id) REFERENCES google_ads_connections(id);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_google_ads_encryption_keys_version 
ON google_ads_encryption_keys (version DESC);

CREATE INDEX IF NOT EXISTS idx_google_ads_encryption_keys_connection 
ON google_ads_encryption_keys (connection_id);

-- Atualizar registros existentes para ter version = 1
UPDATE google_ads_encryption_keys 
SET version = 1 
WHERE version IS NULL;

-- Verificar estrutura final
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'google_ads_encryption_keys' 
ORDER BY ordinal_position;