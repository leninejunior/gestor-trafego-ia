# Quick Start: Audit Log Data Migration

## 🚀 Quick Execution Steps

### Step 1: Check Current Status
```bash
node scripts/migrate-audit-log-data.js
```

This will show you:
- Total audit logs
- Logs with `client_id`
- Logs without `client_id`
- Migration percentage

### Step 2: Execute Migration

**In Supabase SQL Editor:**

1. Go to: https://supabase.com/dashboard → Your Project → SQL Editor
2. Click "New Query"
3. Copy and paste the entire contents of: `database/migrations/003-migrate-audit-log-data.sql`
4. Click "Run" or press `Ctrl+Enter`

### Step 3: Verify Results

The migration will output:
```
NOTICE: Success: All audit log entries have been migrated with client_id
```

Or if there are orphaned logs:
```
NOTICE: Warning: X audit log entries still have no client_id
```

### Step 4: Check Migration Status Again
```bash
node scripts/migrate-audit-log-data.js
```

You should see `migration_percentage` close to 100%.

## 📊 What Gets Migrated

### Automatically Migrated:
- ✅ Logs with `connection_id` → Gets `client_id` from connection
- ✅ Logs with `user_id` → Gets `client_id` from user's first client
- ✅ Legacy `action` → Copied to `operation`
- ✅ Legacy `details` → Copied to `metadata`

### May Need Manual Review:
- ⚠️ Logs with no `connection_id` or `user_id`
- ⚠️ Logs referencing deleted connections
- ⚠️ Logs with invalid user references

## 🔍 View Orphaned Logs

In Supabase SQL Editor:
```sql
SELECT * FROM orphaned_audit_logs;
```

## 🛠️ Handle Orphaned Logs

### Option 1: Manual Assignment
```sql
UPDATE google_ads_audit_log
SET client_id = 'your-client-uuid-here'
WHERE id = 'orphaned-log-uuid-here';
```

### Option 2: Delete Old Entries
```sql
DELETE FROM google_ads_audit_log
WHERE client_id IS NULL
  AND created_at < NOW() - INTERVAL '90 days';
```

### Option 3: Keep for Historical Reference
No action needed - they won't affect new operations.

## ✅ Verification Query

```sql
SELECT 
  COUNT(*) as total_logs,
  COUNT(client_id) as logs_with_client,
  COUNT(*) - COUNT(client_id) as logs_without_client,
  ROUND(100.0 * COUNT(client_id) / NULLIF(COUNT(*), 0), 2) as migration_percentage
FROM google_ads_audit_log;
```

## 🎯 Success Criteria

- ✅ Migration percentage > 95%
- ✅ No errors during execution
- ✅ Orphaned logs reviewed and handled
- ✅ New audit logs include `client_id`

## 📝 Post-Migration Checklist

- [ ] Migration executed successfully
- [ ] Verification query shows high percentage
- [ ] Orphaned logs reviewed
- [ ] Audit logging code updated to include `client_id`
- [ ] RLS policies tested and working

## 🆘 Troubleshooting

### "No rows updated"
- Check if logs already have `client_id`
- Verify audit logs exist in the table

### "Many orphaned logs"
- Review `orphaned_audit_logs` view
- Decide: manual assignment, delete, or keep

### "RLS policies not working"
- Re-run: `database/migrations/002-add-client-id-to-audit-log.sql`
- Check policy definitions in Supabase Dashboard

## 📚 Full Documentation

For detailed information, see:
- `database/migrations/AUDIT_LOG_DATA_MIGRATION_GUIDE.md`

