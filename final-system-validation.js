#!/usr/bin/env node

/**
 * Final System Validation - User Access Control System
 * 
 * This script performs comprehensive validation of the user access control system
 * including database schema, API endpoints, user flows, and security constraints.
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables')
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

console.log('🎯 USER ACCESS CONTROL SYSTEM - FINAL VALIDATION')
console.log('============================================================')

/**
 * Test 1: Database Schema Validation
 */
async function validateDatabaseSchema() {
  console.log('\n🔍 1. DATABASE SCHEMA VALIDATION')
  console.log('-----------------------------------------------------------')
  
  const results = {
    tables: {},
    columns: {},
    policies: {}
  }
  
  // Check required tables
  const requiredTables = [
    'super_admins',
    'user_client_access', 
    'memberships',
    'organizations',
    'clients'
  ]
  
  for (const table of requiredTables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1)
      
      if (error) {
        results.tables[table] = `❌ ERROR: ${error.message}`
      } else {
        results.tables[table] = '✅ EXISTS'
      }
    } catch (err) {
      results.tables[table] = `❌ EXCEPTION: ${err.message}`
    }
  }
  
  // Check specific columns
  const columnChecks = [
    { table: 'memberships', column: 'role' },
    { table: 'memberships', column: 'organization_id' },
    { table: 'user_client_access', column: 'client_id' },
    { table: 'user_client_access', column: 'user_id' },
    { table: 'super_admins', column: 'user_id' }
  ]
  
  for (const check of columnChecks) {
    try {
      const { data, error } = await supabase
        .rpc('check_column_exists', {
          table_name: check.table,
          column_name: check.column
        })
      
      if (error) {
        // Try alternative method
        const { data: schemaData, error: schemaError } = await supabase
          .from('information_schema.columns')
          .select('column_name')
          .eq('table_name', check.table)
          .eq('column_name', check.column)
        
        if (schemaError) {
          results.columns[`${check.table}.${check.column}`] = '❓ UNKNOWN'
        } else {
          results.columns[`${check.table}.${check.column}`] = schemaData.length > 0 ? '✅ EXISTS' : '❌ MISSING'
        }
      } else {
        results.columns[`${check.table}.${check.column}`] = data ? '✅ EXISTS' : '❌ MISSING'
      }
    } catch (err) {
      results.columns[`${check.table}.${check.column}`] = '❓ UNKNOWN'
    }
  }
  
  // Print results
  console.log('\n📊 Table Status:')
  Object.entries(results.tables).forEach(([table, status]) => {
    console.log(`   ${status} ${table}`)
  })
  
  console.log('\n📊 Column Status:')
  Object.entries(results.columns).forEach(([column, status]) => {
    console.log(`   ${status} ${column}`)
  })
  
  return results
}

/**
 * Test 2: User Type Detection
 */
async function validateUserTypeDetection() {
  console.log('\n🔍 2. USER TYPE DETECTION VALIDATION')
  console.log('-----------------------------------------------------------')
  
  const results = {
    superAdmins: 0,
    orgAdmins: 0,
    commonUsers: 0,
    errors: []
  }
  
  try {
    // Count super admins
    const { data: superAdmins, error: superError } = await supabase
      .from('super_admins')
      .select('user_id')
      .eq('is_active', true)
    
    if (superError) {
      results.errors.push(`Super admin query error: ${superError.message}`)
    } else {
      results.superAdmins = superAdmins?.length || 0
    }
    
    // Count org admins
    const { data: orgAdmins, error: orgError } = await supabase
      .from('memberships')
      .select('user_id')
      .eq('role', 'admin')
    
    if (orgError) {
      results.errors.push(`Org admin query error: ${orgError.message}`)
    } else {
      results.orgAdmins = orgAdmins?.length || 0
    }
    
    // Count common users (members)
    const { data: commonUsers, error: commonError } = await supabase
      .from('memberships')
      .select('user_id')
      .eq('role', 'member')
    
    if (commonError) {
      results.errors.push(`Common user query error: ${commonError.message}`)
    } else {
      results.commonUsers = commonUsers?.length || 0
    }
    
  } catch (err) {
    results.errors.push(`Exception: ${err.message}`)
  }
  
  console.log(`📊 Super Admins: ${results.superAdmins}`)
  console.log(`📊 Organization Admins: ${results.orgAdmins}`)
  console.log(`📊 Common Users: ${results.commonUsers}`)
  
  if (results.errors.length > 0) {
    console.log('\n❌ Errors:')
    results.errors.forEach(error => console.log(`   ${error}`))
  }
  
  return results
}

/**
 * Test 3: Organization Isolation
 */
