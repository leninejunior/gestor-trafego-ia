const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function fixSubscriptionPlansRLS() {
  console.log('🔧 Fixing Subscription Plans RLS Policies...\n');

  // Validate environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing required environment variables:');
    console.error('   - NEXT_PUBLIC_SUPABASE_URL');
    console.error('   - SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  // Create Supabase client with service role key (bypasses RLS)
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    // Read SQL file
    const sqlPath = path.join(__dirname, '../database/fix-subscription-plans-rls.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📄 Executing SQL from:', sqlPath);
    console.log('');

    // Execute SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      // If exec_sql function doesn't exist, try direct execution
      console.log('⚠️  exec_sql function not found, trying direct execution...');
      
      // Split SQL into individual statements
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        if (statement.includes('SELECT')) {
          // For SELECT statements, use .from()
          console.log('📊 Checking policies...');
          const { data: policies, error: policyError } = await supabase
            .from('pg_policies')
            .select('*')
            .eq('tablename', 'subscription_plans');
          
          if (policyError) {
            console.error('❌ Error checking policies:', policyError.message);
          } else {
            console.log('✅ Current policies:');
            policies.forEach(p => {
              console.log(`   - ${p.policyname} (${p.cmd})`);
            });
          }
        } else {
          // For other statements, we need to use the SQL editor in Supabase
          console.log('⚠️  Please execute the following SQL manually in Supabase SQL Editor:');
          console.log('');
          console.log(statement + ';');
          console.log('');
        }
      }
      
      console.log('');
      console.log('📝 Manual Steps Required:');
      console.log('1. Go to your Supabase Dashboard');
      console.log('2. Navigate to SQL Editor');
      console.log('3. Copy and paste the SQL from: database/fix-subscription-plans-rls.sql');
      console.log('4. Execute the SQL');
      console.log('');
      
      return;
    }

    console.log('✅ RLS policies updated successfully!');
    console.log('');
    console.log('📊 Result:', data);

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error('');
    console.error('📝 Please execute the SQL manually:');
    console.error('   File: database/fix-subscription-plans-rls.sql');
    process.exit(1);
  }
}

// Run the script
fixSubscriptionPlansRLS()
  .then(() => {
    console.log('');
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  });
