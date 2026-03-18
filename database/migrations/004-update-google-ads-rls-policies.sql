-- =====================================================
-- Migration: Update RLS Policies for Client Isolation
-- =====================================================
-- This migration updates RLS policies for all Google Ads tables
-- to enforce proper client-level data isolation
-- =====================================================

-- =====================================================
-- 1. google_ads_connections - Client Isolation
-- =====================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "authenticated_users_can_access_all" ON google_ads_connections;

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

-- =====================================================
-- 2. google_ads_campaigns - Client Isolation
-- =====================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "authenticated_users_can_access_all" ON google_ads_campaigns;

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

-- =====================================================
-- 3. google_ads_metrics - Client Isolation via Campaign
-- =====================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "authenticated_users_can_access_all" ON google_ads_metrics;

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

-- =====================================================
-- 4. google_ads_sync_logs - Client Isolation via Connection
-- =====================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "authenticated_users_can_access_all" ON google_ads_sync_logs;

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

-- =====================================================
-- 5. Service Role Policies (Bypass RLS)
-- =====================================================

-- Service role needs full access for background jobs and admin operations
CREATE POLICY "service_role_full_access_connections"
  ON google_ads_connections
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role_full_access_campaigns"
  ON google_ads_campaigns
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role_full_access_metrics"
  ON google_ads_metrics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role_full_access_sync_logs"
  ON google_ads_sync_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- Verification Queries
-- =====================================================

-- Verify policies are in place
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN (
  'google_ads_connections',
  'google_ads_campaigns',
  'google_ads_metrics',
  'google_ads_sync_logs',
  'google_ads_audit_log'
)
ORDER BY tablename, policyname;

-- Test query to verify client isolation
-- (This should only return data for clients the user has access to)
SELECT 
  'google_ads_connections' as table_name,
  COUNT(*) as accessible_rows
FROM google_ads_connections
UNION ALL
SELECT 
  'google_ads_campaigns' as table_name,
  COUNT(*) as accessible_rows
FROM google_ads_campaigns
UNION ALL
SELECT 
  'google_ads_metrics' as table_name,
  COUNT(*) as accessible_rows
FROM google_ads_metrics
UNION ALL
SELECT 
  'google_ads_sync_logs' as table_name,
  COUNT(*) as accessible_rows
FROM google_ads_sync_logs
UNION ALL
SELECT 
  'google_ads_audit_log' as table_name,
  COUNT(*) as accessible_rows
FROM google_ads_audit_log;

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON POLICY "google_connections_client_select" ON google_ads_connections IS 
  'Users can only view Google Ads connections for clients in their organization';

COMMENT ON POLICY "google_campaigns_client_select" ON google_ads_campaigns IS 
  'Users can only view Google Ads campaigns for clients in their organization';

COMMENT ON POLICY "google_metrics_client_select" ON google_ads_metrics IS 
  'Users can only view metrics for campaigns belonging to clients in their organization';

COMMENT ON POLICY "google_sync_logs_client_select" ON google_ads_sync_logs IS 
  'Users can only view sync logs for connections belonging to clients in their organization';

-- =====================================================
-- Migration Complete
-- =====================================================
