-- ============================================================================
-- COPIE E COLE ISTO NO SUPABASE SQL EDITOR
-- ============================================================================

-- 1. Adicionar colunas que faltam na tabela google_ads_encryption_keys
ALTER TABLE google_ads_encryption_keys 
ADD COLUMN IF NOT EXISTS algorithm VARCHAR(50) DEFAULT 'aes-256-gcm';

ALTER TABLE google_ads_encryption_keys 
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

ALTER TABLE google_ads_encryption_keys 
ADD COLUMN IF NOT EXISTS key_hash TEXT;

ALTER TABLE google_ads_encryption_keys 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days');

-- 2. Adicionar colunas que faltam na tabela google_ads_audit_log
ALTER TABLE google_ads_audit_log 
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE CASCADE;

ALTER TABLE google_ads_audit_log 
ADD COLUMN IF NOT EXISTS connection_id UUID REFERENCES google_ads_connections(id) ON DELETE CASCADE;

ALTER TABLE google_ads_audit_log 
ADD COLUMN IF NOT EXISTS operation TEXT;

ALTER TABLE google_ads_audit_log 
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- 3. Criar índices
CREATE INDEX IF NOT EXISTS idx_google_encryption_active_expires 
ON google_ads_encryption_keys(is_active, expires_at DESC) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_google_encryption_version 
ON google_ads_encryption_keys(version DESC);

CREATE INDEX IF NOT EXISTS idx_google_audit_client 
ON google_ads_audit_log(client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_google_audit_connection 
ON google_ads_audit_log(connection_id, created_at DESC);

-- 4. Inserir chave inicial se não existir
INSERT INTO google_ads_encryption_keys (key_data, algorithm, version, is_active)
SELECT 
  encode(gen_random_bytes(32), 'base64'),
  'aes-256-gcm',
  1,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM google_ads_encryption_keys WHERE is_active = true
);

-- 5. Verificar resultado
SELECT 'Migração concluída!' as status;

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'google_ads_encryption_keys'
ORDER BY ordinal_position;
