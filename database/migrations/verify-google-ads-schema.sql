-- =====================================================
-- VERIFICATION SCRIPT: Google Ads Schema Fixes
-- =====================================================
-- This script verifies that all changes from fix-google-ads-schema.sql
-- have been applied correctly
-- =====================================================
-- Version: 1.0.0
-- Date: 2024-11-24
-- =====================================================

DO $
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERIFICATION: Google Ads Schema Fixes';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $;

-- =====================================================
-- TEST 1: Verify google_ads_encryption_keys columns
-- =====================================================

DO $
DECLARE
  has_algorithm BOOLEAN;
  has_version BOOLEAN;
  has_key_hash BOOLEAN;
BEGIN
  RAISE NOTICE '=== TEST 1: google_ads_encryption_keys columns ===';
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'google_ads_encryption_keys' AND column_name = 'algorithm'
  ) INTO has_algorithm;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'google_ads_encryption_keys' AND column_name = 'version'
  ) INTO has_version;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'google_ads_encryption_keys' AND column_name = 'key_hash'
  ) INTO has_key_hash;
  
  IF has_algorithm AND has_version AND has_key_hash THEN
    RAISE NOTICE '✓ PASS: All required columns exist';
    RAISE NOTICE '  - algorithm: %', has_algorithm;
    RAISE NOTICE '  - version: %', has_version;
    RAISE NOTICE '  - key_hash: %', has_key_hash;
  ELSE
    RAISE WARNING '✗ FAIL: Missing columns';
    RAISE WARNING '  - algorithm: %', has_algorithm;
    RAISE WARNING '  - version: %', has_version;
    RAISE WARNING '  - key_hash: %', has_key_hash;
  END IF;
  RAISE NOTICE '';
END $;

-- =====================================================
-- TEST 2: Verify google_ads_audit_log columns
-- =====================================================

DO $
DECLARE
  has_client_id BOOLEAN;
  has_connection_id BOOLEAN;
  has_operation BOOLEAN;
  has_metadata BOOLEAN;
  has_resource_type BOOLEAN;
  has_resource_id BOOLEAN;
  has_success BOOLEAN;
  has_error_message BOOLEAN;
  has_sensitive_data BOOLEAN;
  all_present BOOLEAN;
BEGIN
  RAISE NOTICE '=== TEST 2: google_ads_audit_log columns ===';
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'google_ads_audit_log' AND column_name = 'client_id'
  ) INTO has_client_id;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'google_ads_audit_log' AND column_name = 'connection_id'
  ) INTO has_connection_id;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'google_ads_audit_log' AND column_name = 'operation'
  ) INTO has_operation;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'google_ads_audit_log' AND column_name = 'metadata'
  ) INTO has_metadata;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'google_ads_audit_log' AND column_name = 'resource_type'
  ) INTO has_resource_type;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'google_ads_audit_log' AND column_name = 'resource_id'
  ) INTO has_resource_id;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'google_ads_audit_log' AND column_name = 'success'
  ) INTO has_success;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'google_ads_audit_log' AND column_name = 'error_message'
  ) INTO has_error_message;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'google_ads_audit_log' AND column_name = 'sensitive_data'
  ) INTO has_sensitive_data;
  
  all_present := has_client_id AND has_connection_id AND has_operation AND has_metadata 
                AND has_resource_type AND has_resource_id AND has_success 
                AND has_error_message AND has_sensitive_data;
  
  IF all_present THEN
    RAISE NOTICE '✓ PASS: All required columns exist';
  ELSE
    RAISE WARNING '✗ FAIL: Missing columns';
  END IF;
  
  RAISE NOTICE '  - client_id: %', has_client_id;
  RAISE NOTICE '  - connection_id: %', has_connection_id;
  RAISE NOTICE '  - operation: %', has_operation;
  RAISE NOTICE '  - metadata: %', has_metadata;
  RAISE NOTICE '  - resource_type: %', has_resource_type;
  RAISE NOTICE '  - resource_id: %', has_resource_id;
  RAISE NOTICE '  - success: %', has_success;
  RAISE NOTICE '  - error_message: %', has_error_message;
  RAISE NOTICE '  - sensitive_data: %', has_sensitive_data;
  RAISE NOTICE '';
END $;

-- =====================================================
-- TEST 3: Verify indexes exist
-- =====================================================

DO $
DECLARE
  index_count INTEGER;
  expected_count INTEGER := 6;
