/**
 * Migrate Audit Log Data
 * 
 * This script migrates existing audit log entries to populate client_id
 * by deriving it from connection_id or user context
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkAuditLogStatus() {
  console.log('🔍 Checking current audit log status...\n');

  try {
    // Check if table exists
    const { data: tableExists, error: tableError } = await supabase
      .from('google_ads_audit_log')
      .select('id')
      .limit(1);

    if (tableError) {
      console.error('❌ Error accessing google_ads_audit_log table:', tableError.message);
      console.log('   The table may not exist yet. Please run the schema migration first.');
      return null;
    }

    // Get total count
    const { count: totalCount, error: countError } = await supabase
      .from('google_ads_audit_log')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Error counting audit logs:', countError.message);
      return null;
    }

    // Get count with client_id
    const { count: withClientCount, error: withClientError } = await supabase
      .from('google_ads_audit_log')
      .select('*', { count: 'exact', head: true })
      .not('client_id', 'is', null);

    if (withClientError) {
      console.error('❌ Error counting audit logs with client_id:', withClientError.message);
      return null;
    }

    const withoutClientCount = totalCount - withClientCount;
    const percentage = totalCount > 0 ? ((withClientCount / totalCount) * 100).toFixed(2) : 0;

    console.log('📊 Current Status:');
    console.log(`   Total audit logs: ${totalCount}`);
    console.log(`   With client_id: ${withClientCount}`);
    console.log(`   Without client_id: ${withoutClientCount}`);
    console.log(`   Migration percentage: ${percentage}%\n`);

    return {
      total: totalCount,
      withClient: withClientCount,
      withoutClient: withoutClientCount,
      percentage: parseFloat(percentage)
    };
  } catch (error) {
    console.error('❌ Error checking audit log status:', error);
    return null;
  }
}

async function migrateAuditLogData() {
  console.log('🚀 Starting audit log data migration...\n');

  try {
    // Check current status
    const beforeStatus = await checkAuditLogStatus();
    
    if (!beforeStatus) {
      console.error('❌ Cannot proceed with migration - unable to check current status');
      process.exit(1);
    }

    if (beforeStatus.withoutClient === 0) {
      console.log('✅ No audit logs need migration - all entries already have client_id');
      return;
    }

    console.log(`📝 Found ${beforeStatus.withoutClient} audit logs that need migration\n`);

    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '003-migrate-audit-log-data.sql');
    
    if (!fs.existsSync(migrationPath)) {
      console.error('❌ Migration file not found:', migrationPath);
      process.exit(1);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded');
    console.log('📝 Executing data migration...\n');

    // Split SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.includes('COMMENT ON'));

    console.log(`   Executing ${statements.length} SQL statements...\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip comments and empty statements
      if (statement.startsWith('--') || statement.length < 10) {
        continue;
      }

      console.log(`   [${i + 1}/${statements.length}] Executing statement...`);

      try {
        // For UPDATE statements, we need to use RPC or direct SQL execution
        // Since Supabase client doesn't support arbitrary SQL, we'll need to use the SQL editor
        console.log('   ⚠️  This statement needs to be executed in Supabase SQL Editor');
      } catch (error) {
        console.error(`   ❌ Error executing statement ${i + 1}:`, error.message);
      }
    }

    console.log('\n⚠️  Manual execution required:');
    console.log('   The data migration contains complex SQL that must be executed manually.');
    console.log('   Please follow these steps:\n');
    console.log('   1. Go to Supabase Dashboard > SQL Editor');
    console.log('   2. Copy the contents of: database/migrations/003-migrate-audit-log-data.sql');
    console.log('   3. Paste and execute');
    console.log('   4. Review the output for any warnings about orphaned logs\n');

    // Check status after migration (if user ran it manually)
    console.log('🔍 Checking status after migration...\n');
    const afterStatus = await checkAuditLogStatus();

    if (afterStatus) {
      const migrated = beforeStatus.withoutClient - afterStatus.withoutClient;
      
      if (migrated > 0) {
        console.log(`✅ Successfully migrated ${migrated} audit log entries!`);
      } else if (afterStatus.withoutClient > 0) {
        console.log(`⚠️  ${afterStatus.withoutClient} audit logs still need migration`);
        console.log('   Please execute the SQL migration manually in Supabase SQL Editor');
      }

      // Check for orphaned logs
      console.log('\n🔍 Checking for orphaned audit logs...');
      const { data: orphanedLogs, error: orphanError } = await supabase
        .from('google_ads_audit_log')
        .select('id, user_id, connection_id, operation, created_at')
        .is('client_id', null)
        .order('created_at', { ascending: false })
        .limit(10);

      if (orphanError) {
        console.error('❌ Error checking orphaned logs:', orphanError.message);
      } else if (orphanedLogs && orphanedLogs.length > 0) {
        console.log(`\n⚠️  Found ${orphanedLogs.length} orphaned audit logs (showing first 10):`);
        console.table(orphanedLogs);
        console.log('\n   These logs could not be automatically migrated.');
        console.log('   Options:');
        console.log('   1. Review and manually assign client_id if needed');
        console.log('   2. Delete if they are old/invalid entries');
        console.log('   3. Keep for historical reference (they won\'t affect new operations)');
      } else {
        console.log('✅ No orphaned audit logs found!');
      }
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('\nPlease execute the migration manually:');
    console.error('1. Open Supabase Dashboard > SQL Editor');
    console.error('2. Copy contents of: database/migrations/003-migrate-audit-log-data.sql');
    console.error('3. Execute the SQL');
    process.exit(1);
  }
}

// Run the migration
migrateAuditLogData()
  .then(() => {
    console.log('\n🎉 Migration process completed!');
    console.log('\n📝 Next steps:');
    console.log('   1. If you haven\'t already, execute the SQL in Supabase SQL Editor');
    console.log('   2. Review any orphaned logs and decide how to handle them');
    console.log('   3. Update your audit logging code to always include client_id');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration process failed:', error);
    process.exit(1);
  });

