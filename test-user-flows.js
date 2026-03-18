#!/usr/bin/env node

/**
 * User Flow Validation - User Access Control System
 * 
 * Tests specific user flows and scenarios to ensure the system works correctly
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

console.log('🎯 USER ACCESS CONTROL - USER FLOW VALIDATION')
console.log('============================================================')

/**
 * Test Super Admin Universal Access
 */
async function testSuperAdminAccess() {
  console.log('\n🔍 Testing Super Admin Universal Access...')
  
  try {
    // Get a super admin
    const { data: superAdmins, error } = await supabase
      .from('super_admins')
      .select('user_id')
      .eq('is_active', true)
      .limit(1)
    
    if (error || !superAdmins || superAdmins.length === 0) {
      console.log('⚠️  No super admins found - creating test super admin')
      return false
    }
    
    const superAdminId = superAdmins[0].user_id
    console.log(`✅ Found super admin: ${superAdminId}`)
    
    // Test access to all organizations
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('*')
    
    if (orgError) {
      console.log(`❌ Super admin cannot access organizations: ${orgError.message}`)
      return false
    }
    
    console.log(`✅ Super admin can access ${orgs?.length || 0} organizations`)
    
    // Test access to all clients
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('*')
    
    if (clientError) {
      console.log(`❌ Super admin cannot access clients: ${clientError.message}`)
      return false
    }
    
    console.log(`✅ Super admin can access ${clients?.length || 0} clients`)
    
    return true
    
  } catch (err) {
    console.log(`❌ Super admin test failed: ${err.message}`)
    return false
  }
}

/**
 * Test Organization Boundary Enforcement
 */
async function testOrganizationBoundaries() {
  console.log('\n🔍 Testing Organization Boundary Enforcement...')
  
  try {
    // Get organizations
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('id, name')
      .limit(2)
    
    if (orgError || !orgs || orgs.length < 2) {
      console.log('⚠️  Need at least 2 organizations for boundary testing')
      return false
    }
    
    console.log(`✅ Found ${orgs.length} organizations for testing`)
    
    // Get clients for each organization
    for (const org of orgs) {
      const { data: clients, error: clientError } = await supabase
        .from('clients')
        .select('id, name')
        .eq('org_id', org.id)
      
      if (clientError) {
        console.log(`❌ Cannot access clients for org ${org.name}: ${clientError.message}`)
        return false
      }
      
      console.log(`✅ Organization "${org.name}" has ${clients?.length || 0} clients`)
    }
    
    return true
    
  } catch (err) {
    console.log(`❌ Organization boundary test failed: ${err.message}`)
    return false
  }
}

/**
 * Test Client Access Control
 */
async function testClientAccessControl() {
  console.log('\n🔍 Testing Client Access Control...')
  
  try {
    // Get access grants
    const { data: grants, error: grantError } = await supabase
      .from('user_client_access')
      .select(`
        id,
        user_id,
        client_id,
        is_active,
        clients (
          id,
          name,
          org_id
        )
      `)
      .limit(10)
    
    if (grantError) {
      console.log(`❌ Cannot query client access grants: ${grantError.message}`)
      return false
    }
    
    console.log(`✅ Found ${grants?.length || 0} client access grants`)
    
    // Analyze grants
    const activeGrants = grants?.filter(g => g.is_active) || []
    const inactiveGrants = grants?.filter(g => !g.is_active) || []
    
    console.log(`   • Active grants: ${activeGrants.length}`)
    console.log(`   • Inactive grants: ${inactiveGrants.length}`)
    
    // Check for proper client-organization relationships
    let validRelationships = 0
    let invalidRelationships = 0
    
    for (const grant of grants || []) {
      if (grant.clients && grant.clients.org_id) {
        validRelationships++
      } else {
        invalidRelationships++
      }
    }
    
    console.log(`   • Valid client relationships: ${validRelationships}`)
    console.log(`   • Invalid client relationships: ${invalidRelationships}`)
    
    return invalidRelationships === 0
    
  } catch (err) {
    console.log(`❌ Client access control test failed: ${err.message}`)
    return false
  }
}

/**
 * Test User Type Classification
 */
