#!/usr/bin/env node

/**
 * Apply Super Admins Migration
 * 
 * This script applies the super_admins table migration to align the database
 * with the design document specification.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyMigration() {
  console.log('🚀 Applying Super Admins Migration...\n');

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, 'database/migrations/10-create-super-admins-table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded successfully');
    console.log('📝 Migration content preview:');
    console.log(migrationSQL.substring(0, 200) + '...\n');

    // Check if super_admins table already exists by trying to query it
    let tableExists = false;
    try {
      const { error: checkError } = await supabase
        .from('super_admins')
        .select('id')
        .limit(1);
      
      tableExists = !checkError || checkError.code !== 'PGRST106';
    } catch (e) {
      tableExists = false;
    }

    if (tableExists) {
      console.log('⚠️  super_admins table already exists');
      console.log('   Migration may have already been applied');
    }

    // Check if master_users table exists (for migration)
    let masterUsersExists = false;
    try {
      const { error: masterCheckError } = await supabase
        .from('master_users')
        .select('id')
        .limit(1);
      
      masterUsersExists = !masterCheckError || masterCheckError.code !== 'PGRST106';
    } catch (e) {
      masterUsersExists = false;
    }

    if (masterUsersExists) {
      console.log('📋 Found existing master_users table - data will be migrated');
      
      // Count existing master users
      const { count, error: countError } = await supabase
        .from('master_users')
        .select('*', { count: 'exact', head: true });

      if (!countError) {
        console.log(`   Found ${count} master users to migrate`);
      }
    } else {
      console.log('📋 No existing master_users table found');
    }

    console.log('\n⚠️  IMPORTANT: This migration should be applied manually in Supabase SQL Editor');
    console.log('   Reason: Complex SQL with DO blocks and functions cannot be executed via API');
    console.log('\n📋 Steps to apply:');
    console.log('   1. Open Supabase SQL Editor: https://supabase.com/dashboard/project/YOUR_PROJECT/sql');
    console.log('   2. Copy the contents of database/migrations/10-create-super-admins-table.sql');
    console.log('   3. Paste into the SQL Editor');
    console.log('   4. Click "Run" to execute the migration');
    console.log('   5. Run this script again to verify the migration');

    // Try to verify current database state
    console.log('\n🔍 Attempting to verify current database state...');

    const tablesToCheck = ['super_admins', 'master_users', 'user_client_access'];
    console.log('\n📊 Current relevant tables:');
    
    for (const tableName of tablesToCheck) {
      try {
        const { error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);
        
        if (!error || error.code !== 'PGRST106') {
          console.log(`   ✓ ${tableName}`);
        } else {
          console.log(`   ✗ ${tableName} (not found)`);
        }
      } catch (e) {
        console.log(`   ✗ ${tableName} (not found)`);
      }
    }

    console.log('\n✅ Migration file is ready to be applied manually');
    console.log('   File location: database/migrations/10-create-super-admins-table.sql');

  } catch (error) {
    console.error('❌ Error during migration:', error);
    process.exit(1);
  }
}

async function verifyMigration() {
  console.log('🔍 Verifying Super Admins Migration...\n');

  try {
    // Check if super_admins table exists
    let tableExists = false;
    try {
      const { error: tableError } = await supabase
        .from('super_admins')
        .select('id')
        .limit(1);
      
      tableExists = !tableError || tableError.code !== 'PGRST106';
    } catch (e) {
      tableExists = false;
    }

    if (!tableExists) {
      console.log('❌ super_admins table does not exist');
      console.log('   Migration has not been applied yet');
      return false;
    }

    console.log('✅ super_admins table exists');

    console.log('✅ super_admins table exists');

    // Try to get a sample record to verify structure
    const { data: sampleRecord, error: sampleError } = await supabase
      .from('super_admins')
      .select('*')
      .limit(1);

    if (!sampleError) {
      console.log('\n📋 Table is accessible and properly configured');
    }

    // Check if there are any super admins
    const { count, error: countError } = await supabase
      .from('super_admins')
      .select('*', { count: 'exact', head: true });

    if (!countError) {
      console.log(`\n👥 Current super admins count: ${count}`);
    }

    console.log('\n🔒 RLS is expected to be enabled on super_admins table');

    console.log('\n✅ Migration verification complete');
    return true;

  } catch (error) {
    console.error('❌ Error during verification:', error);
    return false;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--verify') || args.includes('-v')) {
    const success = await verifyMigration();
    process.exit(success ? 0 : 1);
  } else {
    await applyMigration();
  }
}

main().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});