# Analysis: org_id vs organization_id in memberships table

## Executive Summary

After comprehensive analysis of the codebase, I found that:

1. **The `memberships` table currently uses `org_id`** (as defined in `database/complete-schema.sql`)
2. **There is a migration script** (`database/user-management-schema.sql`) that attempts to rename `org_id` to `organization_id`
3. **The codebase is INCONSISTENT** - some files use `org_id`, others use `organization_id`
4. **No actual errors found** in the Google Ads specific routes mentioned in the task

## Database Schema Status

### Current Schema (database/complete-schema.sql)
```sql
CREATE TABLE IF NOT EXISTS memberships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,  -- ✅ Uses org_id
  role TEXT DEFAULT 'admin',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, org_id)
);
```

### Migration Script (database/user-management-schema.sql)
```sql
-- Renomear coluna org_id para organization_id se necessário
DO $ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'memberships' AND column_name = 'org_id') THEN
        ALTER TABLE memberships RENAME COLUMN org_id TO organization_id;
    END IF;
END $;
```

**Status**: This migration may or may not have been applied to the production database.

## Code Analysis

### Files Using `org_id` (CORRECT if migration not applied)

1. **src/lib/middleware/super-admin-middleware.ts** ✅
   - Line 71-73: Correctly queries `memberships.org_id`
   ```typescript
   const { data: memberships } = await supabase
     .from('memberships')
     .select('org_id')
     .eq('user_id', userId)
   ```

### Files Using `organization_id` (CORRECT if migration applied)

1. **src/lib/services/plan-configuration-service.ts** ⚠️
   - Line 180-182: Uses `organization_id`
   ```typescript
   const { data: membership, error: memberError } = await supabase
     .from('memberships')
     .select('organization_id')
     .eq('user_id', userId)
   ```
   - Line 217-219: Uses `organization_id`

2. **src/lib/middleware/plan-limits.ts** ⚠️
   - Line 30-32: Uses `organization_id`
   - Line 127-129: Uses `organization_id`
   - Line 143-145: Uses `organization_id`

3. **src/lib/middleware/admin-auth-improved.ts** ⚠️
   - Line 68-70: Uses `organization_id` (in comments, not actual query)

4. **src/hooks/use-platform-connections.ts** ⚠️
   - Line 58-61: Uses `organization_id`

### Files Using `organization_memberships` table (DIFFERENT TABLE)

These files reference a completely different table called `organization_memberships`:
- src/__tests__/webhooks/account-creation-service.test.ts
- src/__tests__/webhooks/account-creation-automation.test.ts
- src/__tests__/security/google-ads-rls.test.ts
- src/lib/webhooks/account-creation-service.ts
- src/lib/services/subscription-notification-integration.ts
- src/lib/middleware/feature-gate.ts
- src/lib/meta/sync-service.ts

**Note**: This is a DIFFERENT table and not related to the `memberships` table issue.

## Google Ads Specific Routes Analysis

### Files Mentioned in Task

1. **src/app/api/google/auth-simple/route.ts** ✅
   - **Status**: NO membership queries found
   - This file does not query the memberships table at all

2. **src/app/api/google/sync/status/route.ts** ✅
   - **Status**: NO membership queries found
   - Line 60: Has a comment "Simplified: Skip membership verification for now to avoid errors"
   - This file intentionally skips membership checks

## SQL Files Using Correct Column Names

### Files using `organization_id` (assuming migration applied)
- database/subscription-plans-schema.sql (line 162)
- database/user-management-schema.sql (migration script)

### Files using `org_id` (original schema)
- database/complete-schema.sql (table definition)
- database/diagnose-google-connections.sql (line 42)
- database/debug-google-rls.sql (lines 36, 72)

## Root Cause Analysis

The issue is **NOT** in the Google Ads routes as mentioned in the task. The real issue is:

1. **Schema Inconsistency**: The codebase has mixed usage of `org_id` and `organization_id`
2. **Migration Status Unknown**: We don't know if the migration from `org_id` to `organization_id` was applied
3. **Multiple Files Affected**: Several service files use `organization_id` which will fail if the migration wasn't applied

## Recommended Actions

### Option 1: Keep `org_id` (Simpler)
1. Update all TypeScript files to use `org_id` instead of `organization_id`
2. Do NOT run the migration script
3. Update SQL diagnostic files to use `org_id` consistently

**Files to fix**:
- src/lib/services/plan-configuration-service.ts (2 locations)
- src/lib/middleware/plan-limits.ts (3 locations)
- src/hooks/use-platform-connections.ts (1 location)
- database/subscription-plans-schema.sql (1 location)

### Option 2: Migrate to `organization_id` (More work)
1. Run the migration script from `database/user-management-schema.sql`
2. Update all SQL files to use `organization_id`
3. Keep TypeScript files as they are (already using `organization_id`)

**Files to fix**:
- database/complete-schema.sql (table definition)
- database/diagnose-google-connections.sql (1 location)
- database/debug-google-rls.sql (2 locations)
- src/lib/middleware/super-admin-middleware.ts (1 location)

## Conclusion

**The task description is misleading**. The Google Ads routes (`auth-simple` and `sync/status`) do NOT have membership query issues. The real problem is a broader codebase inconsistency between `org_id` and `organization_id` usage across multiple service files.

**Recommendation**: Choose Option 1 (keep `org_id`) as it requires fewer changes and maintains consistency with the primary schema definition.