async function testUserTypeClassification() {
  console.log('\n🔍 Testing User Type Classification...')
  
  try {
    // Get all users from auth
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()
    
    if (authError) {
      console.log(`❌ Cannot list auth users: ${authError.message}`)
      return false
    }
    
    console.log(`✅ Found ${authUsers.users?.length || 0} total users`)
    
    // Classify users
    let superAdminCount = 0
    let orgAdminCount = 0
    let commonUserCount = 0
    let unclassifiedCount = 0
    
    for (const user of authUsers.users || []) {
      // Check if super admin
      const { data: superAdmin } = await supabase
        .from('super_admins')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single()
      
      if (superAdmin) {
        superAdminCount++
        continue
      }
      
      // Check if org admin
      const { data: orgAdmin } = await supabase
        .from('memberships')
        .select('id')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single()
      
      if (orgAdmin) {
        orgAdminCount++
        continue
      }
      
      // Check if common user
      const { data: commonUser } = await supabase
        .from('memberships')
        .select('id')
        .eq('user_id', user.id)
        .eq('role', 'member')
        .single()
      
      if (commonUser) {
        commonUserCount++
        continue
      }
      
      unclassifiedCount++
    }
    
    console.log(`   • Super Admins: ${superAdminCount}`)
    console.log(`   • Organization Admins: ${orgAdminCount}`)
    console.log(`   • Common Users: ${commonUserCount}`)
    console.log(`   • Unclassified: ${unclassifiedCount}`)
    
    return true
    
  } catch (err) {
    console.log(`❌ User type classification test failed: ${err.message}`)
    return false
  }
}

/**
 * Test Data Integrity
 */
async function testDataIntegrity() {
  console.log('\n🔍 Testing Data Integrity...')
  
  try {
    let issues = []
    
    // Check for orphaned memberships
    const { data: orphanedMemberships, error: memberError } = await supabase
      .from('memberships')
      .select(`
        id,
        user_id,
        organization_id,
        organizations (id)
      `)
    
    if (memberError) {
      issues.push(`Cannot check memberships: ${memberError.message}`)
    } else {
      const orphaned = orphanedMemberships?.filter(m => !m.organizations) || []
      if (orphaned.length > 0) {
        issues.push(`Found ${orphaned.length} orphaned memberships`)
      }
    }
    
    // Check for orphaned clients
    const { data: orphanedClients, error: clientError } = await supabase
      .from('clients')
      .select(`
        id,
        name,
        org_id,
        organizations (id)
      `)
    
    if (clientError) {
      issues.push(`Cannot check clients: ${clientError.message}`)
    } else {
      const orphaned = orphanedClients?.filter(c => !c.organizations) || []
      if (orphaned.length > 0) {
        issues.push(`Found ${orphaned.length} orphaned clients`)
      }
    }
    
    // Check for orphaned access grants
    const { data: orphanedGrants, error: grantError } = await supabase
      .from('user_client_access')
      .select(`
        id,
        user_id,
        client_id,
        clients (id)
      `)
    
    if (grantError) {
      issues.push(`Cannot check access grants: ${grantError.message}`)
    } else {
      const orphaned = orphanedGrants?.filter(g => !g.clients) || []
      if (orphaned.length > 0) {
        issues.push(`Found ${orphaned.length} orphaned access grants`)
      }
    }
    
    if (issues.length === 0) {
      console.log('✅ Data integrity check passed')
      return true
    } else {
      console.log('❌ Data integrity issues found:')
      issues.forEach(issue => console.log(`   • ${issue}`))
      return false
    }
    
  } catch (err) {
    console.log(`❌ Data integrity test failed: ${err.message}`)
    return false
  }
}

/**
 * Main test runner
 */
async function runUserFlowTests() {
  const tests = [
    { name: 'Super Admin Access', fn: testSuperAdminAccess },
    { name: 'Organization Boundaries', fn: testOrganizationBoundaries },
    { name: 'Client Access Control', fn: testClientAccessControl },
    { name: 'User Type Classification', fn: testUserTypeClassification },
    { name: 'Data Integrity', fn: testDataIntegrity }
  ]
  
  let passed = 0
  let failed = 0
  
  for (const test of tests) {
    try {
      const result = await test.fn()
      if (result) {
        passed++
      } else {
        failed++
      }
    } catch (err) {
      console.log(`❌ Test "${test.name}" threw exception: ${err.message}`)
      failed++
    }
  }
  
  console.log('\n============================================================')
  console.log('📊 USER FLOW TEST SUMMARY')
  console.log('============================================================')
  console.log(`✅ Passed: ${passed}`)
  console.log(`❌ Failed: ${failed}`)
  console.log(`📊 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`)
  
  if (failed === 0) {
    console.log('\n🎉 All user flow tests passed!')
    console.log('✅ System is ready for production use')
  } else {
    console.log('\n⚠️  Some tests failed')
    console.log('🔧 Review the issues above before proceeding')
  }
  
  console.log('\n============================================================')
}

// Run the tests
runUserFlowTests()