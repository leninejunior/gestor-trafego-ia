# Audit Log Data Migration Guide

## Overview

This guide explains how to migrate existing audit log data to populate the `client_id` column for entries that were created before the schema update.

## Migration Files

1. **SQL Migration**: `database/migrations/003-migrate-audit-log-data.sql`
   - Contains the SQL statements to migrate existing data
   - Safe to run multiple times (idempotent)
   - Includes verification queries

2. **Node.js Script**: `scripts/migrate-audit-log-data.js`
   - Checks current migration status
   - Provides guidance for manual execution
   - Identifies orphaned logs

3. **Integration Tests**: `src/__tests__/integration/google-audit-log-data-migration.test.ts`
   - Tests migration logic
   - Validates data integrity
   - Verifies RLS policies

## Migration Strategy

The migration follows this strategy:

### Step 1: Derive from Connection
For audit logs that have a `connection_id`, derive the `client_id` from the `google_ads_connections` table:

```sql
UPDATE google_ads_audit_log AS audit
SET client_id = conn.client_id
FROM google_ads_connections AS conn
WHERE audit.connection_id = conn.id
  AND audit.client_id IS NULL
  AND audit.connection_id IS NOT NULL;
```

### Step 2: Derive from User Context
For audit logs without a `connection_id`, try to derive from the user's first client:

```sql
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
```

### Step 3: Migrate Legacy Fields
Migrate legacy `action` field to `operation`:

```sql
UPDATE google_ads_audit_log
SET operation = action
WHERE operation IS NULL
  AND action IS NOT NULL;
```

Migrate legacy `details` field to `metadata`:

```sql
UPDATE google_ads_audit_log
SET metadata = details
WHERE metadata IS NULL
  AND details IS NOT NULL;
```

## How to Execute

### Option 1: Manual Execution (Recommended)

1. Open Supabase Dashboard
2. Navigate to SQL Editor
3. Copy the contents of `database/migrations/003-migrate-audit-log-data.sql`
4. Paste and execute
5. Review the output for any warnings about orphaned logs

### Option 2: Using the Node.js Script

```bash
node scripts/migrate-audit-log-data.js
```

This script will:
- Check the current migration status
- Show how many logs need migration
- Provide instructions for manual execution
- Identify any orphaned logs

## Verification

After running the migration, verify the results:

```sql
-- Check migration status
SELECT 
  COUNT(*) as total_logs,
  COUNT(client_id) as logs_with_client,
  COUNT(*) - COUNT(client_id) as logs_without_client,
  ROUND(100.0 * COUNT(client_id) / NULLIF(COUNT(*), 0), 2) as migration_percentage
FROM google_ads_audit_log;
```

Expected result: `migration_percentage` should be close to 100%.

## Handling Orphaned Logs

Some audit logs may not be automatically migrated if they:
- Have no `connection_id` or `user_id`
- Reference deleted connections or users
- Were created with invalid data

To view orphaned logs:

```sql
SELECT * FROM orphaned_audit_logs;
```

### Options for Orphaned Logs

1. **Manual Assignment**: If you can identify the correct client, update manually:
   ```sql
   UPDATE google_ads_audit_log
   SET client_id = 'your-client-id'
   WHERE id = 'orphaned-log-id';
   ```

2. **Delete Old Entries**: If they're old and no longer relevant:
   ```sql
   DELETE FROM google_ads_audit_log
   WHERE client_id IS NULL
     AND created_at < NOW() - INTERVAL '90 days';
   ```

3. **Keep for Reference**: They won't affect new operations, so you can keep them for historical purposes.

## Post-Migration

After migration:

1. **Update Audit Logging Code**: Ensure all new audit logs include `client_id`
2. **Monitor New Logs**: Check that new entries have `client_id` populated
3. **Review RLS Policies**: Verify that RLS policies work correctly with `client_id`

## Rollback

If you need to rollback the data migration (not the schema):

```sql
-- Clear migrated client_id values (if needed)
UPDATE google_ads_audit_log
SET client_id = NULL
WHERE client_id IS NOT NULL;

-- Note: This doesn't rollback the schema changes
-- To rollback schema, you'd need to drop the columns
```

## Testing

Run the integration tests to verify migration logic:

```bash
npm test -- src/__tests__/integration/google-audit-log-data-migration.test.ts
```

Note: Tests require valid Supabase credentials in `.env.local`

## Troubleshooting

### Issue: Migration shows 0 rows updated
**Cause**: All logs already have `client_id` or there are no logs
**Solution**: Check if logs exist and if they already have `client_id`

### Issue: Many orphaned logs remain
**Cause**: Logs reference deleted connections or invalid users
**Solution**: Review orphaned logs and decide to delete or manually assign

### Issue: RLS policies not working after migration
**Cause**: Policies may need to be recreated
**Solution**: Re-run the RLS policy creation from `002-add-client-id-to-audit-log.sql`

## Summary

This migration ensures that all audit logs have proper client isolation by populating the `client_id` column. The migration is designed to be safe and idempotent, allowing multiple executions without data corruption.

