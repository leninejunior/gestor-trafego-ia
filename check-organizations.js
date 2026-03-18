const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function checkOrganizations() {
  try {
    console.log('Checking organizations...');
    
    const { data: orgs, error } = await supabase
      .from('organizations')
      .select('id, name');

    if (error) {
      console.error('Error:', error);
      return;
    }

    console.log('Active organizations:', orgs.length);
    orgs.forEach((org, index) => {
      console.log(`${index + 1}. ${org.name} (${org.id})`);
    });

    if (orgs.length < 2) {
      console.log('\nNeed to create a second organization for testing...');
      
      const { data: newOrg, error: createError } = await supabase
        .from('organizations')
        .insert({
          name: 'Test Organization 2'
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating organization:', createError);
      } else {
        console.log('Created new organization:', newOrg);
      }
    }

  } catch (error) {
    console.error('Script error:', error);
  }
}

checkOrganizations();