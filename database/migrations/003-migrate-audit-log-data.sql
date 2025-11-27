-- =====================================================
-- Migration: Migrate existing audit log data
-- =====================================================
-- This migration populates client_id for existing audit logs
-- by deriving it from the connection_id or user context
-- =====================================================

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

-- Step 5: Report on any remaining audit logs without client_id
DO $$
DECLARE
  orphaned_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphaned_count
  FROM google_ads_audit_log
  WHERE client_id IS NULL;
  
  IF orphaned_count > 0 THEN
    RAISE NOTICE 'Warning: % audit log entries still have no client_id', orphaned_count;
    RAISE NOTICE 'These entries may need manual review or can be safely deleted if they are old/invalid';
  ELSE
    RAISE NOTICE 'Success: All audit log entries have been migrated with client_id';
  END IF;
END $$;

-- Step 6: Create a view to identify orphaned audit logs for manual review
CREATE OR REPLACE VIEW orphaned_audit_logs AS
SELECT 
  id,
  user_id,
  connection_id,
  operation,
  action,
  created_at,
  CASE 
    WHEN connection_id IS NOT NULL THEN 'Connection exists but no client found'
    WHEN user_id IS NOT NULL THEN 'User exists but no client association'
    ELSE 'No connection or user information'
  END AS orphan_reason
FROM google_ads_audit_log
WHERE client_id IS NULL
ORDER BY created_at DESC;

-- Step 7: Add a comment to the view
COMMENT ON VIEW orphaned_audit_logs IS 'Audit logs that could not be automatically migrated to have a client_id';

-- Verification query
SELECT 
  COUNT(*) as total_logs,
  COUNT(client_id) as logs_with_client,
  COUNT(*) - COUNT(client_id) as logs_without_client,
  ROUND(100.0 * COUNT(client_id) / NULLIF(COUNT(*), 0), 2) as migration_percentage
FROM google_ads_audit_log;

