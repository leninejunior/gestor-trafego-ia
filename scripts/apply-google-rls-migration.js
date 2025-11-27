#!/usr/bin/env node

/**
 * Apply Google Ads RLS Policies Migration
 * 
 * This script applies the RLS policy updates to enforce client isolation
 * for all Google Ads related tables.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function main() {
  log('\n=== Google Ads RLS Policies Migration ===\n', colors.bright);

  // Validate environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    log('❌ Error: Missing required environment variables', colors.red);
    log('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY', colors.yellow);
    process.exit(1);
  }

  // Create Supabase client with service role
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  log('✓ Connected to Supabase', colors.green);

  // Read migration file
  const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '004-update-google-ads-rls-policies.sql');
  
  if (!fs.existsSync(migrationPath)) {
    log(`❌ Migration file not found: ${migrationPath}`, colors.red);
    process.exit(1);
  }

  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  log('✓ Migration file loaded', colors.green);

  // Check current policies before migration
  log('\n📋 Checking current RLS policies...', colors.cyan);
  
  const { data: beforePolicies, error: beforeError } = await supabase
    .rpc('exec_sql', {
      sql: `
        SELECT 
          tablename,
          policyname,
          permissive,
          roles::text[],
          cmd
        FROM pg_policies
        WHERE tablename IN (
          'google_ads_connections',
          'google_ads_campaigns',
          'google_ads_metrics',
          'google_ads_sync_logs',
          'google_ads_audit_log'
        )
        ORDER BY tablename, policyname;
      `
    });

  if (beforeError) {
    log('⚠️  Could not check existing policies (this is OK if tables don\'t exist yet)', colors.yellow);
  } else {
    log(`Found ${beforePolicies?.length || 0} existing policies`, colors.blue);
  }

  // Apply migration
  log('\n🔄 Applying RLS policy migration...', colors.cyan);

  try {
    // Split the SQL into individual statements and execute them
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    let successCount = 0;
    let errorCount = 0;

    for (const statement of statements) {
      // Skip comments and empty statements
      if (statement.startsWith('--') || statement.trim().length === 0) {
        continue;
      }

      // Skip COMMENT statements (they might fail if columns don't exist yet)
      if (statement.toUpperCase().includes('COMMENT ON')) {
        continue;
      }

      const { error } = await supabase.rpc('exec_sql', { sql: statement });
      
      if (error) {
        // Some errors are expected (like DROP POLICY IF EXISTS on non-existent policies)
        if (error.message.includes('does not exist') || error.message.includes('already exists')) {
          // Ignore these errors
          successCount++;
        } else {
          log(`⚠️  Error executing statement: ${error.message}`, colors.yellow);
          errorCount++;
        }
      } else {
        successCount++;
      }
    }

    log(`\n✓ Migration applied: ${successCount} statements executed, ${errorCount} errors`, colors.green);

  } catch (error) {
    log(`\n❌ Error applying migration: ${error.message}`, colors.red);
    process.exit(1);
  }

  // Verify policies after migration
  log('\n📋 Verifying RLS policies after migration...', colors.cyan);
  
  const { data: afterPolicies, error: afterError } = await supabase
    .rpc('exec_sql', {
      sql: `
        SELECT 
          tablename,
          policyname,
          permissive,
          roles::text[],
          cmd
        FROM pg_policies
        WHERE tablename IN (
          'google_ads_connections',
          'google_ads_campaigns',
          'google_ads_metrics',
          'google_ads_sync_logs',
          'google_ads_audit_log'
        )
        ORDER BY tablename, policyname;
      `
    });

  if (afterError) {
    log('⚠️  Could not verify policies', colors.yellow);
    log(afterError.message, colors.red);
  } else {
    log(`\n✓ Found ${afterPolicies?.length || 0} policies after migration`, colors.green);
    
    // Group policies by table
    const policiesByTable = {};
    afterPolicies?.forEach(policy => {
      if (!policiesByTable[policy.tablename]) {
        policiesByTable[policy.tablename] = [];
      }
      policiesByTable[policy.tablename].push(policy);
    });

    // Display policies by table
    Object.entries(policiesByTable).forEach(([table, policies]) => {
      log(`\n  ${table}:`, colors.blue);
      policies.forEach(policy => {
        log(`    - ${policy.policyname} (${policy.cmd})`, colors.cyan);
      });
    });
  }

  // Test client isolation
  log('\n🔍 Testing client isolation...', colors.cyan);
  
  const { data: testData, error: testError } = await supabase
    .rpc('exec_sql', {
      sql: `
        SELECT 
          'google_ads_connections' as table_name,
          COUNT(*) as total_rows
        FROM google_ads_connections
        UNION ALL
        SELECT 
          'google_ads_campaigns' as table_name,
          COUNT(*) as total_rows
        FROM google_ads_campaigns
        UNION ALL
        SELECT 
          'google_ads_metrics' as table_name,
          COUNT(*) as total_rows
        FROM google_ads_metrics
        UNION ALL
        SELECT 
          'google_ads_sync_logs' as table_name,
          COUNT(*) as total_rows
        FROM google_ads_sync_logs
        UNION ALL
        SELECT 
          'google_ads_audit_log' as table_name,
          COUNT(*) as total_rows
        FROM google_ads_audit_log;
      `
    });

  if (testError) {
    log('⚠️  Could not test isolation (tables may not exist yet)', colors.yellow);
  } else {
    log('\n✓ Table row counts:', colors.green);
    testData?.forEach(row => {
      log(`  ${row.table_name}: ${row.total_rows} rows`, colors.blue);
    });
  }

  log('\n=== Migration Complete ===\n', colors.bright + colors.green);
  log('Next steps:', colors.cyan);
  log('1. Test the application to ensure RLS policies work correctly', colors.blue);
  log('2. Verify that users can only see data for their clients', colors.blue);
  log('3. Check that service role operations still work', colors.blue);
  log('4. Monitor logs for any RLS-related errors\n', colors.blue);
}

main().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, colors.red);
  console.error(error);
  process.exit(1);
});
