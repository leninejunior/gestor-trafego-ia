-- =====================================================
-- SIMPLIFIED MIGRATION: Fix Google Ads Schema
-- =====================================================
-- Version without DO blocks for Supabase SQL Editor
-- Safe to run multiple times (uses IF NOT EXISTS)
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- PHASE 1: Fix google_ads_encryption_keys table
-- =====================================================

-- Add algorithm column
ALTER TABLE google_ads_encryption_keys 
ADD COLUMN IF NOT EXISTS algorithm VARCHAR(50) DEFAULT 'aes-256-gcm';

-- Add version column
ALTER TABLE google_ads_encryption_keys 
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- Add key_hash column
ALTER TABLE google_ads_encryption_keys 
ADD COLUMN IF NOT EXISTS key_hash TEXT;

-- Update existing rows
UPDATE google_ads_encryption_keys 
SET version = 1 
WHERE version IS NULL;

UPDATE google_ads_encryption_keys 
SET algorithm = 'aes-256-gcm' 
WHERE algorithm IS NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_google_encryption_version 
ON google_ads_encryption_keys(version DESC);

CREATE INDEX IF NOT EXISTS idx_google_encryption_active_expires 
ON google_ads_encryption_keys(is_active, expires_at DESC) 
WHERE is_active = true;

-- Add comments
COMMENT ON COLUMN google_ads_encryption_keys.algorithm IS 'Encryption algorithm used (e.g., aes-256-gcm)';
COMMENT ON COLUMN google_ads_encryption_keys.version IS 'Key version number for rotation support';
COMMENT ON COLUMN google_ads_encryption_keys.key_hash IS 'Encrypted key data (encrypted with master key)';

-- =====================================================
-- PHASE 2: Fix google_ads_audit_log table
-- =====================================================

-- Add client_id column
ALTER TABLE google_ads_audit_log 
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE CASCADE;

-- Add connection_id column
ALTER TABLE google_ads_audit_log 
ADD COLUMN IF NOT EXISTS connection_id UUID REFERENCES google_ads_connections(id) ON DELETE CASCADE;

-- Add operation column
ALTER TABLE google_ads_audit_log 
ADD COLUMN IF NOT EXISTS operation TEXT;

-- Add metadata column
ALTER TABLE google_ads_audit_log 
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Add resource_type column
ALTER TABLE google_ads_audit_log 
ADD COLUMN IF NOT EXISTS resource_type TEXT;

-- Add resource_id column
ALTER TABLE google_ads_audit_log 
ADD COLUMN IF NOT EXISTS resource_id TEXT;

-- Add success column
ALTER TABLE google_ads_audit_log 
ADD COLUMN IF NOT EXISTS success BOOLEAN DEFAULT true;

