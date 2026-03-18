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

async function createTestClient() {
  try {
    // Get the second organization
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select('id, name')
      .limit(2);

    if (orgsError || !orgs || orgs.length < 2) {
      console.error('Need at least 2 organizations');
      return;
    }

    const secondOrg = orgs[1];
    console.log('Creating client in organization:', secondOrg.name);

    // Check if client already exists
    const { data: existingClients, error: existingError } = await supabase
      .from('clients')
      .select('id, name')
      .eq('org_id', secondOrg.id);

    if (existingError) {
      console.error('Error checking existing clients:', existingError);
      return;
    }

    if (existingClients && existingClients.length > 0) {
      console.log('Client already exists in second org:', existingClients[0]);
      return;
    }

    // Create a test client in the second organization
    const { data: newClient, error: createError } = await supabase
      .from('clients')
      .insert({
        name: 'Test Client Org 2',
        org_id: secondOrg.id
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating client:', createError);
    } else {
      console.log('Created test client:', newClient);
    }

  } catch (error) {
    console.error('Script error:', error);
  }
}

createTestClient();