BEGIN
  RAISE NOTICE '=== TEST 3: Indexes ===';
  
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes
  WHERE indexname IN (
    'idx_google_encryption_version',
    'idx_google_encryption_active_expires',
    'idx_google_audit_client',
    'idx_google_audit_connection',
    'idx_google_audit_operation',
    'idx_google_audit_success'
  );
  
  IF index_count = expected_count THEN
    RAISE NOTICE '✓ PASS: All % indexes exist', expected_count;
  ELSE
    RAISE WARNING '✗ FAIL: Expected % indexes, found %', expected_count, index_count;
  END IF;
  RAISE NOTICE '';
END $;

-- =====================================================
-- TEST 4: Verify RLS policies for google_ads_connections
-- =====================================================

DO $
DECLARE
  policy_count INTEGER;
  expected_count INTEGER := 5; -- 4 client policies + 1 service role
BEGIN
  RAISE NOTICE '=== TEST 4: RLS policies for google_ads_connections ===';
  
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'google_ads_connections'
    AND policyname IN (
      'google_connections_client_select',
      'google_connections_client_insert',
      'google_connections_client_update',
      'google_connections_client_delete',
      'service_role_full_access_connections'
    );
  
  IF policy_count = expected_count THEN
    RAISE NOTICE '✓ PASS: All % policies exist', expected_count;
  ELSE
    RAISE WARNING '✗ FAIL: Expected % policies, found %', expected_count, policy_count;
  END IF;
  RAISE NOTICE '';
END $;

-- =====================================================
-- TEST 5: Verify RLS policies for google_ads_campaigns
-- =====================================================

DO $
DECLARE
  policy_count INTEGER;
  expected_count INTEGER := 5;
BEGIN
  RAISE NOTICE '=== TEST 5: RLS policies for google_ads_campaigns ===';
  
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'google_ads_campaigns'
    AND policyname IN (
      'google_campaigns_client_select',
      'google_campaigns_client_insert',
      'google_campaigns_client_update',
      'google_campaigns_client_delete',
      'service_role_full_access_campaigns'
    );
  
  IF policy_count = expected_count THEN
    RAISE NOTICE '✓ PASS: All % policies exist', expected_count;
  ELSE
    RAISE WARNING '✗ FAIL: Expected % policies, found %', expected_count, policy_count;
  END IF;
  RAISE NOTICE '';
END $;

-- =====================================================
-- TEST 6: Verify RLS policies for google_ads_metrics
-- =====================================================

DO $
DECLARE
  policy_count INTEGER;
  expected_count INTEGER := 5;
BEGIN
  RAISE NOTICE '=== TEST 6: RLS policies for google_ads_metrics ===';
  
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'google_ads_metrics'
    AND policyname IN (
      'google_metrics_client_select',
      'google_metrics_client_insert',
      'google_metrics_client_update',
      'google_metrics_client_delete',
      'service_role_full_access_metrics'
    );
  
  IF policy_count = expected_count THEN
    RAISE NOTICE '✓ PASS: All % policies exist', expected_count;
  ELSE
    RAISE WARNING '✗ FAIL: Expected % policies, found %', expected_count, policy_count;
  END IF;
  RAISE NOTICE '';
END $;

-- =====================================================
-- TEST 7: Verify RLS policies for google_ads_sync_logs
-- =====================================================

DO $
DECLARE
  policy_count INTEGER;
  expected_count INTEGER := 5;
BEGIN
  RAISE NOTICE '=== TEST 7: RLS policies for google_ads_sync_logs ===';
  
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'google_ads_sync_logs'
    AND policyname IN (
      'google_sync_logs_client_select',
      'google_sync_logs_client_insert',
      'google_sync_logs_client_update',
      'google_sync_logs_client_delete',
      'service_role_full_access_sync_logs'
    );
  
  IF policy_count = expected_count THEN
    RAISE NOTICE '✓ PASS: All % policies exist', expected_count;
  ELSE
    RAISE WARNING '✗ FAIL: Expected % policies, found %', expected_count, policy_count;
  END IF;
  RAISE NOTICE '';
END $;

-- =====================================================
-- TEST 8: Verify RLS policies for google_ads_audit_log
-- =====================================================

DO $
DECLARE
  policy_count INTEGER;
  expected_count INTEGER := 2; -- service role + authenticated users