-- Add error_message column
ALTER TABLE google_ads_audit_log 
ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Add sensitive_data flag
ALTER TABLE google_ads_audit_log 
ADD COLUMN IF NOT EXISTS sensitive_data BOOLEAN DEFAULT false;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_google_audit_client 
ON google_ads_audit_log(client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_google_audit_connection 
ON google_ads_audit_log(connection_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_google_audit_operation 
ON google_ads_audit_log(operation, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_google_audit_success 
ON google_ads_audit_log(success, created_at DESC) 
WHERE success = false;

-- Add comments
COMMENT ON COLUMN google_ads_audit_log.client_id IS 'Client associated with this audit event';
COMMENT ON COLUMN google_ads_audit_log.connection_id IS 'Google Ads connection associated with this event';
COMMENT ON COLUMN google_ads_audit_log.operation IS 'Type of operation performed (e.g., connect, sync, token_refresh)';
COMMENT ON COLUMN google_ads_audit_log.metadata IS 'Additional structured data about the operation';
COMMENT ON COLUMN google_ads_audit_log.resource_type IS 'Type of resource affected (e.g., google_ads_connection, campaign)';
COMMENT ON COLUMN google_ads_audit_log.resource_id IS 'ID of the specific resource affected';
COMMENT ON COLUMN google_ads_audit_log.success IS 'Whether the operation succeeded';
COMMENT ON COLUMN google_ads_audit_log.error_message IS 'Error message if operation failed';
COMMENT ON COLUMN google_ads_audit_log.sensitive_data IS 'Flag indicating if this log contains sensitive data';

-- =====================================================
-- PHASE 3: Migrate existing audit log data
-- =====================================================

-- Update audit logs that have connection_id but no client_id
UPDATE google_ads_audit_log AS audit
SET client_id = conn.client_id
FROM google_ads_connections AS conn
WHERE audit.connection_id = conn.id
  AND audit.client_id IS NULL
  AND audit.connection_id IS NOT NULL;

-- For audit logs without connection_id, try to derive from user's first client
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

-- Migrate legacy 'action' field to 'operation'
UPDATE google_ads_audit_log
SET operation = action
WHERE operation IS NULL
  AND action IS NOT NULL;

-- Migrate legacy 'details' field to 'metadata'
UPDATE google_ads_audit_log
SET metadata = details
WHERE metadata IS NULL
  AND details IS NOT NULL;

-- =====================================================
-- PHASE 4: Update RLS Policies for Audit Log
-- =====================================================

-- Drop existing policies
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

-- =====================================================
-- PHASE 5: Update RLS Policies for google_ads_connections
-- =====================================================

DROP POLICY IF EXISTS "authenticated_users_can_access_all" ON google_ads_connections;
DROP POLICY IF EXISTS "google_connections_client_select" ON google_ads_connections;
DROP POLICY IF EXISTS "google_connections_client_insert" ON google_ads_connections;
DROP POLICY IF EXISTS "google_connections_client_update" ON google_ads_connections;
DROP POLICY IF EXISTS "google_connections_client_delete" ON google_ads_connections;
DROP POLICY IF EXISTS "service_role_full_access_connections" ON google_ads_connections;

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

CREATE POLICY "service_role_full_access_connections"
  ON google_ads_connections
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- PHASE 6: Update RLS Policies for google_ads_campaigns
-- =====================================================

DROP POLICY IF EXISTS "authenticated_users_can_access_all" ON google_ads_campaigns;
DROP POLICY IF EXISTS "google_campaigns_client_select" ON google_ads_campaigns;
DROP POLICY IF EXISTS "google_campaigns_client_insert" ON google_ads_campaigns;
DROP POLICY IF EXISTS "google_campaigns_client_update" ON google_ads_campaigns;
DROP POLICY IF EXISTS "google_campaigns_client_delete" ON google_ads_campaigns;
DROP POLICY IF EXISTS "service_role_full_access_campaigns" ON google_ads_campaigns;

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

CREATE POLICY "service_role_full_access_campaigns"
  ON google_ads_campaigns
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- PHASE 7: Update RLS Policies for google_ads_metrics
-- =====================================================

DROP POLICY IF EXISTS "authenticated_users_can_access_all" ON google_ads_metrics;
DROP POLICY IF EXISTS "google_metrics_client_select" ON google_ads_metrics;
DROP POLICY IF EXISTS "google_metrics_client_insert" ON google_ads_metrics;
DROP POLICY IF EXISTS "google_metrics_client_update" ON google_ads_metrics;
DROP POLICY IF EXISTS "google_metrics_client_delete" ON google_ads_metrics;
DROP POLICY IF EXISTS "service_role_full_access_metrics" ON google_ads_metrics;

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

CREATE POLICY "service_role_full_access_metrics"
  ON google_ads_metrics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- PHASE 8: Update RLS Policies for google_ads_sync_logs
-- =====================================================

DROP POLICY IF EXISTS "authenticated_users_can_access_all" ON google_ads_sync_logs;
DROP POLICY IF EXISTS "google_sync_logs_client_select" ON google_ads_sync_logs;
DROP POLICY IF EXISTS "google_sync_logs_client_insert" ON google_ads_sync_logs;
DROP POLICY IF EXISTS "google_sync_logs_client_update" ON google_ads_sync_logs;
DROP POLICY IF EXISTS "google_sync_logs_client_delete" ON google_ads_sync_logs;
DROP POLICY IF EXISTS "service_role_full_access_sync_logs" ON google_ads_sync_logs;

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

CREATE POLICY "service_role_full_access_sync_logs"
  ON google_ads_sync_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

SELECT 'Migration completed successfully!' as status;
