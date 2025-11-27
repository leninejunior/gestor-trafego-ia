-- =====================================================
-- MASTER MIGRATION: Fix Google Ads Schema
-- =====================================================
-- This migration consolidates all Google Ads schema fixes
-- Safe to run multiple times (uses IF NOT EXISTS)
-- Includes: encryption keys, audit log, RLS policies
-- =====================================================
-- Version: 1.0.0
-- Date: 2024-11-24
-- Related Tasks: 1.1, 1.2, 1.3, 2.1, 2.2
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- PHASE 1: Fix google_ads_encryption_keys table
-- Task 1.1: Add missing columns
-- =====================================================

DO $
BEGIN
  RAISE NOTICE '=== PHASE 1: Fixing google_ads_encryption_keys table ===';
END $;

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

DO $
DECLARE
  col_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns
  WHERE table_name = 'google_ads_encryption_keys'
    AND column_name IN ('algorithm', 'version', 'key_hash');
  
  IF col_count = 3 THEN
    RAISE NOTICE '✓ Phase 1 Complete: google_ads_encryption_keys has all required columns';
  ELSE
    RAISE WARNING '⚠ Phase 1 Warning: Expected 3 new columns, found %', col_count;
  END IF;
END $;

-- =====================================================
-- PHASE 2: Fix google_ads_audit_log table
-- Task 1.2: Add client_id and related columns
-- =====================================================

DO $
BEGIN
  RAISE NOTICE '=== PHASE 2: Fixing google_ads_audit_log table ===';
END $;

-- Add client_id column if it doesn't exist
ALTER TABLE google_ads_audit_log 
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE CASCADE;

-- Add connection_id column if it doesn't exist (for better tracking)
ALTER TABLE google_ads_audit_log 
ADD COLUMN IF NOT EXISTS connection_id UUID REFERENCES google_ads_connections(id) ON DELETE CASCADE;

-- Add operation column if it doesn't exist (more structured than 'action')
ALTER TABLE google_ads_audit_log 
ADD COLUMN IF NOT EXISTS operation TEXT;

-- Add metadata column if it doesn't exist (more structured than 'details')
ALTER TABLE google_ads_audit_log 
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Add resource_type column for better categorization
ALTER TABLE google_ads_audit_log 
ADD COLUMN IF NOT EXISTS resource_type TEXT;

-- Add resource_id column for specific resource tracking
ALTER TABLE google_ads_audit_log 
ADD COLUMN IF NOT EXISTS resource_id TEXT;

-- Add success column to track operation outcomes
ALTER TABLE google_ads_audit_log 
ADD COLUMN IF NOT EXISTS success BOOLEAN DEFAULT true;

