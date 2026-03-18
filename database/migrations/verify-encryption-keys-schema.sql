-- =====================================================
-- Verification Script: google_ads_encryption_keys table
-- =====================================================
-- This script verifies that all required columns exist
-- and have the correct data types
-- =====================================================

-- Check if table exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'google_ads_encryption_keys'
    ) THEN '✓ Table exists'
    ELSE '✗ Table does not exist'
  END as table_status;

-- Check all columns and their types
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable,
  CASE 
    WHEN column_name = 'id' AND data_type = 'uuid' THEN '✓'
    WHEN column_name = 'key_data' AND data_type = 'text' THEN '✓'
    WHEN column_name = 'algorithm' AND data_type = 'character varying' THEN '✓'
    WHEN column_name = 'version' AND data_type = 'integer' THEN '✓'
    WHEN column_name = 'key_hash' AND data_type = 'text' THEN '✓'
    WHEN column_name = 'is_active' AND data_type = 'boolean' THEN '✓'
    WHEN column_name = 'created_at' AND data_type = 'timestamp with time zone' THEN '✓'
    WHEN column_name = 'expires_at' AND data_type = 'timestamp with time zone' THEN '✓'
    ELSE '✗'
  END as status
FROM information_schema.columns
WHERE table_name = 'google_ads_encryption_keys'
ORDER BY ordinal_position;

-- Check indexes
SELECT 
  indexname,
  indexdef,
  CASE 
    WHEN indexname LIKE '%encryption%' THEN '✓'
    ELSE '✗'
  END as status
FROM pg_indexes
WHERE tablename = 'google_ads_encryption_keys';

-- Check RLS is enabled
SELECT 
  tablename,
  rowsecurity,
  CASE 
    WHEN rowsecurity THEN '✓ RLS enabled'
    ELSE '✗ RLS not enabled'
  END as rls_status
FROM pg_tables
WHERE tablename = 'google_ads_encryption_keys';

-- Check RLS policies
SELECT 
  policyname,
  cmd,
  roles,
  qual,
  CASE 
    WHEN policyname IS NOT NULL THEN '✓'
    ELSE '✗'
  END as status
FROM pg_policies
WHERE tablename = 'google_ads_encryption_keys';

-- Count existing keys
SELECT 
  COUNT(*) as total_keys,
  COUNT(*) FILTER (WHERE is_active = true) as active_keys,
  COUNT(*) FILTER (WHERE algorithm = 'aes-256-gcm') as aes_keys,
  COUNT(*) FILTER (WHERE version IS NOT NULL) as versioned_keys
FROM google_ads_encryption_keys;

-- Show sample data (without exposing sensitive key_data)
SELECT 
  id,
  algorithm,
  version,
  CASE 
    WHEN key_hash IS NOT NULL THEN 'Present'
    ELSE 'NULL'
  END as key_hash_status,
  is_active,
  created_at,
  expires_at
FROM google_ads_encryption_keys
ORDER BY version DESC
LIMIT 5;