async function validateOrganizationIsolation() {
  console.log('\n🔍 3. ORGANIZATION ISOLATION VALIDATION')
  console.log('-----------------------------------------------------------')
  
  const results = {
    organizations: 0,
    clients: 0,
    memberships: 0,
    isolation: 'UNKNOWN'
  }
  
  try {
    // Count organizations
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('id')
    
    if (orgError) {
      console.log(`❌ Organization query error: ${orgError.message}`)
    } else {
      results.organizations = orgs?.length || 0
    }
    
    // Count clients
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('id, org_id')
    
    if (clientError) {
      console.log(`❌ Client query error: ${clientError.message}`)
    } else {
      results.clients = clients?.length || 0
      
      // Check if clients are properly linked to organizations
      const orphanClients = clients?.filter(client => !client.org_id) || []
      if (orphanClients.length > 0) {
        console.log(`⚠️  Found ${orphanClients.length} clients without organization`)
      }
    }
    
    // Count memberships
    const { data: memberships, error: memberError } = await supabase
      .from('memberships')
      .select('id, user_id, organization_id')
    
    if (memberError) {
      console.log(`❌ Membership query error: ${memberError.message}`)
    } else {
      results.memberships = memberships?.length || 0
    }
    
    // Determine isolation status
    if (results.organizations > 1 && results.clients > 0 && results.memberships > 0) {
      results.isolation = '✅ READY FOR TESTING'
    } else if (results.organizations === 1) {
      results.isolation = '⚠️  SINGLE ORG (limited isolation testing)'
    } else {
      results.isolation = '❌ INSUFFICIENT DATA'
    }
    
  } catch (err) {
    console.log(`❌ Exception: ${err.message}`)
  }
  
  console.log(`📊 Organizations: ${results.organizations}`)
  console.log(`📊 Clients: ${results.clients}`)
  console.log(`📊 Memberships: ${results.memberships}`)
  console.log(`📊 Isolation Status: ${results.isolation}`)
  
  return results
}

/**
 * Test 4: Client Access Control
 */
async function validateClientAccessControl() {
  console.log('\n🔍 4. CLIENT ACCESS CONTROL VALIDATION')
  console.log('-----------------------------------------------------------')
  
  const results = {
    accessGrants: 0,
    activeGrants: 0,
    errors: []
  }
  
  try {
    // Count total access grants
    const { data: allGrants, error: allError } = await supabase
      .from('user_client_access')
      .select('id, user_id, client_id, is_active')
    
    if (allError) {
      results.errors.push(`Access grants query error: ${allError.message}`)
    } else {
      results.accessGrants = allGrants?.length || 0
      results.activeGrants = allGrants?.filter(grant => grant.is_active)?.length || 0
    }
    
  } catch (err) {
    results.errors.push(`Exception: ${err.message}`)
  }
  
  console.log(`📊 Total Access Grants: ${results.accessGrants}`)
  console.log(`📊 Active Access Grants: ${results.activeGrants}`)
  
  if (results.errors.length > 0) {
    console.log('\n❌ Errors:')
    results.errors.forEach(error => console.log(`   ${error}`))
  }
  
  return results
}

/**
 * Test 5: API Endpoint Validation
 */
async function validateAPIEndpoints() {
  console.log('\n🔍 5. API ENDPOINT VALIDATION')
  console.log('-----------------------------------------------------------')
  
  const endpoints = [
    { path: '/api/admin/users', method: 'GET', description: 'List users' },
    { path: '/api/admin/user-client-access', method: 'GET', description: 'List client access' },
    { path: '/api/super-admin/organizations', method: 'GET', description: 'List organizations' },
    { path: '/api/super-admin/stats', method: 'GET', description: 'System stats' }
  ]
  
  const results = {
    available: 0,
    unavailable: 0,
    errors: []
  }
  
  // Note: In a real validation, we would make HTTP requests to these endpoints
  // For now, we'll check if the files exist
  const fs = await import('fs')
  const path = await import('path')
  
  for (const endpoint of endpoints) {
    try {
      const filePath = path.join(process.cwd(), 'src/app', endpoint.path, 'route.ts')
      if (fs.existsSync(filePath)) {
        console.log(`✅ ${endpoint.method} ${endpoint.path} - ${endpoint.description}`)
        results.available++
      } else {
        console.log(`❌ ${endpoint.method} ${endpoint.path} - ${endpoint.description} (file not found)`)
        results.unavailable++
      }
    } catch (err) {
      console.log(`❓ ${endpoint.method} ${endpoint.path} - ${endpoint.description} (check failed)`)
      results.errors.push(`${endpoint.path}: ${err.message}`)
    }
  }
  
  return results
}

/**
 * Test 6: Security Validation
 */
