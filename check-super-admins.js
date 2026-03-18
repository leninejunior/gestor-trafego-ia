#!/usr/bin/env node

/**
 * Check Super Admins in Database
 * 
 * This script checks what super admins exist in the database
 * so we can use real IDs in our tests.
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkSuperAdmins() {
  console.log('🔍 Checking Super Admins in Database...\n');

  try {
    // Get all super admins
    const { data: superAdmins, error } = await supabase
      .from('super_admins')
      .select('*')
      .eq('is_active', true);

    if (error) {
      console.error('❌ Error fetching super admins:', error);
      return;
    }

    console.log(`✅ Found ${superAdmins.length} active super admins:`);
    
    for (const admin of superAdmins) {
      console.log(`\n📋 Super Admin:`);
      console.log(`   ID: ${admin.id}`);
      console.log(`   User ID: ${admin.user_id}`);
      console.log(`   Created: ${admin.created_at}`);
      console.log(`   Created By: ${admin.created_by || 'N/A'}`);
      console.log(`   Notes: ${admin.notes || 'N/A'}`);

      // Try to get user details from auth
      try {
        const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(admin.user_id);
        if (!authError && authUser.user) {
          console.log(`   Email: ${authUser.user.email}`);
          console.log(`   Name: ${authUser.user.user_metadata?.name || 'N/A'}`);
        }
      } catch (e) {
        console.log(`   Auth details: Unable to fetch`);
      }
    }

    // Also check some organizations and users for test data
    console.log('\n🏢 Checking Organizations...');
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, is_active')
      .eq('is_active', true)
      .limit(5);

    if (!orgError && orgs) {
      console.log(`✅ Found ${orgs.length} active organizations:`);
      orgs.forEach(org => {
        console.log(`   ${org.id} - ${org.name}`);
      });
    }

    // Check some regular users
    console.log('\n👥 Checking Regular Users...');
    const { data: memberships, error: memberError } = await supabase
      .from('memberships')
      .select('user_id, role, organization_id')
      .neq('role', 'admin')
      .limit(5);

    if (!memberError && memberships) {
      console.log(`✅ Found ${memberships.length} regular users:`);
      memberships.forEach(member => {
        console.log(`   User: ${member.user_id} (${member.role}) in org: ${member.organization_id}`);
      });
    }

    // Check clients
    console.log('\n🏪 Checking Clients...');
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('id, name, org_id')
      .eq('is_active', true)
      .limit(5);

    if (!clientError && clients) {
      console.log(`✅ Found ${clients.length} active clients:`);
      clients.forEach(client => {
        console.log(`   ${client.id} - ${client.name} (org: ${client.org_id})`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkSuperAdmins().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});