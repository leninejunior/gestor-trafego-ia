const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function checkRLSPolicies() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  console.log('🔍 Checking RLS policies on super_admins table...');
  
  // Check if RLS is enabled
  const { data: rlsStatus, error: rlsError } = await supabase
    .from('pg_class')
    .select('relname, relrowsecurity')
    .eq('relname', 'super_admins');
  
  if (rlsError) {
    console.log('❌ Error checking RLS status:', rlsError.message);
  } else {
    console.log('🔒 RLS Status:', rlsStatus[0]?.relrowsecurity ? 'ENABLED' : 'DISABLED');
  }
  
  // Try to access super_admins with anon key (simulating test environment)
  const anonSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL, 
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  
  const { data: anonData, error: anonError } = await anonSupabase
    .from('super_admins')
    .select('*');
  
  console.log('🔑 Anon key access:', { 
    count: anonData?.length, 
    error: anonError?.message 
  });
  
  // Try with service role
  const { data: serviceData, error: serviceError } = await supabase
    .from('super_admins')
    .select('*');
  
  console.log('🛠️ Service role access:', { 
    count: serviceData?.length, 
    error: serviceError?.message 
  });
}

checkRLSPolicies();