-- Add error_message column for failure tracking
ALTER TABLE google_ads_audit_log 
ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Add sensitive_data flag
ALTER TABLE google_ads_audit_log 
ADD COLUMN IF NOT EXISTS sensitive_data BOOLEAN DEFAULT false;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_google_audit_client 
ON google_ads_audit_log(client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_google_audit_connection 
ON google_ads_audit_log(connection_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_google_audit_operation 
ON google_ads_audit_log(operation, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_google_audit_success 
ON google_ads_audit_log(success, created_at DESC) 
WHERE success = false;

-- Add comments for documentation
COMMENT ON COLUMN google_ads_audit_log.client_id IS 'Client associated with this audit event';
COMMENT ON COLUMN google_ads_audit_log.connection_id IS 'Google Ads connection associated with this event';
COMMENT ON COLUMN google_ads_audit_log.operation IS 'Type of operation performed (e.g., connect, sync, token_refresh)';
COMMENT ON COLUMN google_ads_audit_log.metadata IS 'Additional structured data about the operation';
COMMENT ON COLUMN google_ads_audit_log.resource_type IS 'Type of resource affected (e.g., google_ads_connection, campaign)';
COMMENT ON COLUMN google_ads_audit_log.resource_id IS 'ID of the specific resource affected';
COMMENT ON COLUMN google_ads_audit_log.success IS 'Whether the operation succeeded';
COMMENT ON COLUMN google_ads_audit_log.error_message IS 'Error message if operation failed';
COMMENT ON COLUMN google_ads_audit_log.sensitive_data IS 'Flag indicating if this log contains sensitive data';

DO $
DECLARE
  col_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns
  WHERE table_name = 'google_ads_audit_log'
    AND column_name IN ('client_id', 'connection_id', 'operation', 'metadata', 'resource_type', 'resource_id', 'success', 'error_message', 'sensitive_data');
  
  IF col_count = 9 THEN
    RAISE NOTICE '✓ Phase 2 Complete: google_ads_audit_log has all required columns';
  ELSE
    RAISE WARNING '⚠ Phase 2 Warning: Expected 9 new columns, found %', col_count;
  END IF;
END $;

-- =====================================================
-- PHASE 3: Migrate existing audit log data
-- Task 1.2: Populate client_id for existing records
-- =====================================================

DO $
BEGIN
  RAISE NOTICE '=== PHASE 3: Migrating existing audit log data ===';
END $;

-- Step 1: Update audit logs that have connection_id but no client_id
-- Derive client_id from google_ads_connections table
UPDATE google_ads_audit_log AS audit
SET client_id = conn.client_id
FROM google_ads_connections AS conn
WHERE audit.connection_id = conn.id
  AND audit.client_id IS NULL
  AND audit.connection_id IS NOT NULL;

-- Step 2: For audit logs without connection_id, try to derive from user's first client
-- This is a fallback for very old logs that might not have connection_id
UPDATE google_ads_audit_log AS audit
SET client_id = (
  SELECT c.id
  FROM clients c
  JOIN memberships m ON m.organization_id = c.org_id
  WHERE m.user_id = audit.user_id
  ORDER BY c.created_at ASC
  LIMIT 1
)
WHERE audit.client_id IS NULL
  AND audit.user_id IS NOT NULL
  AND audit.connection_id IS NULL;

-- Step 3: Migrate legacy 'action' field to 'operation' if operation is null
UPDATE google_ads_audit_log
SET operation = action
WHERE operation IS NULL
  AND action IS NOT NULL;

-- Step 4: Migrate legacy 'details' field to 'metadata' if metadata is null
UPDATE google_ads_audit_log
SET metadata = details
WHERE metadata IS NULL
  AND details IS NOT NULL;

-- Step 5: Report on migration results
DO $
DECLARE
  total_count INTEGER;
  migrated_count INTEGER;
  orphaned_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM google_ads_audit_log;
  SELECT COUNT(*) INTO migrated_count FROM google_ads_audit_log WHERE client_id IS NOT NULL;
  SELECT COUNT(*) INTO orphaned_count FROM google_ads_audit_log WHERE client_id IS NULL;
  
  RAISE NOTICE '✓ Phase 3 Complete: Audit log data migration';
  RAISE NOTICE '  Total audit logs: %', total_count;
  RAISE NOTICE '  Successfully migrated: %', migrated_count;
  RAISE NOTICE '  Orphaned (no client_id): %', orphaned_count;
  
  IF orphaned_count > 0 THEN
    RAISE NOTICE '  ⚠ Warning: % audit log entries still have no client_id', orphaned_count;
    RAISE NOTICE '  These entries may need manual review or can be safely deleted if they are old/invalid';
  END IF;
END $;

-- =====================================================
-- PHASE 4: Update RLS Policies for Audit Log
-- Task 1.2: Ensure proper client isolation
-- =====================================================

DO $
BEGIN
  RAISE NOTICE '=== PHASE 4: Updating RLS policies for audit log ===';
END $;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow service role access to audit log" ON google_ads_audit_log;
DROP POLICY IF EXISTS "service_role_audit_log_access" ON google_ads_audit_log;
DROP POLICY IF EXISTS "authenticated_users_audit_log_access" ON google_ads_audit_log;

-- Service role has full access
CREATE POLICY "service_role_audit_log_access"
  ON google_ads_audit_log
  FOR ALL
  TO service_role
  USING (true);

-- Authenticated users can view audit logs for their clients
CREATE POLICY "authenticated_users_audit_log_access"
  ON google_ads_audit_log
  FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT c.id 
      FROM clients c
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

DO $
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'google_ads_audit_log';
  
  IF policy_count >= 2 THEN
    RAISE NOTICE '✓ Phase 4 Complete: RLS policies updated for audit log (% policies)', policy_count;
  ELSE
    RAISE WARNING '⚠ Phase 4 Warning: Expected at least 2 policies, found %', policy_count;
  END IF;
END $;

-- =====================================================
-- PHASE 5: Update RLS Policies for All Google Ads Tables
-- Task 1.3: Ensure proper client isolation across all tables
-- =====================================================

DO $
BEGIN
  RAISE NOTICE '=== PHASE 5: Updating RLS policies for all Google Ads tables ===';
END $;

-- =====================================================
-- 5.1: google_ads_connections - Client Isolation
-- =====================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "authenticated_users_can_access_all" ON google_ads_connections;
DROP POLICY IF EXISTS "google_connections_client_select" ON google_ads_connections;
DROP POLICY IF EXISTS "google_connections_client_insert" ON google_ads_connections;
DROP POLICY IF EXISTS "google_connections_client_update" ON google_ads_connections;
DROP POLICY IF EXISTS "google_connections_client_delete" ON google_ads_connections;
DROP POLICY IF EXISTS "service_role_full_access_connections" ON google_ads_connections;

-- Create proper client-isolated policies
CREATE POLICY "google_connections_client_select"
  ON google_ads_connections
  FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT c.id 
      FROM clients c
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

CREATE POLICY "google_connections_client_insert"
  ON google_ads_connections
  FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id IN (
      SELECT c.id 
      FROM clients c
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

CREATE POLICY "google_connections_client_update"
  ON google_ads_connections
  FOR UPDATE
  TO authenticated
  USING (
    client_id IN (
      SELECT c.id 
      FROM clients c
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    client_id IN (
      SELECT c.id 
      FROM clients c
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

CREATE POLICY "google_connections_client_delete"
  ON google_ads_connections
  FOR DELETE
  TO authenticated
  USING (
    client_id IN (
      SELECT c.id 
      FROM clients c
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

-- Service role needs full access for background jobs
CREATE POLICY "service_role_full_access_connections"
  ON google_ads_connections
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY "google_connections_client_select" ON google_ads_connections IS 
  'Users can only view Google Ads connections for clients in their organization';

-- =====================================================
-- 5.2: google_ads_campaigns - Client Isolation
-- =====================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "authenticated_users_can_access_all" ON google_ads_campaigns;
DROP POLICY IF EXISTS "google_campaigns_client_select" ON google_ads_campaigns;
DROP POLICY IF EXISTS "google_campaigns_client_insert" ON google_ads_campaigns;
DROP POLICY IF EXISTS "google_campaigns_client_update" ON google_ads_campaigns;
DROP POLICY IF EXISTS "google_campaigns_client_delete" ON google_ads_campaigns;
DROP POLICY IF EXISTS "service_role_full_access_campaigns" ON google_ads_campaigns;

-- Create proper client-isolated policies
CREATE POLICY "google_campaigns_client_select"
  ON google_ads_campaigns
  FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT c.id 
      FROM clients c
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

CREATE POLICY "google_campaigns_client_insert"
  ON google_ads_campaigns
  FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id IN (
      SELECT c.id 
      FROM clients c
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

CREATE POLICY "google_campaigns_client_update"
  ON google_ads_campaigns
  FOR UPDATE
  TO authenticated
  USING (
    client_id IN (
      SELECT c.id 
      FROM clients c
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    client_id IN (
      SELECT c.id 
      FROM clients c
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

CREATE POLICY "google_campaigns_client_delete"
  ON google_ads_campaigns
  FOR DELETE
  TO authenticated
  USING (
    client_id IN (
      SELECT c.id 
      FROM clients c
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

-- Service role needs full access
CREATE POLICY "service_role_full_access_campaigns"
  ON google_ads_campaigns
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY "google_campaigns_client_select" ON google_ads_campaigns IS 
  'Users can only view Google Ads campaigns for clients in their organization';

-- =====================================================
-- 5.3: google_ads_metrics - Client Isolation via Campaign
-- =====================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "authenticated_users_can_access_all" ON google_ads_metrics;
DROP POLICY IF EXISTS "google_metrics_client_select" ON google_ads_metrics;
DROP POLICY IF EXISTS "google_metrics_client_insert" ON google_ads_metrics;
DROP POLICY IF EXISTS "google_metrics_client_update" ON google_ads_metrics;
DROP POLICY IF EXISTS "google_metrics_client_delete" ON google_ads_metrics;
DROP POLICY IF EXISTS "service_role_full_access_metrics" ON google_ads_metrics;

-- Create proper client-isolated policies (via campaign relationship)
CREATE POLICY "google_metrics_client_select"
  ON google_ads_metrics
  FOR SELECT
  TO authenticated
  USING (
    campaign_id IN (
      SELECT gc.id 
      FROM google_ads_campaigns gc
      JOIN clients c ON c.id = gc.client_id
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

CREATE POLICY "google_metrics_client_insert"
  ON google_ads_metrics
  FOR INSERT
  TO authenticated
  WITH CHECK (
    campaign_id IN (
      SELECT gc.id 
      FROM google_ads_campaigns gc
      JOIN clients c ON c.id = gc.client_id
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

CREATE POLICY "google_metrics_client_update"
  ON google_ads_metrics
  FOR UPDATE
  TO authenticated
  USING (
    campaign_id IN (
      SELECT gc.id 
      FROM google_ads_campaigns gc
      JOIN clients c ON c.id = gc.client_id
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    campaign_id IN (
      SELECT gc.id 
      FROM google_ads_campaigns gc
      JOIN clients c ON c.id = gc.client_id
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

CREATE POLICY "google_metrics_client_delete"
  ON google_ads_metrics
  FOR DELETE
  TO authenticated
  USING (
    campaign_id IN (
      SELECT gc.id 
      FROM google_ads_campaigns gc
      JOIN clients c ON c.id = gc.client_id
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

-- Service role needs full access
CREATE POLICY "service_role_full_access_metrics"
  ON google_ads_metrics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY "google_metrics_client_select" ON google_ads_metrics IS 
  'Users can only view metrics for campaigns belonging to clients in their organization';

-- =====================================================
-- 5.4: google_ads_sync_logs - Client Isolation via Connection
-- =====================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "authenticated_users_can_access_all" ON google_ads_sync_logs;
DROP POLICY IF EXISTS "google_sync_logs_client_select" ON google_ads_sync_logs;
DROP POLICY IF EXISTS "google_sync_logs_client_insert" ON google_ads_sync_logs;
DROP POLICY IF EXISTS "google_sync_logs_client_update" ON google_ads_sync_logs;
DROP POLICY IF EXISTS "google_sync_logs_client_delete" ON google_ads_sync_logs;
DROP POLICY IF EXISTS "service_role_full_access_sync_logs" ON google_ads_sync_logs;

-- Create proper client-isolated policies (via connection relationship)
CREATE POLICY "google_sync_logs_client_select"
  ON google_ads_sync_logs
  FOR SELECT
  TO authenticated
  USING (
    connection_id IN (
      SELECT gac.id 
      FROM google_ads_connections gac
      JOIN clients c ON c.id = gac.client_id
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

CREATE POLICY "google_sync_logs_client_insert"
  ON google_ads_sync_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    connection_id IN (
      SELECT gac.id 
      FROM google_ads_connections gac
      JOIN clients c ON c.id = gac.client_id
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

CREATE POLICY "google_sync_logs_client_update"
  ON google_ads_sync_logs
  FOR UPDATE
  TO authenticated
  USING (
    connection_id IN (
      SELECT gac.id 
      FROM google_ads_connections gac
      JOIN clients c ON c.id = gac.client_id
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    connection_id IN (
      SELECT gac.id 
      FROM google_ads_connections gac
      JOIN clients c ON c.id = gac.client_id
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

CREATE POLICY "google_sync_logs_client_delete"
  ON google_ads_sync_logs
  FOR DELETE
  TO authenticated
  USING (
    connection_id IN (
      SELECT gac.id 
      FROM google_ads_connections gac
      JOIN clients c ON c.id = gac.client_id
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

-- Service role needs full access
CREATE POLICY "service_role_full_access_sync_logs"
  ON google_ads_sync_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY "google_sync_logs_client_select" ON google_ads_sync_logs IS 
  'Users can only view sync logs for connections belonging to clients in their organization';

DO $
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename IN (
    'google_ads_connections',
    'google_ads_campaigns',
    'google_ads_metrics',
    'google_ads_sync_logs'
  );
  
  RAISE NOTICE '✓ Phase 5 Complete: RLS policies updated for all Google Ads tables (% total policies)', policy_count;
END $;

-- =====================================================
-- PHASE 6: Verification and Validation
-- =====================================================

DO $
BEGIN
  RAISE NOTICE '=== PHASE 6: Verification and Validation ===';
END $;

-- Verify encryption keys table structure
DO $
DECLARE
  encryption_cols TEXT[];
BEGIN
  SELECT ARRAY_AGG(column_name ORDER BY ordinal_position) INTO encryption_cols
  FROM information_schema.columns
  WHERE table_name = 'google_ads_encryption_keys';
  
  RAISE NOTICE 'google_ads_encryption_keys columns: %', encryption_cols;
END $;

-- Verify audit log table structure
DO $
DECLARE
  audit_cols TEXT[];
BEGIN
  SELECT ARRAY_AGG(column_name ORDER BY ordinal_position) INTO audit_cols
  FROM information_schema.columns
  WHERE table_name = 'google_ads_audit_log';
  
  RAISE NOTICE 'google_ads_audit_log columns: %', audit_cols;
END $;

-- Verify RLS policies
DO $
DECLARE
  policy_summary TEXT;
BEGIN
  SELECT STRING_AGG(
    tablename || ': ' || COUNT(*)::TEXT || ' policies',
    ', '
    ORDER BY tablename
  ) INTO policy_summary
  FROM pg_policies
  WHERE tablename IN (
    'google_ads_encryption_keys',
    'google_ads_connections',
    'google_ads_campaigns',
    'google_ads_metrics',
    'google_ads_sync_logs',
    'google_ads_audit_log'
  )
  GROUP BY tablename;
  
  RAISE NOTICE 'RLS Policy Summary: %', policy_summary;
END $;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

DO $
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✓ MIGRATION COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'All Google Ads schema fixes have been applied successfully.';
  RAISE NOTICE '';
  RAISE NOTICE 'Summary:';
  RAISE NOTICE '  ✓ Phase 1: google_ads_encryption_keys - Added algorithm, version, key_hash';
  RAISE NOTICE '  ✓ Phase 2: google_ads_audit_log - Added client_id and related columns';
  RAISE NOTICE '  ✓ Phase 3: Migrated existing audit log data';
  RAISE NOTICE '  ✓ Phase 4: Updated audit log RLS policies';
  RAISE NOTICE '  ✓ Phase 5: Updated RLS policies for all Google Ads tables';
  RAISE NOTICE '  ✓ Phase 6: Verification complete';
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '  1. Test OAuth flow and token encryption';
  RAISE NOTICE '  2. Test campaign synchronization';
  RAISE NOTICE '  3. Verify RLS policies are working correctly';
  RAISE NOTICE '  4. Monitor logs for any remaining errors';
  RAISE NOTICE '';
END $;
