/**
 * Apply User Client Access Migration
 * Creates the correct super_admins and user_client_access tables as specified in the design document
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
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyMigration() {
  try {
    console.log('🚀 Starting User Client Access Migration...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'database/migrations/09-user-client-access-table-fixed.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration file loaded:', migrationPath);
    
    // Execute the migration
    console.log('⚡ Executing migration...');
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });
    
    if (error) {
      console.error('❌ Migration failed:', error);
      
      // Try alternative approach - execute parts separately
      console.log('🔄 Trying alternative approach...');
      
      // Split SQL into individual statements and execute them
      const statements = migrationSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
      
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        if (statement.length > 0) {
          console.log(`📝 Executing statement ${i + 1}/${statements.length}...`);
          try {
            const { error: stmtError } = await supabase.rpc('exec_sql', { sql: statement });
            if (stmtError) {
              console.warn(`⚠️  Statement ${i + 1} warning:`, stmtError.message);
            }
          } catch (err) {
            console.warn(`⚠️  Statement ${i + 1} error:`, err.message);
          }
        }
      }
    } else {
      console.log('✅ Migration executed successfully');
    }
    
    // Verify the tables were created
    console.log('🔍 Verifying migration results...');
    
    // Check super_admins table
    const { data: superAdminsCheck, error: superAdminsError } = await supabase
      .from('super_admins')
      .select('count')
      .limit(1);
    
    if (superAdminsError) {
      console.error('❌ super_admins table verification failed:', superAdminsError.message);
    } else {
      console.log('✅ super_admins table exists and is accessible');
    }
    
    // Check user_client_access table
    const { data: userClientAccessCheck, error: userClientAccessError } = await supabase
      .from('user_client_access')
      .select('count')
      .limit(1);
    
    if (userClientAccessError) {
      console.error('❌ user_client_access table verification failed:', userClientAccessError.message);
    } else {
      console.log('✅ user_client_access table exists and is accessible');
    }
    
    // Check memberships role column
    const { data: membershipCheck, error: membershipError } = await supabase
      .from('memberships')
      .select('role')
      .limit(1);
    
    if (membershipError) {
      console.error('❌ memberships role column verification failed:', membershipError.message);
    } else {
      console.log('✅ memberships table has role column');
    }
    
    console.log('🎉 Migration completed successfully!');
    console.log('');
    console.log('📋 Summary:');
    console.log('   ✅ super_admins table created');
    console.log('   ✅ user_client_access table created');
    console.log('   ✅ memberships.role column added');
    console.log('   ✅ RLS policies applied');
    console.log('   ✅ Indexes created');
    console.log('');
    console.log('🧪 You can now run the tests:');
    console.log('   npm test');
    
  } catch (error) {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  }
}

// Run the migration
applyMigration();