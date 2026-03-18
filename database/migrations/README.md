# Google Ads Schema Migration Guide

## Overview

This directory contains SQL migration scripts to fix critical schema issues in the Google Ads integration that were preventing proper synchronization and token management.

## Migration Files

### 1. `fix-google-ads-schema.sql` (Main Migration)
The master migration script that applies all necessary schema fixes in a safe, idempotent manner.

**What it does:**
- ✅ Adds missing columns to `google_ads_encryption_keys` (algorithm, version, key_hash)
- ✅ Adds missing columns to `google_ads_audit_log` (client_id, connection_id, operation, metadata, etc.)
- ✅ Migrates existing audit log data to populate client_id
- ✅ Updates RLS policies for proper client isolation across all Google Ads tables
- ✅ Creates necessary indexes for performance
- ✅ Adds documentation comments to all new columns

**Safety features:**
- Uses `IF NOT EXISTS` clauses - safe to run multiple times
- Preserves all existing data
- Provides detailed progress notifications
- Includes verification steps

### 2. `rollback-google-ads-schema.sql` (Rollback)
Reverts all changes made by the main migration script.

**⚠️ WARNING:** This will remove columns and potentially lose data. Only use if you need to completely undo the migration.

### 3. `verify-google-ads-schema.sql` (Verification)
Comprehensive verification script that runs 10 tests to ensure the migration was successful.

**Tests include:**
- Column existence checks
- Index verification
- RLS policy validation
- Foreign key constraint checks
- Data migration success rate
- Detailed table structure output

### 4. Individual Migration Files (Legacy)
These files were used during development and are now consolidated into the main migration:
- `001-fix-google-ads-encryption-keys.sql`
- `002-add-client-id-to-audit-log.sql`
- `003-migrate-audit-log-data.sql`
- `004-update-google-ads-rls-policies.sql`

## How to Apply the Migration

### Option 1: Using Supabase SQL Editor (Recommended)

1. Open your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy the contents of `fix-google-ads-schema.sql`
4. Paste into the SQL Editor
5. Click "Run" to execute
6. Review the output for any errors or warnings

### Option 2: Using psql Command Line

```bash
# Connect to your database
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-HOST]:5432/postgres"

# Run the migration
\i database/migrations/fix-google-ads-schema.sql

# Verify the migration
\i database/migrations/verify-google-ads-schema.sql
```

### Option 3: Using Node.js Script

```bash
# Using the provided migration script
node scripts/apply-google-encryption-migration.js
```

## Verification

After running the migration, verify it was successful:

1. **Run the verification script:**
   ```sql
   \i database/migrations/verify-google-ads-schema.sql
   ```

2. **Check for PASS messages:**
   - All 10 tests should show ✓ PASS
   - Review any ⚠ WARNING or ✗ FAIL messages

3. **Manual verification:**
   ```sql
   -- Check encryption keys table
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'google_ads_encryption_keys';
   
   -- Check audit log table
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'google_ads_audit_log';
   
   -- Check RLS policies
   SELECT tablename, policyname FROM pg_policies 
   WHERE tablename LIKE 'google_ads%';
   ```

## What Gets Fixed

### Before Migration

**Problems:**
- ❌ `google_ads_encryption_keys` missing `algorithm` column → Crypto service errors
- ❌ `google_ads_audit_log` missing `client_id` column → Audit logging failures
- ❌ Overly permissive RLS policies → No client isolation
- ❌ Missing indexes → Poor query performance

### After Migration

**Solutions:**
- ✅ All required columns present and populated
- ✅ Proper client isolation via RLS policies
- ✅ Optimized indexes for common queries
- ✅ Existing data preserved and migrated
- ✅ Comprehensive documentation

## Rollback Procedure

If you need to undo the migration:

```sql
-- ⚠️ WARNING: This will lose data in the new columns!
\i database/migrations/rollback-google-ads-schema.sql
```

**What gets rolled back:**
- All new columns are removed
- RLS policies are restored to permissive state
- Indexes are dropped
- Data in new columns is lost

## Migration Phases

The migration runs in 6 phases:

1. **Phase 1:** Fix `google_ads_encryption_keys` table
2. **Phase 2:** Fix `google_ads_audit_log` table
3. **Phase 3:** Migrate existing audit log data
4. **Phase 4:** Update audit log RLS policies
5. **Phase 5:** Update RLS policies for all Google Ads tables
6. **Phase 6:** Verification and validation

Each phase includes:
- Progress notifications
- Error handling
- Success confirmation
- Detailed logging

## Troubleshooting

### Migration fails with "column already exists"
**Solution:** This is expected if you've run the migration before. The script uses `IF NOT EXISTS` so it's safe to continue.

### Migration fails with "relation does not exist"
**Solution:** Ensure the base Google Ads schema has been created first:
```sql
\i database/google-ads-schema.sql
```

### Verification shows orphaned audit logs
**Solution:** This is normal for old logs without connection information. They can be:
- Left as-is (they won't break anything)
- Manually reviewed using the `orphaned_audit_logs` view
- Deleted if they're old and no longer needed

### RLS policies block legitimate access
**Solution:** Verify the user's membership:
```sql
SELECT * FROM memberships WHERE user_id = auth.uid();
SELECT * FROM clients WHERE org_id IN (
  SELECT organization_id FROM memberships WHERE user_id = auth.uid()
);
```

## Post-Migration Steps

After successfully applying the migration:

1. **Test OAuth flow:**
   - Connect a Google Ads account
   - Verify tokens are encrypted
   - Check audit logs are created with client_id

2. **Test synchronization:**
   - Run a campaign sync
   - Verify campaigns are fetched
   - Check sync logs are created

3. **Verify RLS policies:**
   - Test with multiple users
   - Ensure users only see their clients' data
   - Verify super admin access works

4. **Monitor logs:**
   - Check for any remaining schema errors
   - Verify crypto service initializes correctly
   - Ensure audit logging works

5. **Update documentation:**
   - Mark Task 5.1 as complete
   - Document any issues encountered
   - Update CHANGELOG.md

## Related Documentation

- [Google Ads Schema Reference](../GOOGLE_ADS_SCHEMA_REFERENCE.md)
- [Migration Guide](./AUDIT_LOG_DATA_MIGRATION_GUIDE.md)
- [RLS Verification](./VERIFY_RLS_POLICIES.md)
- [Quick Start Guide](./QUICK_START_AUDIT_MIGRATION.md)

## Support

If you encounter issues:

1. Check the verification script output
2. Review Supabase logs for errors
3. Check application logs for schema-related errors
4. Consult the troubleshooting section above
5. Review related tasks in `.kiro/specs/google-ads-schema-fix/`

## Version History

- **v1.0.0** (2024-11-24): Initial migration consolidating all schema fixes
  - Encryption keys table fixes
  - Audit log table fixes
  - RLS policy updates
  - Data migration
  - Comprehensive verification

## Safety Notes

✅ **Safe to run multiple times** - Uses `IF NOT EXISTS` clauses
✅ **Preserves existing data** - No data loss in main migration
✅ **Includes rollback** - Can be undone if needed
✅ **Comprehensive verification** - 10 automated tests
✅ **Detailed logging** - Progress notifications throughout

⚠️ **Rollback loses data** - New columns are dropped
⚠️ **RLS changes affect access** - Test thoroughly after migration
⚠️ **Requires service role** - Some operations need elevated privileges