BEGIN
  RAISE NOTICE '=== TEST 8: RLS policies for google_ads_audit_log ===';
  
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'google_ads_audit_log'
    AND policyname IN (
      'service_role_audit_log_access',
      'authenticated_users_audit_log_access'
    );
  
  IF policy_count = expected_count THEN
    RAISE NOTICE '✓ PASS: All % policies exist', expected_count;
  ELSE
    RAISE WARNING '✗ FAIL: Expected % policies, found %', expected_count, policy_count;
  END IF;
  RAISE NOTICE '';
END $;

-- =====================================================
-- TEST 9: Verify data migration for audit logs
-- =====================================================

DO $
DECLARE
  total_logs INTEGER;
  logs_with_client INTEGER;
  migration_percentage NUMERIC;
BEGIN
  RAISE NOTICE '=== TEST 9: Audit log data migration ===';
  
  SELECT COUNT(*) INTO total_logs FROM google_ads_audit_log;
  SELECT COUNT(*) INTO logs_with_client FROM google_ads_audit_log WHERE client_id IS NOT NULL;
  
  IF total_logs > 0 THEN
    migration_percentage := ROUND(100.0 * logs_with_client / total_logs, 2);
    
    RAISE NOTICE 'Total audit logs: %', total_logs;
    RAISE NOTICE 'Logs with client_id: %', logs_with_client;
    RAISE NOTICE 'Migration percentage: %%', migration_percentage;
    
    IF migration_percentage >= 95 THEN
      RAISE NOTICE '✓ PASS: Migration successful (>= 95%%)';
    ELSIF migration_percentage >= 80 THEN
      RAISE WARNING '⚠ WARNING: Migration partially successful (>= 80%%)';
    ELSE
      RAISE WARNING '✗ FAIL: Migration incomplete (< 80%%)';
    END IF;
  ELSE
    RAISE NOTICE '✓ PASS: No audit logs to migrate';
  END IF;
  RAISE NOTICE '';
END $;

-- =====================================================
-- TEST 10: Verify foreign key constraints
-- =====================================================

DO $
DECLARE
  fk_count INTEGER;
  expected_count INTEGER := 2; -- client_id and connection_id
BEGIN
  RAISE NOTICE '=== TEST 10: Foreign key constraints on google_ads_audit_log ===';
  
  SELECT COUNT(*) INTO fk_count
  FROM information_schema.table_constraints tc
  JOIN information_schema.constraint_column_usage ccu 
    ON tc.constraint_name = ccu.constraint_name
  WHERE tc.table_name = 'google_ads_audit_log'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND ccu.column_name IN ('client_id', 'connection_id');
  
  IF fk_count = expected_count THEN
    RAISE NOTICE '✓ PASS: All % foreign keys exist', expected_count;
  ELSE
    RAISE WARNING '✗ FAIL: Expected % foreign keys, found %', expected_count, fk_count;
  END IF;
  RAISE NOTICE '';
END $;

-- =====================================================
-- SUMMARY
-- =====================================================

DO $
DECLARE
  total_tests INTEGER := 10;
  passed_tests INTEGER := 0;
  
  -- Test results
  test1_pass BOOLEAN;
  test2_pass BOOLEAN;
  test3_pass BOOLEAN;
  test4_pass BOOLEAN;
  test5_pass BOOLEAN;
  test6_pass BOOLEAN;
  test7_pass BOOLEAN;
  test8_pass BOOLEAN;
  test9_pass BOOLEAN;
  test10_pass BOOLEAN;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERIFICATION SUMMARY';
  RAISE NOTICE '========================================';
  
  -- Check each test (simplified - in real scenario you'd store results)
  -- For now, we'll just show the summary format
  
  RAISE NOTICE '';
  RAISE NOTICE 'Run this script to verify your migration.';
  RAISE NOTICE 'Review the output above for any FAIL or WARNING messages.';
  RAISE NOTICE '';
  RAISE NOTICE 'If all tests pass, your migration was successful!';
  RAISE NOTICE '';
END $;

-- =====================================================
-- Detailed table information for manual review
-- =====================================================

-- Show all columns in google_ads_encryption_keys
SELECT 
  'google_ads_encryption_keys' as table_name,
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'google_ads_encryption_keys'
ORDER BY ordinal_position;

-- Show all columns in google_ads_audit_log
SELECT 
  'google_ads_audit_log' as table_name,
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'google_ads_audit_log'
ORDER BY ordinal_position;

-- Show all RLS policies for Google Ads tables
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN (
  'google_ads_encryption_keys',
  'google_ads_connections',
  'google_ads_campaigns',
  'google_ads_metrics',
  'google_ads_sync_logs',
  'google_ads_audit_log'
)
ORDER BY tablename, policyname;
