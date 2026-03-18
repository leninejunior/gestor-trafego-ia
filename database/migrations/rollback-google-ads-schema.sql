-- =====================================================
-- ROLLBACK SCRIPT: Google Ads Schema Fixes
-- =====================================================
-- This script rolls back the changes made by fix-google-ads-schema.sql
-- WARNING: This will remove columns and data. Use with caution!
-- =====================================================
-- Version: 1.0.0
-- Date: 2024-11-24
-- =====================================================

DO $
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'ROLLBACK: Google Ads Schema Fixes';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'WARNING: This will remove columns and potentially lose data!';
  RAISE NOTICE '';
END $;

-- =====================================================
-- PHASE 1: Rollback RLS Policies
-- =====================================================

DO $
BEGIN
  RAISE NOTICE '=== PHASE 1: Rolling back RLS policies ===';
END $;

-- Drop client-isolated policies and restore permissive ones
-- google_ads_connections
DROP POLICY IF EXISTS "google_connections_client_select" ON google_ads_connections;
DROP POLICY IF EXISTS "google_connections_client_insert" ON google_ads_connections;
DROP POLICY IF EXISTS "google_connections_client_update" ON google_ads_connections;
DROP POLICY IF EXISTS "google_connections_client_delete" ON google_ads_connections;
DROP POLICY IF EXISTS "service_role_full_access_connections" ON google_ads_connections;

CREATE POLICY "authenticated_users_can_access_all"
  ON google_ads_connections
  FOR ALL
  USING (auth.role() = 'authenticated');

-- google_ads_campaigns
DROP POLICY IF EXISTS "google_campaigns_client_select" ON google_ads_campaigns;
DROP POLICY IF EXISTS "google_campaigns_client_insert" ON google_ads_campaigns;
DROP POLICY IF EXISTS "google_campaigns_client_update" ON google_ads_campaigns;
DROP POLICY IF EXISTS "google_campaigns_client_delete" ON google_ads_campaigns;
DROP POLICY IF EXISTS "service_role_full_access_campaigns" ON google_ads_campaigns;

CREATE POLICY "authenticated_users_can_access_all"
  ON google_ads_campaigns
  FOR ALL
  USING (auth.role() = 'authenticated');

-- google_ads_metrics
DROP POLICY IF EXISTS "google_metrics_client_select" ON google_ads_metrics;
DROP POLICY IF EXISTS "google_metrics_client_insert" ON google_ads_metrics;
DROP POLICY IF EXISTS "google_metrics_client_update" ON google_ads_metrics;
DROP POLICY IF EXISTS "google_metrics_client_delete" ON google_ads_metrics;
DROP POLICY IF EXISTS "service_role_full_access_metrics" ON google_ads_metrics;

CREATE POLICY "authenticated_users_can_access_all"
  ON google_ads_metrics
  FOR ALL
  USING (auth.role() = 'authenticated');

-- google_ads_sync_logs
DROP POLICY IF EXISTS "google_sync_logs_client_select" ON google_ads_sync_logs;
DROP POLICY IF EXISTS "google_sync_logs_client_insert" ON google_ads_sync_logs;
DROP POLICY IF EXISTS "google_sync_logs_client_update" ON google_ads_sync_logs;
DROP POLICY IF EXISTS "google_sync_logs_client_delete" ON google_ads_sync_logs;
DROP POLICY IF EXISTS "service_role_full_access_sync_logs" ON google_ads_sync_logs;

CREATE POLICY "authenticated_users_can_access_all"
  ON google_ads_sync_logs
  FOR ALL
  USING (auth.role() = 'authenticated');

-- google_ads_audit_log
DROP POLICY IF EXISTS "service_role_audit_log_access" ON google_ads_audit_log;
DROP POLICY IF EXISTS "authenticated_users_audit_log_access" ON google_ads_audit_log;

CREATE POLICY "Allow service role access to audit log"
  ON google_ads_audit_log
  FOR ALL
  TO service_role
  USING (true);

