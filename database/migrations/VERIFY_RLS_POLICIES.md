# Verify Google Ads RLS Policies

This guide helps you manually verify that the RLS policies are correctly configured for client isolation.

## Prerequisites

- Access to Supabase SQL Editor
- At least one test user account
- At least two different clients in different organizations

## Step 1: Check RLS is Enabled

Run this query in Supabase SQL Editor:

```sql
SELECT 
  c.relname as table_name,
  c.relrowsecurity as rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relname IN (
  'google_ads_connections',
  'google_ads_campaigns',
  'google_ads_metrics',
  'google_ads_sync_logs',
  'google_ads_audit_log'
)
AND n.nspname = 'public'
ORDER BY c.relname;
```

**Expected Result**: All tables should have `rls_enabled = true`

## Step 2: Check Policy Count

Run this query to count policies per table:

```sql
SELECT 
  tablename,
  COUNT(*) as policy_count,
  array_agg(policyname ORDER BY policyname) as policies
FROM pg_policies
WHERE tablename IN (
  'google_ads_connections',
  'google_ads_campaigns',
  'google_ads_metrics',
  'google_ads_sync_logs',
  'google_ads_audit_log'
)
GROUP BY tablename
ORDER BY tablename;
```

**Expected Result**:
- `google_ads_connections`: 5 policies (4 client + 1 service_role)
- `google_ads_campaigns`: 5 policies (4 client + 1 service_role)
- `google_ads_metrics`: 5 policies (4 client + 1 service_role)
- `google_ads_sync_logs`: 5 policies (4 client + 1 service_role)
- `google_ads_audit_log`: 2 policies (1 authenticated + 1 service_role)

## Step 3: Check Policy Details

Run this query to see all policy details:

```sql
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles::text[] as roles,
  cmd as operation,
  CASE 
    WHEN LENGTH(qual::text) > 100 THEN LEFT(qual::text, 100) || '...'
    ELSE qual::text
  END as using_clause,
  CASE 
    WHEN LENGTH(with_check::text) > 100 THEN LEFT(with_check::text, 100) || '...'
    ELSE with_check::text
  END as with_check_clause
FROM pg_policies
WHERE tablename IN (
  'google_ads_connections',
  'google_ads_campaigns',
  'google_ads_metrics',
  'google_ads_sync_logs',
  'google_ads_audit_log'
)
ORDER BY tablename, policyname;
```

**Expected Result**: You should see policies with names like:
- `google_connections_client_select`
- `google_connections_client_insert`
- `google_connections_client_update`
- `google_connections_client_delete`
- `service_role_full_access_connections`

## Step 4: Verify No Overly Permissive Policies

Run this query to check for the old insecure policies:

```sql
SELECT 
  tablename,
  policyname
FROM pg_policies
WHERE tablename IN (
  'google_ads_connections',
  'google_ads_campaigns',
  'google_ads_metrics',
  'google_ads_sync_logs'
)
AND policyname = 'authenticated_users_can_access_all';
```

**Expected Result**: Should return 0 rows (no overly permissive policies)

## Step 5: Test Client Isolation (As Regular User)

### 5.1 Create Test Data

First, as service role, create some test data:

```sql
-- Insert a test connection for a specific client
INSERT INTO google_ads_connections (
  client_id,
  customer_id,
  refresh_token,
  access_token,
  status
) VALUES (
  'YOUR_CLIENT_ID_HERE',  -- Replace with actual client ID
  'test-customer-123',
  'encrypted-refresh-token',
  'encrypted-access-token',
  'active'
);
```

### 5.2 Test as Regular User

Log in as a regular user (not service role) and run:

```sql
-- This should only return connections for clients in your organization
SELECT 
  id,
  client_id,
  customer_id,
  status
FROM google_ads_connections;
```

**Expected Result**: 
- You should ONLY see connections for clients in your organization
- You should NOT see connections for clients in other organizations

### 5.3 Test Cross-Organization Access

Try to access a connection from another organization:

```sql
-- Replace with a connection ID from another organization
SELECT * FROM google_ads_connections 
WHERE id = 'CONNECTION_ID_FROM_OTHER_ORG';
```

**Expected Result**: Should return 0 rows (access denied by RLS)

## Step 6: Test Service Role Access

Using service role credentials, run:

```sql
-- Service role should see ALL connections
SELECT COUNT(*) as total_connections
FROM google_ads_connections;
```

**Expected Result**: Should return all connections across all organizations

