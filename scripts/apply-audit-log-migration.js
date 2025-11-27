/**
 * Apply Audit Log Migration
 * 
 * This script applies the migration to add client_id and other columns
 * to the google_ads_audit_log table
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

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('🚀 Starting audit log migration...\n');

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '002-add-client-id-to-audit-log.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded');
    console.log('📝 Executing migration SQL...\n');

    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: migrationSQL
    });

    if (error) {
      // If exec_sql doesn't exist, try direct execution
      console.log('⚠️  exec_sql function not found, trying direct execution...');
      
      // Split by semicolons and execute each statement
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        if (statement.toLowerCase().includes('select')) {
          const { data: selectData, error: selectError } = await supabase
            .from('information_schema.columns')
            .select('*')
            .eq('table_name', 'google_ads_audit_log');
          
          if (selectError) {
            console.error('❌ Error querying columns:', selectError.message);
          } else {
            console.log('✅ Current columns:', selectData?.map(c => c.column_name).join(', '));
          }
        }
      }
      
      console.log('\n⚠️  Please execute the migration manually in Supabase SQL Editor:');
      console.log('   1. Go to Supabase Dashboard > SQL Editor');
      console.log('   2. Copy the contents of: database/migrations/002-add-client-id-to-audit-log.sql');
      console.log('   3. Paste and execute\n');
      
      return;
    }

    console.log('✅ Migration executed successfully!\n');

    // Verify the migration
    console.log('🔍 Verifying migration...');
    
    const { data: columns, error: verifyError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'google_ads_audit_log')
      .order('ordinal_position');

    if (verifyError) {
      console.error('❌ Error verifying migration:', verifyError.message);
      return;
    }

    console.log('\n📊 Current table structure:');
    console.table(columns);

    // Check for required columns
    const requiredColumns = [
      'id',
      'client_id',
      'connection_id',
      'user_id',
      'operation',
      'resource_type',
      'resource_id',
      'metadata',
      'success',
      'error_message',
      'sensitive_data',
      'created_at'
    ];

    const existingColumns = columns?.map(c => c.column_name) || [];
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));

    if (missingColumns.length > 0) {
      console.log('\n⚠️  Missing columns:', missingColumns.join(', '));
      console.log('   Please run the migration manually in Supabase SQL Editor');
    } else {
      console.log('\n✅ All required columns are present!');
    }

    // Check indexes
    console.log('\n🔍 Checking indexes...');
    const { data: indexes, error: indexError } = await supabase
      .rpc('exec_sql', {
        sql_query: `
          SELECT indexname, indexdef 
          FROM pg_indexes 
          WHERE tablename = 'google_ads_audit_log'
          ORDER BY indexname;
        `
      });

    if (!indexError && indexes) {
      console.log('📊 Indexes:');
      console.table(indexes);
    }

    console.log('\n✅ Migration verification complete!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('\nPlease execute the migration manually:');
    console.error('1. Open Supabase Dashboard > SQL Editor');
    console.error('2. Copy contents of: database/migrations/002-add-client-id-to-audit-log.sql');
    console.error('3. Execute the SQL');
    process.exit(1);
  }
}

// Run the migration
applyMigration()
  .then(() => {
    console.log('\n🎉 Migration process completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration process failed:', error);
    process.exit(1);
  });
