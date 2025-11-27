/**
 * Apply Google Ads Encryption Keys Migration
 * Task 1.1: Add missing columns to google_ads_encryption_keys table
 * 
 * This script applies the migration to add:
 * - algorithm column
 * - version column
 * - key_hash column
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '001-fix-google-ads-encryption-keys.sql');
    
    if (!fs.existsSync(migrationPath)) {
      console.error('❌ Migration file not found:', migrationPath);
      process.exit(1);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration file loaded');
    console.log('   Path:', migrationPath);
    console.log('   Size:', migrationSQL.length, 'bytes\n');

    // Split SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip comments and SELECT statements (verification queries)
      if (statement.startsWith('COMMENT') || statement.startsWith('SELECT')) {
        console.log(`⏭️  Skipping statement ${i + 1}: ${statement.substring(0, 50)}...`);
        continue;
      }

      console.log(`⚙️  Executing statement ${i + 1}/${statements.length}...`);
      console.log(`   ${statement.substring(0, 80)}${statement.length > 80 ? '...' : ''}`);

      try {
        const { data, error } = await supabase.rpc('exec_sql', {
          sql: statement + ';'
        });

        if (error) {
          // Some errors are expected (like "column already exists")
          if (error.message.includes('already exists') || error.message.includes('IF NOT EXISTS')) {
            console.log(`   ℹ️  Already exists (skipped)`);
            successCount++;
          } else {
            console.error(`   ❌ Error:`, error.message);
            errorCount++;
          }
        } else {
          console.log(`   ✅ Success`);
          successCount++;
        }
      } catch (err) {
        console.error(`   ❌ Exception:`, err.message);
        errorCount++;
      }

      console.log('');
    }

    console.log('📊 Migration Summary');
    console.log('================================================');
    console.log('Successful:', successCount);
    console.log('Errors:', errorCount);
    console.log('Total:', statements.length);

    if (errorCount === 0) {
      console.log('\n✅ Migration completed successfully!\n');
      return true;
    } else {
      console.log('\n⚠️  Migration completed with some errors\n');
      return false;
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    return false;
  }
}

async function verifyMigration() {
  console.log('\n🔍 Verifying Migration...');
  console.log('================================================\n');

  try {
    // Test if all columns exist
    const { data, error } = await supabase
      .from('google_ads_encryption_keys')
      .select('id, key_data, algorithm, version, key_hash, is_active, created_at, expires_at')
      .limit(1);

    if (error) {
      console.error('❌ Verification failed:', error.message);
      return false;
    }

    console.log('✅ All required columns exist');
    
    // Check column values
    if (data && data.length > 0) {
      const key = data[0];
      console.log('\n📋 Sample Key Data:');
      console.log('   - ID:', key.id);
      console.log('   - Algorithm:', key.algorithm || 'NULL');
      console.log('   - Version:', key.version || 'NULL');
      console.log('   - Key Hash:', key.key_hash ? 'SET' : 'NULL');
      console.log('   - Is Active:', key.is_active);
      console.log('   - Created:', new Date(key.created_at).toLocaleString());
    }

    console.log('\n✅ Migration verified successfully!\n');
    return true;

  } catch (error) {
    console.error('❌ Verification error:', error.message);
    return false;
  }
}

async function main() {
  console.log('⚠️  WARNING: This script will modify your database schema');
  console.log('Make sure you have a backup before proceeding!\n');

  const migrationSuccess = await applyMigration();
  
  if (migrationSuccess) {
    const verificationSuccess = await verifyMigration();
    process.exit(verificationSuccess ? 0 : 1);
  } else {
    console.log('\n❌ Migration failed. Please check the errors above.');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