## Step 7: Test Cascading Isolation

### 7.1 Test Metrics Isolation

```sql
-- As regular user, this should only return metrics for campaigns
-- belonging to clients in your organization
SELECT 
  m.id,
  m.campaign_id,
  c.client_id,
  m.date,
  m.impressions
FROM google_ads_metrics m
JOIN google_ads_campaigns c ON c.id = m.campaign_id;
```

**Expected Result**: Only metrics for your organization's campaigns

### 7.2 Test Sync Logs Isolation

```sql
-- As regular user, this should only return sync logs for connections
-- belonging to clients in your organization
SELECT 
  sl.id,
  sl.connection_id,
  conn.client_id,
  sl.sync_type,
  sl.status
FROM google_ads_sync_logs sl
JOIN google_ads_connections conn ON conn.id = sl.connection_id;
```

**Expected Result**: Only sync logs for your organization's connections

## Step 8: Test Insert/Update/Delete Operations

### 8.1 Test Insert (Should Succeed for Your Client)

```sql
-- As regular user, try to insert a connection for YOUR client
INSERT INTO google_ads_connections (
  client_id,
  customer_id,
  refresh_token,
  access_token,
  status
) VALUES (
  'YOUR_CLIENT_ID',  -- Your organization's client
  'test-customer-456',
  'encrypted-token',
  'encrypted-token',
  'active'
);
```

**Expected Result**: Should succeed

### 8.2 Test Insert (Should Fail for Other Client)

```sql
-- As regular user, try to insert a connection for ANOTHER organization's client
INSERT INTO google_ads_connections (
  client_id,
  customer_id,
  refresh_token,
  access_token,
  status
) VALUES (
  'OTHER_ORG_CLIENT_ID',  -- Another organization's client
  'test-customer-789',
  'encrypted-token',
  'encrypted-token',
  'active'
);
```

**Expected Result**: Should fail with RLS policy violation

### 8.3 Test Update (Should Succeed for Your Data)

```sql
-- As regular user, try to update YOUR connection
UPDATE google_ads_connections
SET status = 'expired'
WHERE id = 'YOUR_CONNECTION_ID';
```

**Expected Result**: Should succeed

### 8.4 Test Update (Should Fail for Other Data)

```sql
-- As regular user, try to update ANOTHER organization's connection
UPDATE google_ads_connections
SET status = 'expired'
WHERE id = 'OTHER_ORG_CONNECTION_ID';
```

**Expected Result**: Should affect 0 rows (silently blocked by RLS)

## Step 9: Verify Audit Log Policies

```sql
-- As regular user, check audit logs
SELECT 
  id,
  client_id,
  operation,
  created_at
FROM google_ads_audit_log
ORDER BY created_at DESC
LIMIT 10;
```

**Expected Result**: Only audit logs for your organization's clients

## Troubleshooting

### Issue: All queries return 0 rows

**Possible Causes**:
1. User is not a member of any organization
2. Organization has no clients
3. RLS policies are too restrictive

**Solution**: Check user's memberships:
```sql
SELECT 
  m.user_id,
  m.organization_id,
  o.name as org_name,
  m.role
FROM memberships m
JOIN organizations o ON o.id = m.organization_id
WHERE m.user_id = auth.uid();
```

### Issue: User can see data from other organizations

**Possible Causes**:
1. RLS policies not applied correctly
2. User has multiple organization memberships
3. Service role is being used instead of user credentials

**Solution**: Re-apply the migration and verify policies

### Issue: Service role operations fail

**Possible Causes**:
1. Service role bypass policies not created
2. Using wrong credentials

**Solution**: Verify service role policies exist:
```sql
SELECT * FROM pg_policies
WHERE policyname LIKE '%service_role%'
AND tablename LIKE 'google_ads%';
```

## Success Criteria

✅ All tables have RLS enabled
✅ Each table has 5 policies (4 client + 1 service_role)
✅ No overly permissive "access all" policies exist
✅ Regular users only see their organization's data
✅ Regular users cannot access other organizations' data
✅ Service role can access all data
✅ Insert/Update/Delete operations respect RLS
✅ Cascading isolation works (metrics, sync_logs)
✅ Audit logs are properly filtered

## Next Steps

Once all verification steps pass:
1. Mark task 1.2 as complete
2. Update the main schema file if needed
3. Document any issues encountered
4. Proceed to next task in the spec

---

**Note**: These verification steps should be performed in a development or staging environment before applying to production.
