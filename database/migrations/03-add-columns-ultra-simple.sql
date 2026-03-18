-- ============================================================================
-- ADICIONAR COLUNAS - VERSÃO ULTRA SIMPLES (sem blocos DO)
-- ============================================================================
-- Execute no Supabase SQL Editor
-- ============================================================================

-- ENCRYPTION KEYS
ALTER TABLE google_ads_encryption_keys ADD COLUMN IF NOT EXISTS algorithm VARCHAR(50) DEFAULT 'aes-256-gcm';
ALTER TABLE google_ads_encryption_keys ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE google_ads_encryption_keys ADD COLUMN IF NOT EXISTS key_hash TEXT;
ALTER TABLE google_ads_encryption_keys ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE google_ads_encryption_keys ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- CONNECTIONS
ALTER TABLE google_ads_connections ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE google_ads_connections ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;

-- CAMPAIGNS
ALTER TABLE google_ads_campaigns ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'UNKNOWN';
ALTER TABLE google_ads_campaigns ADD COLUMN IF NOT EXISTS budget_amount_micros BIGINT;

-- AUDIT LOG
ALTER TABLE google_ads_audit_log ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE google_ads_audit_log ADD COLUMN IF NOT EXISTS details JSONB;
ALTER TABLE google_ads_audit_log ADD COLUMN IF NOT EXISTS resource_type TEXT;
ALTER TABLE google_ads_audit_log ADD COLUMN IF NOT EXISTS resource_id TEXT;
ALTER TABLE google_ads_audit_log ADD COLUMN IF NOT EXISTS sensitive_data BOOLEAN DEFAULT false;
ALTER TABLE google_ads_audit_log ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE google_ads_audit_log ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Verificar resultado
SELECT 'encryption_keys' as tabela, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'google_ads_encryption_keys' 
ORDER BY ordinal_position;

SELECT 'connections' as tabela, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'google_ads_connections' 
ORDER BY ordinal_position;

SELECT 'campaigns' as tabela, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'google_ads_campaigns' 
ORDER BY ordinal_position;

SELECT 'audit_log' as tabela, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'google_ads_audit_log' 
ORDER BY ordinal_position;