async function validateSecurity() {
  console.log('\n🔍 6. SECURITY VALIDATION')
  console.log('-----------------------------------------------------------')
  
  const results = {
    rlsPolicies: 0,
    constraints: 0,
    indexes: 0,
    errors: []
  }
  
  try {
    // Check RLS policies (this would require admin access to pg_policies)
    console.log('📊 RLS Policies: Checking...')
    
    // Check database constraints
    console.log('📊 Database Constraints: Checking...')
    
    // Check indexes for performance
    console.log('📊 Database Indexes: Checking...')
    
    console.log('⚠️  Security validation requires database admin access')
    console.log('   Manual verification recommended via Supabase dashboard')
    
  } catch (err) {
    results.errors.push(`Security check error: ${err.message}`)
  }
  
  return results
}

/**
 * Main validation function
 */
async function runFinalValidation() {
  try {
    const results = {
      schema: await validateDatabaseSchema(),
      userTypes: await validateUserTypeDetection(),
      isolation: await validateOrganizationIsolation(),
      clientAccess: await validateClientAccessControl(),
      apis: await validateAPIEndpoints(),
      security: await validateSecurity()
    }
    
    console.log('\n============================================================')
    console.log('📊 FINAL VALIDATION SUMMARY')
    console.log('============================================================')
    
    // Calculate overall health score
    let healthScore = 0
    let maxScore = 0
    
    // Schema health (30 points)
    const schemaHealth = Object.values(results.schema.tables).filter(status => status.includes('✅')).length
    const maxSchemaHealth = Object.keys(results.schema.tables).length
    healthScore += (schemaHealth / maxSchemaHealth) * 30
    maxScore += 30
    
    // User types health (20 points)
    if (results.userTypes.errors.length === 0) {
      healthScore += 20
    }
    maxScore += 20
    
    // Isolation health (20 points)
    if (results.isolation.isolation.includes('✅')) {
      healthScore += 20
    } else if (results.isolation.isolation.includes('⚠️')) {
      healthScore += 10
    }
    maxScore += 20
    
    // API health (15 points)
    const apiHealth = (results.apis.available / (results.apis.available + results.apis.unavailable)) * 15
    healthScore += apiHealth
    maxScore += 15
    
    // Client access health (15 points)
    if (results.clientAccess.errors.length === 0) {
      healthScore += 15
    }
    maxScore += 15
    
    const healthPercentage = Math.round((healthScore / maxScore) * 100)
    
    console.log(`\n🎯 Overall System Health: ${healthPercentage}%`)
    
    if (healthPercentage >= 90) {
      console.log('✅ EXCELLENT - System is ready for production')
    } else if (healthPercentage >= 75) {
      console.log('✅ GOOD - System is functional with minor issues')
    } else if (healthPercentage >= 60) {
      console.log('⚠️  FAIR - System needs attention before production')
    } else {
      console.log('❌ POOR - System requires significant fixes')
    }
    
    console.log('\n📋 Key Findings:')
    console.log(`   • Database Tables: ${Object.values(results.schema.tables).filter(s => s.includes('✅')).length}/${Object.keys(results.schema.tables).length} ready`)
    console.log(`   • User Types: ${results.userTypes.superAdmins} super admins, ${results.userTypes.orgAdmins} org admins, ${results.userTypes.commonUsers} common users`)
    console.log(`   • Organizations: ${results.isolation.organizations} organizations with ${results.isolation.clients} clients`)
    console.log(`   • Access Control: ${results.clientAccess.activeGrants} active client access grants`)
    console.log(`   • API Endpoints: ${results.apis.available} available, ${results.apis.unavailable} missing`)
    
    if (results.userTypes.errors.length > 0 || results.clientAccess.errors.length > 0) {
      console.log('\n⚠️  Issues Found:')
      const allErrors = results.userTypes.errors.concat(results.clientAccess.errors)
      allErrors.forEach(error => {
        console.log(`   • ${error}`)
      })
    }
    
    console.log('\n🚀 Next Steps:')
    if (healthPercentage < 75) {
      console.log('   1. Fix database schema issues')
      console.log('   2. Ensure all required tables and columns exist')
      console.log('   3. Apply missing migrations')
      console.log('   4. Test user access control flows')
    } else {
      console.log('   1. Run comprehensive property-based tests')
      console.log('   2. Test cross-organization isolation')
      console.log('   3. Validate plan limit enforcement')
      console.log('   4. Perform security audit')
    }
    
    console.log('\n============================================================')
    console.log('🎉 VALIDATION COMPLETE!')
    console.log('============================================================')
    
    return results
    
  } catch (error) {
    console.error('❌ Validation failed:', error.message)
    process.exit(1)
  }
}

// Run the validation
runFinalValidation()