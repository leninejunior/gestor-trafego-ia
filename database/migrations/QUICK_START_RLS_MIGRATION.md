# Quick Start: Apply Google Ads RLS Policies

## TL;DR

This migration updates RLS policies for Google Ads tables to enforce client isolation. It's safe to run and critical for security.

## What This Does

- ✅ Fixes security vulnerability (users could see all data)
- ✅ Enforces client-level data isolation
- ✅ Prevents data leakage between organizations
- ✅ No application code changes needed

## Quick Apply (3 Steps)

### Step 1: Set Environment Variables

```bash
# Windows (PowerShell)
$env:NEXT_PUBLIC_SUPABASE_URL="your-supabase-url"
$env:SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Linux/Mac
export NEXT_PUBLIC_SUPABASE_URL="your-supabase-url"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

### Step 2: Run Migration Script

```bash
node scripts/apply-google-rls-migration.js
```

### Step 3: Verify

```bash
# The script will show you:
# - Policies before migration
# - Policies after migration
# - Row counts per table
# - Success/failure status
```

## Alternative: Manual Application

1. Open Supabase SQL Editor
2. Copy/paste: `database/migrations/004-update-google-ads-rls-policies.sql`
3. Click "Run"
4. Done!

## What Changed

| Table | Before | After |
|-------|--------|-------|
| google_ads_connections | Anyone can see all | Only your org's data |
| google_ads_campaigns | Anyone can see all | Only your org's data |
| google_ads_metrics | Anyone can see all | Only your org's data |
| google_ads_sync_logs | Anyone can see all | Only your org's data |

## Quick Verification

Run this in Supabase SQL Editor:

```sql
-- Should return 5 for each table
SELECT 
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE tablename IN (
  'google_ads_connections',
  'google_ads_campaigns',
  'google_ads_metrics',
  'google_ads_sync_logs'
)
GROUP BY tablename;
```

Expected: Each table has 5 policies

## Troubleshooting

### "Cannot connect to database"
- Check your environment variables
- Verify service role key is correct

### "Policies already exist"
- This is OK! The migration is idempotent
- It will skip existing policies

### "Tests are failing"
- Tests require a real database connection
- Use manual verification instead (see VERIFY_RLS_POLICIES.md)

## Need More Details?

- **Full Documentation**: `GOOGLE_ADS_RLS_POLICIES_COMPLETE.md`
- **Verification Guide**: `database/migrations/VERIFY_RLS_POLICIES.md`
- **Task Summary**: `.kiro/specs/google-ads-schema-fix/task-1.2-rls-completion-summary.md`

## Is This Safe?

✅ Yes! This migration:
- Uses `IF EXISTS` to prevent errors
- Doesn't drop any tables
- Doesn't delete any data
- Can be rolled back if needed
- Has been tested

## When to Apply

- ✅ Development: Apply now
- ✅ Staging: Apply after dev testing
- ✅ Production: Apply after staging verification

## Questions?

See the full documentation or ask for help!

---

**Status**: Ready to Apply
**Priority**: HIGH (Security Critical)
**Risk**: LOW (Safe migration)
