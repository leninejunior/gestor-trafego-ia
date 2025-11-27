-- =====================================================
-- Migration: Fix google_ads_encryption_keys table
-- Task 1.1: Add missing columns to google_ads_encryption_keys
-- =====================================================
-- This migration adds the missing columns that the crypto service expects
-- Safe to run multiple times (uses IF NOT EXISTS)
-- =====================================================

-- Add algorithm column (VARCHAR(50), default 'aes-256-gcm')
ALTER TABLE google_ads_encryption_keys 
ADD COLUMN IF NOT EXISTS algorithm VARCHAR(50) DEFAULT 'aes-256-gcm';

-- Add version column for key rotation support
ALTER TABLE google_ads_encryption_keys 
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- Add key_hash column to store the encrypted key
ALTER TABLE google_ads_encryption_keys 
ADD COLUMN IF NOT EXISTS key_hash TEXT;

-- Update existing rows to have version 1 if they don't have a version
UPDATE google_ads_encryption_keys 
SET version = 1 
WHERE version IS NULL;

-- Update existing rows to have algorithm if they don't have one
UPDATE google_ads_encryption_keys 
SET algorithm = 'aes-256-gcm' 
WHERE algorithm IS NULL;

-- Create index for performance on version column
CREATE INDEX IF NOT EXISTS idx_google_encryption_version 
ON google_ads_encryption_keys(version DESC);

-- Create index for active keys with expiration
CREATE INDEX IF NOT EXISTS idx_google_encryption_active_expires 
ON google_ads_encryption_keys(is_active, expires_at DESC) 
WHERE is_active = true;

-- Add comments for documentation
COMMENT ON COLUMN google_ads_encryption_keys.algorithm IS 'Encryption algorithm used (e.g., aes-256-gcm)';
COMMENT ON COLUMN google_ads_encryption_keys.version IS 'Key version number for rotation support';
COMMENT ON COLUMN google_ads_encryption_keys.key_hash IS 'Encrypted key data (encrypted with master key)';

-- Verify the changes
SELECT 
  column_name, 
  data_type, 
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'google_ads_encryption_keys'
ORDER BY ordinal_position;
