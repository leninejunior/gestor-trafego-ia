-- =====================================================
-- Data Integrity Verification Script
-- Task 1.1: Verify existing data integrity
-- =====================================================
-- This script checks the integrity of existing encryption keys
-- and ensures all required fields are populated
-- =====================================================

-- 1. Check for NULL values in required columns
SELECT 
  'Checking for NULL values in required columns' as check_name;

SELECT 
  id,
  CASE WHEN key_data IS NULL THEN '✗ key_data is NULL' ELSE '✓' END as key_data_check,
  CASE WHEN algorithm IS NULL THEN '✗ algorithm is NULL' ELSE '✓' END as algorithm_check,
  CASE WHEN version IS NULL THEN '✗ version is NULL' ELSE '✓' END as version_check,
  CASE WHEN is_active IS NULL THEN '✗ is_active is NULL' ELSE '✓' END as is_active_check,
  CASE WHEN created_at IS NULL THEN '✗ created_at is NULL' ELSE '✓' END as created_at_check
FROM google_ads_encryption_keys;

-- 2. Check for duplicate versions
SELECT 
  'Checking for duplicate versions' as check_name;

SELECT 
  version,
  COUNT(*) as count,
  CASE 
    WHEN COUNT(*) > 1 THEN '✗ Duplicate version found'
    ELSE '✓ No duplicates'
  END as status
FROM google_ads_encryption_keys
GROUP BY version
HAVING COUNT(*) > 1;

-- 3. Check for multiple active keys (should only be one)
SELECT 
  'Checking for multiple active keys' as check_name;

SELECT 
  COUNT(*) as active_key_count,
  CASE 
    WHEN COUNT(*) = 1 THEN '✓ Exactly one active key'
    WHEN COUNT(*) = 0 THEN '⚠ No active keys'
    ELSE '✗ Multiple active keys found'
  END as status
FROM google_ads_encryption_keys
WHERE is_active = true;

-- 4. Check for expired active keys
SELECT 
  'Checking for expired active keys' as check_name;

SELECT 
  id,
  version,
  expires_at,
  CASE 
    WHEN expires_at < NOW() THEN '⚠ Active key is expired'
    ELSE '✓ Active key is valid'
  END as status
FROM google_ads_encryption_keys
WHERE is_active = true;

-- 5. Check algorithm consistency
SELECT 
  'Checking algorithm consistency' as check_name;

SELECT 
  algorithm,
  COUNT(*) as count,
  CASE 
    WHEN algorithm = 'aes-256-gcm' THEN '✓ Using correct algorithm'
    ELSE '⚠ Using non-standard algorithm'
  END as status
FROM google_ads_encryption_keys
GROUP BY algorithm;

-- 6. Check version sequence
SELECT 
  'Checking version sequence' as check_name;

WITH version_gaps AS (
  SELECT 
    version,
    LEAD(version) OVER (ORDER BY version) as next_version,
    LEAD(version) OVER (ORDER BY version) - version as gap
  FROM google_ads_encryption_keys
)
SELECT 
  version,
  next_version,
  gap,
  CASE 
    WHEN gap = 1 OR gap IS NULL THEN '✓ Sequential'
    ELSE '⚠ Gap in version sequence'
  END as status
FROM version_gaps;

-- 7. Summary report
SELECT 
  'Summary Report' as report_name;

SELECT 
  COUNT(*) as total_keys,
  COUNT(*) FILTER (WHERE is_active = true) as active_keys,
  COUNT(*) FILTER (WHERE algorithm = 'aes-256-gcm') as correct_algorithm,
  COUNT(*) FILTER (WHERE version IS NOT NULL) as versioned_keys,
  COUNT(*) FILTER (WHERE key_hash IS NOT NULL) as keys_with_hash,
  COUNT(*) FILTER (WHERE expires_at > NOW()) as non_expired_keys,
  MIN(version) as min_version,
  MAX(version) as max_version,
  MIN(created_at) as oldest_key,
  MAX(created_at) as newest_key
FROM google_ads_encryption_keys;

-- 8. Recommendations
SELECT 
  'Recommendations' as section;

SELECT 
  CASE 
    WHEN (SELECT COUNT(*) FROM google_ads_encryption_keys WHERE is_active = true) = 0 
    THEN '⚠ RECOMMENDATION: No active encryption key found. Run key rotation.'
    WHEN (SELECT COUNT(*) FROM google_ads_encryption_keys WHERE is_active = true AND expires_at < NOW()) > 0
    THEN '⚠ RECOMMENDATION: Active key is expired. Run key rotation.'
    WHEN (SELECT COUNT(*) FROM google_ads_encryption_keys WHERE algorithm IS NULL) > 0
    THEN '⚠ RECOMMENDATION: Some keys missing algorithm. Run migration script.'
    WHEN (SELECT COUNT(*) FROM google_ads_encryption_keys WHERE version IS NULL) > 0
    THEN '⚠ RECOMMENDATION: Some keys missing version. Run migration script.'
    ELSE '✓ All checks passed. Schema is healthy.'
  END as recommendation;
