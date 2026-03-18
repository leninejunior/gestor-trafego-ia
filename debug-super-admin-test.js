#!/usr/bin/env node

/**
 * Debug Super Admin Test
 * 
 * This script tests the super admin detection logic to understand
 * why the property test is failing.
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

// Copy the exact getUserType logic from the test
async function getUserType(userId) {
  try {
    console.log(`🔍 Checking user type for: ${userId}`);
    
    // Check if user is super admin
    const { data: superAdmins, error: superAdminError } = await supabase
      .from('super_admins')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true);

    console.log('Super admin query result:', { 
      superAdmins, 
      superAdminError, 
      userId, 
      length: superAdmins?.length 
    });

    if (!superAdminError && superAdmins && superAdmins.length > 0) {
      console.log('✅ Returning SUPER_ADMIN for user:', userId);
      return 'super_admin';
    }

    // Check if user is org admin
    const { data: memberships, error: membershipError } = await supabase
      .from('memberships')
      .select('role')
      .eq('user_id', userId);

    console.log('Membership query result:', { 
      memberships, 
      membershipError, 
      userId 
    });

    if (!membershipError && memberships && memberships.length > 0 && memberships[0].role === 'admin') {
      console.log('✅ Returning ORG_ADMIN for user:', userId);
      return 'org_admin';
    }

    console.log('✅ Returning COMMON_USER for user:', userId);
    return 'common_user';
  } catch (error) {
    console.error('❌ Error determining user type:', error);
    return 'common_user';
  }
}

async function debugSuperAdmin() {
  console.log('🔍 Debugging Super Admin Detection...\n');

  try {
    const testSuperAdminId = '980d1d5f-6bca-4d3f-b756-0fc0999b7658';
    
    // First, verify the super admin exists in the table
    console.log('1. Checking super_admins table directly...');
    const { data: directCheck, error: directError } = await supabase
      .from('super_admins')
      .select('*')
      .eq('user_id', testSuperAdminId);

    console.log('Direct super_admins query:', { directCheck, directError });

    // Test the getUserType function
    console.log('\n2. Testing getUserType function...');
    const userType = await getUserType(testSuperAdminId);
    console.log('getUserType result:', userType);

    // Also test with the other super admin
    console.log('\n3. Testing with other super admin...');
    const otherSuperAdminId = 'f7313dc4-e5e1-400b-ba3e-1fee686df937';
    const otherUserType = await getUserType(otherSuperAdminId);
    console.log('Other super admin getUserType result:', otherUserType);

    // Check if there are any clients
    console.log('\n4. Checking for clients...');
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('id, name')
      .eq('is_active', true)
      .limit(5);

    console.log('Clients query:', { clients, clientError, count: clients?.length });

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugSuperAdmin().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});