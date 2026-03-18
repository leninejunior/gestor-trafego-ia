const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSchema() {
  try {
    // Try to insert with notes column to see if it exists
    const { data, error } = await supabase
      .from('super_admins')
      .insert({
        user_id: '00000000-0000-0000-0000-000000000000', // fake UUID
        notes: 'test'
      })
      .select();
    
    if (error) {
      console.log('❌ Insert test failed:', error.message);
      if (error.message.includes('notes')) {
        console.log('🔍 The notes column seems to be missing from super_admins table');
      }
    } else {
      console.log('✅ Insert test passed - notes column exists');
      // Clean up the test record
      await supabase
        .from('super_admins')
        .delete()
        .eq('user_id', '00000000-0000-0000-0000-000000000000');
    }
  } catch (err) {
    console.log('💥 Error:', err.message);
  }
}

checkSchema();