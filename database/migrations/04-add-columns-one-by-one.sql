-- ============================================================================
-- ADICIONAR COLUNAS UMA POR VEZ
-- ============================================================================
-- Copie e cole TUDO no Supabase SQL Editor e clique em RUN
-- ============================================================================

-- ENCRYPTION KEYS - algorithm
ALTER TABLE google_ads_encryption_keys 
ADD COLUMN IF NOT EXISTS algorithm VARCHAR(50) DEFAULT 'aes-256-gcm';

-- ENCRYPTION KEYS - version
ALTER TABLE google_ads_encryption_keys 
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- ENCRYPTION KEYS - key_hash
ALTER TABLE google_ads_encryption_keys 
ADD COLUMN IF NOT EXISTS key_hash TEXT;

-- ENCRYPTION KEYS - expires_at
ALTER TABLE google_ads_encryption_keys 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- CONNECTIONS - is_active
ALTER TABLE google_ads_connections 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- CONNECTIONS - last_sync_at
ALTER TABLE google_ads_connections 
ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;

-- CAMPAIGNS - budget_amount_micros
ALTER TABLE google_ads_campaigns 
ADD COLUMN IF NOT EXISTS budget_amount_micros BIGINT;

-- AUDIT LOG - action
ALTER TABLE google_ads_audit_log 
ADD COLUMN IF NOT EXISTS action TEXT;

-- AUDIT LOG - details
ALTER TABLE google_ads_audit_log 
ADD COLUMN IF NOT EXISTS details JSONB;

-- AUDIT LOG - resource_type
ALTER TABLE google_ads_audit_log 
ADD COLUMN IF NOT EXISTS resource_type TEXT;

-- AUDIT LOG - resource_id
ALTER TABLE google_ads_audit_log 
ADD COLUMN IF NOT EXISTS resource_id TEXT;

-- AUDIT LOG - sensitive_data
ALTER TABLE google_ads_audit_log 
ADD COLUMN IF NOT EXISTS sensitive_data BOOLEAN DEFAULT false;

-- AUDIT LOG - ip_address
ALTER TABLE google_ads_audit_log 
ADD COLUMN IF NOT EXISTS ip_address TEXT;

-- AUDIT LOG - user_agent
ALTER TABLE google_ads_audit_log 
ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- ============================================================================
-- VERIFICAÇÃO
-- ============================================================================

SELECT 'Verificação concluída!' as status;

SELECT 
  'encryption_keys' as tabela,
  COUNT(*) as total_colunas
FROM information_schema.columns 
WHERE table_name = 'google_ads_encryption_keys';

SELECT 
  'connections' as tabela,
  COUNT(*) as total_colunas
FROM information_schema.columns 
WHERE table_name = 'google_ads_connections';
