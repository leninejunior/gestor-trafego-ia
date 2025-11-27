-- =====================================================
-- Debug Script: Verify Google Ads RLS Isolation
-- =====================================================
-- This script helps verify that RLS policies are working
-- and that you only see your organization's data
-- =====================================================

-- Step 1: Check your current user and organization
SELECT 'Current User Info:' as section;
SELECT 
  auth.uid() as current_user_id,
  COUNT(*) as membership_count
FROM memberships
WHERE user_id = auth.uid()
GROUP BY auth.uid();

-- Step 2: Show your organizations
SELECT 'Your Organizations:' as section;
SELECT 
  m.organization_id,
  o.name as organization_name,
  m.role,
  m.status
FROM memberships m
LEFT JOIN organizations o ON m.organization_id = o.id
WHERE m.user_id = auth.uid();

-- Step 3: Show your clients
SELECT 'Your Clients:' as section;
SELECT 
  c.id,
  c.name,
  c.org_id,
  COUNT(gac.id) as google_connections_count
FROM clients c
INNER JOIN memberships m ON m.organization_id = c.org_id
LEFT JOIN google_ads_connections gac ON gac.client_id = c.id
WHERE m.user_id = auth.uid() AND m.status = 'active'
GROUP BY c.id, c.name, c.org_id;

-- Step 4: Show Google Ads connections visible to you (with RLS)
SELECT 'Google Ads Connections (with RLS):' as section;
SELECT 
  gac.id,
  gac.customer_id,
  c.name as client_name,
  gac.status,
  gac.created_at
FROM google_ads_connections gac
LEFT JOIN clients c ON gac.client_id = c.id
ORDER BY gac.created_at DESC;

-- Step 5: Show ALL Google Ads connections (bypass RLS - admin only)
SELECT 'ALL Google Ads Connections (total in DB):' as section;
SELECT 
  COUNT(*) as total_connections
FROM google_ads_connections;

-- Step 6: Identify connections NOT in your organization
SELECT 'Connections NOT in your organization (potential data leak):' as section;
SELECT 
  gac.id,
  gac.customer_id,
  c.name as client_name,
  c.org_id,
  gac.status
FROM google_ads_connections gac
LEFT JOIN clients c ON gac.client_id = c.id
WHERE gac.client_id NOT IN (
  SELECT c2.id 
  FROM clients c2
  INNER JOIN memberships m ON m.organization_id = c2.org_id
  WHERE m.user_id = auth.uid() AND m.status = 'active'
);