RAISE NOTICE '✓ Phase 1 Complete: RLS policies rolled back';

-- =====================================================
-- PHASE 2: Remove indexes
-- =====================================================

DO $
BEGIN
  RAISE NOTICE '=== PHASE 2: Removing indexes ===';
END $;

-- Drop indexes created by the migration
DROP INDEX IF EXISTS idx_google_encryption_version;
DROP INDEX IF EXISTS idx_google_encryption_active_expires;
DROP INDEX IF EXISTS idx_google_audit_client;
DROP INDEX IF EXISTS idx_google_audit_connection;
DROP INDEX IF EXISTS idx_google_audit_operation;
DROP INDEX IF EXISTS idx_google_audit_success;

RAISE NOTICE '✓ Phase 2 Complete: Indexes removed';

-- =====================================================
-- PHASE 3: Remove columns from google_ads_audit_log
-- WARNING: This will lose data in these columns!
-- =====================================================

DO $
BEGIN
  RAISE NOTICE '=== PHASE 3: Removing columns from google_ads_audit_log ===';
  RAISE WARNING 'WARNING: Data in these columns will be lost!';
END $;

-- Remove columns added by the migration
ALTER TABLE google_ads_audit_log DROP COLUMN IF EXISTS client_id;
ALTER TABLE google_ads_audit_log DROP COLUMN IF EXISTS connection_id;
ALTER TABLE google_ads_audit_log DROP COLUMN IF EXISTS operation;
ALTER TABLE google_ads_audit_log DROP COLUMN IF EXISTS metadata;
ALTER TABLE google_ads_audit_log DROP COLUMN IF EXISTS resource_type;
ALTER TABLE google_ads_audit_log DROP COLUMN IF EXISTS resource_id;
ALTER TABLE google_ads_audit_log DROP COLUMN IF EXISTS success;
ALTER TABLE google_ads_audit_log DROP COLUMN IF EXISTS error_message;
ALTER TABLE google_ads_audit_log DROP COLUMN IF EXISTS sensitive_data;

RAISE NOTICE '✓ Phase 3 Complete: Columns removed from google_ads_audit_log';

-- =====================================================
-- PHASE 4: Remove columns from google_ads_encryption_keys
-- WARNING: This will lose data in these columns!
-- =====================================================

DO $
BEGIN
  RAISE NOTICE '=== PHASE 4: Removing columns from google_ads_encryption_keys ===';
  RAISE WARNING 'WARNING: Data in these columns will be lost!';
END $;

-- Remove columns added by the migration
ALTER TABLE google_ads_encryption_keys DROP COLUMN IF EXISTS algorithm;
ALTER TABLE google_ads_encryption_keys DROP COLUMN IF EXISTS version;
ALTER TABLE google_ads_encryption_keys DROP COLUMN IF EXISTS key_hash;

RAISE NOTICE '✓ Phase 4 Complete: Columns removed from google_ads_encryption_keys';

-- =====================================================
-- PHASE 5: Drop views created by migration
-- =====================================================

DO $
BEGIN
  RAISE NOTICE '=== PHASE 5: Dropping views ===';
END $;

DROP VIEW IF EXISTS orphaned_audit_logs;

RAISE NOTICE '✓ Phase 5 Complete: Views dropped';

-- =====================================================
-- ROLLBACK COMPLETE
-- =====================================================

DO $
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✓ ROLLBACK COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'All changes have been rolled back.';
  RAISE NOTICE '';
  RAISE NOTICE 'WARNING: Data in the following columns has been lost:';
  RAISE NOTICE '  - google_ads_encryption_keys: algorithm, version, key_hash';
  RAISE NOTICE '  - google_ads_audit_log: client_id, connection_id, operation, metadata, etc.';
  RAISE NOTICE '';
  RAISE NOTICE 'The database schema has been restored to its pre-migration state.';
  RAISE NOTICE '';
END $;
