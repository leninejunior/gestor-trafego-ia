# Google Ads Audit Log Migration Guide

## Quick Start

This guide helps you add the `client_id` column to the `google_ads_audit_log` table.

## Why This Migration?

The audit log table was missing the `client_id` column, which is essential for:
- Client-level filtering of audit logs
- Proper data isolation between clients
- Compliance and security tracking per client
- Debugging client-specific issues

## Migration Steps

### Step 1: Backup (Optional but Recommended)

```sql
-- Create a backup of existing audit logs
CREATE TABLE google_ads_audit_log_backup AS 
SELECT * FROM google_ads_audit_log;
```

### Step 2: Apply the Migration

**Option A: Using Supabase Dashboard (Recommended)**

1. Open your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the entire contents of `database/migrations/002-add-client-id-to-audit-log.sql`
4. Paste into the SQL Editor
5. Click **Run** or press `Ctrl+Enter`

**Option B: Using the Node.js Script**

```bash
# Make sure you have the required environment variables set
node scripts/apply-audit-log-migration.js
```

### Step 3: Verify the Migration

Run this query in Supabase SQL Editor:

```sql
-- Check all columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'google_ads_audit_log'
ORDER BY ordinal_position;
```

Expected columns:
- ✅ id
- ✅ client_id (NEW)
- ✅ connection_id (NEW)
- ✅ user_id
- ✅ operation (NEW)
- ✅ resource_type (NEW)
- ✅ resource_id (NEW)
- ✅ action (legacy)
- ✅ details (legacy)
- ✅ metadata (NEW)
- ✅ success (NEW)
- ✅ error_message (NEW)
- ✅ sensitive_data (NEW)
- ✅ ip_address
- ✅ user_agent
- ✅ created_at

### Step 4: Test Audit Logging

```sql
-- Insert a test audit log
INSERT INTO google_ads_audit_log (
  client_id,
  operation,
  resource_type,
  success,
  metadata
) VALUES (
  (SELECT id FROM clients LIMIT 1),
  'test_operation',
  'test_resource',
  true,
  '{"test": true}'::jsonb
);

-- Verify it was inserted
SELECT * FROM google_ads_audit_log 
WHERE operation = 'test_operation';

-- Clean up test data
DELETE FROM google_ads_audit_log 
WHERE operation = 'test_operation';
```

## What Changed?

### New Columns

| Column | Type | Purpose |
|--------|------|---------|
| client_id | UUID | Links audit log to specific client |
| connection_id | UUID | Links to Google Ads connection |
| operation | TEXT | Structured operation type |
| resource_type | TEXT | Type of resource affected |
| resource_id | TEXT | Specific resource ID |
| metadata | JSONB | Structured additional data |
| success | BOOLEAN | Operation outcome |
| error_message | TEXT | Error details if failed |
| sensitive_data | BOOLEAN | Flags sensitive operations |

### New Indexes

- `idx_google_audit_client` - Fast client-level queries
- `idx_google_audit_connection` - Fast connection-level queries
- `idx_google_audit_operation` - Fast operation-type queries
- `idx_google_audit_success` - Fast failure queries

### Updated RLS Policies

Users can now only see audit logs for:
- Their own clients (via organization membership)
- Their own user actions

## Rollback (If Needed)

If something goes wrong, you can rollback:

```sql
-- Drop new columns
ALTER TABLE google_ads_audit_log 
DROP COLUMN IF EXISTS client_id,
DROP COLUMN IF EXISTS connection_id,
DROP COLUMN IF EXISTS operation,
DROP COLUMN IF EXISTS resource_type,
DROP COLUMN IF EXISTS resource_id,
DROP COLUMN IF EXISTS metadata,
DROP COLUMN IF EXISTS success,
DROP COLUMN IF EXISTS error_message,
DROP COLUMN IF EXISTS sensitive_data;

-- Drop new indexes
DROP INDEX IF EXISTS idx_google_audit_client;
DROP INDEX IF EXISTS idx_google_audit_connection;
DROP INDEX IF EXISTS idx_google_audit_operation;
DROP INDEX IF EXISTS idx_google_audit_success;

-- Restore old RLS policy
DROP POLICY IF EXISTS "authenticated_users_audit_log_access" ON google_ads_audit_log;
DROP POLICY IF EXISTS "service_role_audit_log_access" ON google_ads_audit_log;

CREATE POLICY "Allow service role access to audit log" 
ON google_ads_audit_log 
FOR ALL 
TO service_role 
USING (true);
```

## Troubleshooting

### Error: "column already exists"

This is safe to ignore. The migration uses `ADD COLUMN IF NOT EXISTS`, so it won't fail if columns already exist.

### Error: "foreign key constraint violation"

This means you have existing audit logs with invalid client_ids. Clean them up:

```sql
-- Find invalid records
SELECT * FROM google_ads_audit_log 
WHERE client_id IS NOT NULL 
  AND client_id NOT IN (SELECT id FROM clients);

-- Option 1: Set invalid client_ids to NULL
UPDATE google_ads_audit_log 
SET client_id = NULL 
WHERE client_id IS NOT NULL 
  AND client_id NOT IN (SELECT id FROM clients);

-- Option 2: Delete invalid records
DELETE FROM google_ads_audit_log 
WHERE client_id IS NOT NULL 
  AND client_id NOT IN (SELECT id FROM clients);
```

### Error: "permission denied"

Make sure you're using the service role key or have sufficient permissions in Supabase.

## Post-Migration

After the migration is complete:

1. ✅ Update your application code to use the new columns
2. ✅ Start using `operation` instead of `action`
3. ✅ Start using `metadata` instead of `details`
4. ✅ Always include `client_id` when logging audit events
5. ✅ Monitor audit logs for any issues

## Support

If you encounter issues:

1. Check the migration file: `database/migrations/002-add-client-id-to-audit-log.sql`
2. Review the completion summary: `.kiro/specs/google-ads-schema-fix/task-1.2-completion-summary.md`
3. Run the integration tests: `npm test src/__tests__/integration/google-audit-log-schema.test.ts`

## Related Files

- Migration: `database/migrations/002-add-client-id-to-audit-log.sql`
- Schema: `database/google-ads-schema.sql`
- Quick Setup: `EXECUTAR_NO_SUPABASE_GOOGLE_ADS.sql`
- Application Script: `scripts/apply-audit-log-migration.js`
- Tests: `src/__tests__/integration/google-audit-log-schema.test.ts`
- Audit Service: `src/lib/google/audit-service.ts`
