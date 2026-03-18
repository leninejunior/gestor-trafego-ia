-- =====================================================
-- Migration: Add client_id to google_ads_audit_log
-- =====================================================
-- This migration adds the client_id column to the audit log table
-- to enable client-level filtering and isolation
-- =====================================================

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

-- Update RLS policies to include client_id filtering
DROP POLICY IF EXISTS "Allow service role access to audit log" ON google_ads_audit_log;

-- Service role has full access
CREATE POLICY "service_role_audit_log_access"
  ON google_ads_audit_log
  FOR ALL
  TO service_role
  USING (true);

-- Authenticated users can view audit logs for their clients
DROP POLICY IF EXISTS "authenticated_users_audit_log_access" ON google_ads_audit_log;

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

-- Verify the migration
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'google_ads_audit_log'
ORDER BY ordinal_position;
