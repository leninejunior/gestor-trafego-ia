-- ============================================================================
-- ADICIONAR COLUNAS FALTANTES - Execute no Supabase SQL Editor
-- ============================================================================
-- Este script adiciona colunas que podem estar faltando nas tabelas Google Ads
-- ============================================================================

-- 1. ADICIONAR COLUNAS NA google_ads_encryption_keys
-- ============================================================================

ALTER TABLE google_ads_encryption_keys 
  ADD COLUMN IF NOT EXISTS algorithm VARCHAR(50) DEFAULT 'aes-256-gcm';

ALTER TABLE google_ads_encryption_keys 
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

ALTER TABLE google_ads_encryption_keys 
  ADD COLUMN IF NOT EXISTS key_hash TEXT;

ALTER TABLE google_ads_encryption_keys 
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

ALTER TABLE google_ads_encryption_keys 
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Adicionar constraint se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'valid_algorithm'
  ) THEN
    ALTER TABLE google_ads_encryption_keys 
      ADD CONSTRAINT valid_algorithm 
      CHECK (algorithm IN ('aes-256-gcm', 'aes-256-cbc'));
  END IF;
END $$;

-- Adicionar unique constraint no key_hash se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'google_ads_encryption_keys_key_hash_key'
  ) THEN
    ALTER TABLE google_ads_encryption_keys 
      ADD CONSTRAINT google_ads_encryption_keys_key_hash_key 
      UNIQUE (key_hash);
  END IF;
END $$;

-- 2. ADICIONAR COLUNAS NA google_ads_audit_log
-- ============================================================================

ALTER TABLE google_ads_audit_log 
  ADD COLUMN IF NOT EXISTS action TEXT;

ALTER TABLE google_ads_audit_log 
  ADD COLUMN IF NOT EXISTS details JSONB;

ALTER TABLE google_ads_audit_log 
  ADD COLUMN IF NOT EXISTS resource_type TEXT;

ALTER TABLE google_ads_audit_log 
  ADD COLUMN IF NOT EXISTS resource_id TEXT;

ALTER TABLE google_ads_audit_log 
  ADD COLUMN IF NOT EXISTS sensitive_data BOOLEAN DEFAULT false;

ALTER TABLE google_ads_audit_log 
  ADD COLUMN IF NOT EXISTS ip_address TEXT;

ALTER TABLE google_ads_audit_log 
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- 3. VERIFICAR RESULTADO
-- ============================================================================

SELECT 
  'google_ads_encryption_keys' as table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'google_ads_encryption_keys'
ORDER BY ordinal_position;

SELECT 
  'google_ads_audit_log' as table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'google_ads_audit_log'
ORDER BY ordinal_position;

-- ============================================================================
-- FIM - Colunas adicionadas com sucesso!
-- ============================================================================
