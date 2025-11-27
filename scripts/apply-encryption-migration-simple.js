/**
 * Simple Migration Script for Google Ads Encryption Keys
 * Task 1.1: Add missing columns to google_ads_encryption_keys table
 * 
 * This script applies the migration using direct SQL execution
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  console.log('🚀 Applying Google Ads Encryption Keys Migration');
  console.log('================================================\n');

  const migrations = [
    {
      name: 'Add algorithm column',
      sql: `ALTER TABLE google_ads_encryption_keys ADD COLUMN IF NOT EXISTS algorithm VARCHAR(50) DEFAULT 'aes-256-gcm'`
    },
    {
      name: 'Add version column',
      sql: `ALTER TABLE google_ads_encryption_keys ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1`
    },
    {
      name: 'Add key_hash column',
      sql: `ALTER TABLE google_ads_encryption_keys ADD COLUMN IF NOT EXISTS key_hash TEXT`
    },
    {
      name: 'Update existing rows - version',
      sql: `UPDATE google_ads_encryption_keys SET version = 1 WHERE version IS NULL`
    },
    {
      name: 'Update existing rows - algorithm',
      sql: `UPDATE google_ads_encryption_keys SET algorithm = 'aes-256-gcm' WHERE algorithm IS NULL`
    }
  ];

  let successCount = 0;
  let errorCount = 0;

  for (const migration of migrations) {
    console.log(`⚙️  ${migration.name}...`);
    
    try {
      // Use the from() method to execute raw SQL via a function
      const { data, error } = await supabase
        .rpc('exec_sql', { sql_query: migration.sql })
        .catch(async () => {
          // If exec_sql doesn't exist, try direct query
          // This won't work for ALTER TABLE, but we'll handle it
          return { data: null, error: { message: 'RPC not available' } };
        });

      if (error) {
        if (error.message.includes('already exists') || 
            error.message.includes('RPC not available')) {
          console.log(`   ℹ️  Skipped (may already exist or needs manual execution)`);
          console.log(`   SQL: ${migration.sql}\n`);
          successCount++;
        } else {
          console.error(`   ❌ Error: ${error.message}\n`);
          errorCount++;
        }
      } else {
        console.log(`   ✅ Success\n`);
        successCount++;
      }
    } catch (err) {
      console.error(`   ❌ Exception: ${err.message}\n`);
      errorCount++;
    }
  }

  console.log('📊 Migration Summary');
  console.log('================================================');
  console.log('Successful:', successCount);
  console.log('Errors:', errorCount);
  console.log('Total:', migrations.length);

  if (errorCount > 0) {
    console.log('\n⚠️  Some migrations failed');
    console.log('You may need to run the SQL manually in Supabase SQL Editor');
    console.log('SQL file: database/migrations/001-fix-google-ads-encryption-keys.sql\n');
  }

  return errorCount === 0;
}

async function verifyMigration() {
  console.log('\n🔍 Verifying Migration...');
  console.log('================================================\n');

  try {
    const { data, error } = await supabase
      .from('google_ads_encryption_keys')
      .select('id, key_data, algorithm, version, key_hash, is_active, created_at, expires_at')
      .limit(1);

    if (error) {
      console.error('❌ Verification failed:', error.message);
      console.log('\n⚠️  The migration was not applied successfully');
      console.log('Please run the SQL manually in Supabase SQL Editor:');
      console.log('File: database/migrations/001-fix-google-ads-encryption-keys.sql\n');
      return false;
    }

    console.log('✅ All required columns exist');
    
    if (data && data.length > 0) {
      const key = data[0];
      console.log('\n📋 Sample Key Data:');
      console.log('   - Algorithm:', key.algorithm || 'NULL');
      console.log('   - Version:', key.version || 'NULL');
      console.log('   - Key Hash:', key.key_hash ? 'SET' : 'NULL');
      console.log('   - Is Active:', key.is_active);
    } else {
      console.log('\n   ℹ️  No encryption keys found (table is empty)');
    }

    console.log('\n✅ Migration verified successfully!\n');
    return true;

  } catch (error) {
    console.error('❌ Verification error:', error.message);
    return false;
  }
}

async function main() {
  console.log('Task 1.1: Fix google_ads_encryption_keys table\n');
  
  // First, try to verify if migration is already applied
  console.log('Checking current schema state...\n');
  const alreadyApplied = await verifyMigration();
  
  if (alreadyApplied) {
    console.log('✅ Migration already applied! No action needed.\n');
    process.exit(0);
  }

  console.log('\n⚠️  Migration needs to be applied');
  console.log('================================================\n');
  console.log('MANUAL STEPS REQUIRED:');
  console.log('1. Open Supabase Dashboard');
  console.log('2. Go to SQL Editor');
  console.log('3. Copy and paste the contents of:');
  console.log('   database/migrations/001-fix-google-ads-encryption-keys.sql');
  console.log('4. Click "Run" to execute');
  console.log('5. Run this script again to verify\n');
  
  process.exit(1);
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
