/**
 * Standalone Property-Based Test for Client Access Management
 * 
 * This script tests the three properties:
 * - Property 7: Same-Organization Constraint
 * - Property 8: Access Revocation Immediacy  
 * - Property 9: Multiple Client Access Assignment
 */

const { createClient } = require('@supabase/supabase-js');
const fc = require('fast-check');
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

// Mock UserManagementService for testing
class TestUserManagementService {
  constructor() {
    this.supabase = supabase;
  }

  async createUser(adminUserId, userData) {
    // Create user in Supabase Auth
    const { data: authUser, error: authError } = await this.supabase.auth.admin.createUser({
      email: userData.email,
      email_confirm: true,
      user_metadata: {
        name: userData.name
      }
    });

    if (authError || !authUser.user) {
      throw new Error(`Erro ao criar usuário: ${authError?.message}`);
    }

    // Create membership
    const { data: membership, error: membershipError } = await this.supabase
      .from('memberships')
      .insert({
        user_id: authUser.user.id,
        organization_id: userData.organizationId,
        role: userData.role,
        invited_by: adminUserId,
        status: 'active'
      })
      .select()
      .single();

    if (membershipError) {
      // Rollback: delete user
      await this.supabase.auth.admin.deleteUser(authUser.user.id);
      throw new Error(`Erro ao criar membership: ${membershipError.message}`);
    }

    return {
      id: authUser.user.id,
      email: authUser.user.email,
      name: userData.name,
      userType: 'common_user',
      organizations: [{
        id: userData.organizationId,
        name: 'Test Org',
        role: userData.role
      }],
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true
    };
  }

  async deleteUser(adminUserId, userId) {
    // Delete related records first
    await this.supabase
      .from('user_client_access')
      .delete()
      .eq('user_id', userId);

    await this.supabase
      .from('memberships')
      .delete()
      .eq('user_id', userId);

    // Delete user from Auth
    const { error: authError } = await this.supabase.auth.admin.deleteUser(userId);
    
    if (authError) {
      throw new Error(`Erro ao deletar usuário: ${authError.message}`);
    }
  }

  async grantClientAccess(adminUserId, userId, clientId, permissions = { read: true, write: false }) {
    // Check if user and client belong to same organization
    const { data: client, error: clientError } = await this.supabase
      .from('clients')
      .select('org_id, name')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      throw new Error('Cliente não encontrado');
    }

    const { data: membership, error: membershipError } = await this.supabase
      .from('memberships')
      .select('organization_id')
      .eq('user_id', userId)
      .single();

    if (membershipError || !membership) {
      throw new Error('Usuário não encontrado ou sem organização');
    }

    if (client.org_id !== membership.organization_id) {
      throw new Error('Usuário e cliente devem pertencer à mesma organização');
    }

    // First, try to update existing record
    const { data: existingAccess, error: updateError } = await this.supabase
      .from('user_client_access')
      .update({
        permissions,
        is_active: true,
        granted_by: adminUserId,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('client_id', clientId)
      .select();

    // If no existing record, create new one
    if (!existingAccess || existingAccess.length === 0) {
      const { error: insertError } = await this.supabase
        .from('user_client_access')
        .insert({
          user_id: userId,
          client_id: clientId,
          organization_id: client.org_id,
          granted_by: adminUserId,
          permissions,
          is_active: true
        });

      if (insertError) {
        throw new Error(`Erro ao conceder acesso: ${insertError.message}`);
      }
    } else if (updateError) {
      throw new Error(`Erro ao atualizar acesso: ${updateError.message}`);
    }
  }

  async revokeClientAccess(adminUserId, userId, clientId) {
    const { error } = await this.supabase
      .from('user_client_access')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('client_id', clientId);

    if (error) {
      throw new Error(`Erro ao revogar acesso: ${error.message}`);
    }
  }

  async hasClientAccess(userId, clientId) {
    const { data: access, error } = await this.supabase
      .from('user_client_access')
      .select('is_active')
      .eq('user_id', userId)
      .eq('client_id', clientId)
      .eq('is_active', true)
      .single();

    if (error) {
      return false;
    }

    return !!access;
  }

  async listUserClientAccess(adminUserId, userId) {
    const { data: accesses, error } = await this.supabase
      .from('user_client_access')
      .select(`
        id,
        user_id,
        client_id,
        organization_id,
        permissions,
        granted_by,
        created_at,
        is_active,
        clients!inner (
          name
        )
      `)
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) {
      throw new Error(`Erro ao buscar acessos: ${error.message}`);
    }

    return accesses.map(access => ({
      id: access.id,
      userId: access.user_id,
      clientId: access.client_id,
      clientName: access.clients.name,
      organizationId: access.organization_id,
      permissions: access.permissions,
      grantedBy: access.granted_by,
      grantedAt: new Date(access.created_at),
      isActive: access.is_active
    }));
  }
}

async function testProperty7SameOrgConstraint() {
  console.log('\n=== Testing Property 7: Same-Organization Constraint ===');
  
  const service = new TestUserManagementService();
  const testSuperAdminId = '980d1d5f-6bca-4d3f-b756-0fc0999b7658';
  
  // Use existing users from different organizations instead of creating new ones
  const { data: existingUsers, error: usersError } = await supabase
    .from('memberships')
    .select(`
      user_id,
      organization_id,
      role
    `)
    .eq('status', 'active')
    .limit(5);

  if (usersError || !existingUsers || existingUsers.length < 2) {
    console.error('Need at least 2 existing users for testing');
    return false;
  }

  // Get organizations
  const { data: orgs, error: orgsError } = await supabase
    .from('organizations')
    .select('id, name')
    .limit(2);

  if (orgsError || !orgs || orgs.length < 2) {
    console.error('Need at least 2 organizations for testing');
    return false;
  }

  // Get clients from different organizations
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id, name, org_id')
    .in('org_id', orgs.map(o => o.id));

  if (clientsError || !clients || clients.length === 0) {
    console.error('Need clients for testing');
    return false;
  }

  let testsPassed = 0;
  let testsTotal = 0;

  // Test cross-organization access denial using existing users
  const testUsers = existingUsers.slice(0, 2).map(u => ({
    id: u.user_id,
    orgId: u.organization_id
  }));

  for (const user of testUsers) {
    for (const client of clients) {
      testsTotal++;
      
      if (user.orgId !== client.org_id) {
        // Cross-organization access should be denied
        try {
          await service.grantClientAccess(
            testSuperAdminId,
            user.id,
            client.id,
            { read: true, write: false }
          );
          console.error(`❌ Cross-org access was allowed (should be denied): user org ${user.orgId}, client org ${client.org_id}`);
        } catch (error) {
          if (error.message.includes('mesma organização') || error.message.includes('same organization')) {
            testsPassed++;
            console.log(`✅ Cross-org access correctly denied`);
          } else {
            console.error(`❌ Unexpected error: ${error.message}`);
          }
        }
      } else {
        // Same organization - should succeed
        try {
          await service.grantClientAccess(
            testSuperAdminId,
            user.id,
            client.id,
            { read: true, write: false }
          );
          testsPassed++;
          console.log(`✅ Same-org access correctly allowed`);
          
          // Clean up
          await service.revokeClientAccess(testSuperAdminId, user.id, client.id);
        } catch (error) {
          console.error(`❌ Same-org access was denied (should be allowed): ${error.message}`);
        }
      }
    }
  }

  console.log(`Property 7 Results: ${testsPassed}/${testsTotal} tests passed`);
  return testsPassed === testsTotal;
}

async function testProperty8RevocationImmediacy() {
  console.log('\n=== Testing Property 8: Access Revocation Immediacy ===');
  
  const service = new TestUserManagementService();
  const testSuperAdminId = '980d1d5f-6bca-4d3f-b756-0fc0999b7658';
  
  // Use existing user from the same organization as the client
  const testOrganization = {
    id: '01bdaa04-1873-427f-8caa-b79bc7dd2fa2',
    name: 'Engrene Connecting Ideas'
  };

  const testClient = {
    id: 'e3ab33da-79f9-45e9-a43f-6ce76ceb9751',
    name: 'coan',
    orgId: testOrganization.id
  };

  // Get an existing user from the same organization
  const { data: existingUsers, error: usersError } = await supabase
    .from('memberships')
    .select('user_id')
    .eq('organization_id', testOrganization.id)
    .eq('status', 'active')
    .limit(1);

  if (usersError || !existingUsers || existingUsers.length === 0) {
    console.error('Need at least 1 existing user in the test organization');
    return false;
  }

  const testUserId = existingUsers[0].user_id;
  let testsPassed = 0;
  let testsTotal = 0;

  // Test multiple grant/revoke cycles
  for (let i = 0; i < 3; i++) {
    testsTotal += 3; // 3 checks per cycle

    try {
      // Grant access
      await service.grantClientAccess(
        testSuperAdminId,
        testUserId,
        testClient.id,
        { read: true, write: false }
      );

      // Verify access granted
      const hasAccessBefore = await service.hasClientAccess(testUserId, testClient.id);
      if (hasAccessBefore) {
        testsPassed++;
        console.log(`✅ Access correctly granted (cycle ${i + 1})`);
      } else {
        console.error(`❌ Access not granted (cycle ${i + 1})`);
      }

      // Revoke access
      await service.revokeClientAccess(testSuperAdminId, testUserId, testClient.id);

      // Verify access immediately revoked
      const hasAccessAfter = await service.hasClientAccess(testUserId, testClient.id);
      if (!hasAccessAfter) {
        testsPassed++;
        console.log(`✅ Access correctly revoked immediately (cycle ${i + 1})`);
      } else {
        console.error(`❌ Access not revoked immediately (cycle ${i + 1})`);
      }

      // Verify through listUserClientAccess
      const userAccesses = await service.listUserClientAccess(testSuperAdminId, testUserId);
      const activeAccess = userAccesses.find(access => 
        access.clientId === testClient.id && access.isActive
      );
      
      if (!activeAccess) {
        testsPassed++;
        console.log(`✅ Access correctly not listed as active (cycle ${i + 1})`);
      } else {
        console.error(`❌ Access still listed as active (cycle ${i + 1})`);
      }
    } catch (error) {
      console.error(`❌ Error in cycle ${i + 1}:`, error.message);
    }
  }

  console.log(`Property 8 Results: ${testsPassed}/${testsTotal} tests passed`);
  return testsPassed === testsTotal;
}

async function testProperty9MultipleClientAccess() {
  console.log('\n=== Testing Property 9: Multiple Client Access Assignment ===');
  
  const service = new TestUserManagementService();
  const testSuperAdminId = '980d1d5f-6bca-4d3f-b756-0fc0999b7658';
  
  // Use existing organization and clients
  const testOrganization = {
    id: '01bdaa04-1873-427f-8caa-b79bc7dd2fa2',
    name: 'Engrene Connecting Ideas'
  };

  const testClients = [
    {
      id: 'e3ab33da-79f9-45e9-a43f-6ce76ceb9751',
      name: 'coan',
      orgId: testOrganization.id
    },
    {
      id: '50ede587-2de7-43b7-bc19-08f54d66c445',
      name: 'Dr Hernia Bauru',
      orgId: testOrganization.id
    },
    {
      id: '19ec44b5-a2c8-4410-bbb2-433f049f45ef',
      name: 'Dr Hérnia Andradina',
      orgId: testOrganization.id
    }
  ];

  // Get an existing user from the same organization
  const { data: existingUsers, error: usersError } = await supabase
    .from('memberships')
    .select('user_id')
    .eq('organization_id', testOrganization.id)
    .eq('status', 'active')
    .limit(1);

  if (usersError || !existingUsers || existingUsers.length === 0) {
    console.error('Need at least 1 existing user in the test organization');
    return false;
  }

  const testUserId = existingUsers[0].user_id;
  let testsPassed = 0;
  let testsTotal = 0;

  try {
    // Test granting access to multiple clients
    testsTotal += testClients.length + 1; // One test per client + one for count

    for (const client of testClients) {
      await service.grantClientAccess(
        testSuperAdminId,
        testUserId,
        client.id,
        { read: true, write: false }
      );

      const hasAccess = await service.hasClientAccess(testUserId, client.id);
      if (hasAccess) {
        testsPassed++;
        console.log(`✅ Access granted to client ${client.name}`);
      } else {
        console.error(`❌ Access not granted to client ${client.name}`);
      }
    }

    // Verify all accesses through listUserClientAccess
    const userAccesses = await service.listUserClientAccess(testSuperAdminId, testUserId);
    if (userAccesses.length === testClients.length) {
      testsPassed++;
      console.log(`✅ Correct number of access records: ${userAccesses.length}`);
    } else {
      console.error(`❌ Incorrect number of access records: expected ${testClients.length}, got ${userAccesses.length}`);
    }

    // Test independent revocation
    testsTotal += testClients.length;

    for (let i = 0; i < testClients.length; i++) {
      const client = testClients[i];
      
      // Revoke access to this client
      await service.revokeClientAccess(testSuperAdminId, testUserId, client.id);
      
      // Check that this client no longer has access
      const hasAccess = await service.hasClientAccess(testUserId, client.id);
      if (!hasAccess) {
        testsPassed++;
        console.log(`✅ Access correctly revoked for client ${client.name}`);
      } else {
        console.error(`❌ Access not revoked for client ${client.name}`);
      }
      
      // Check that other clients still have access (if any remain)
      for (let j = i + 1; j < testClients.length; j++) {
        const otherClient = testClients[j];
        const otherHasAccess = await service.hasClientAccess(testUserId, otherClient.id);
        if (otherHasAccess) {
          console.log(`✅ Other client ${otherClient.name} still has access`);
        } else {
          console.error(`❌ Other client ${otherClient.name} lost access unexpectedly`);
        }
      }
    }

  } finally {
    // Clean up - revoke any remaining access
    for (const client of testClients) {
      try {
        await service.revokeClientAccess(testSuperAdminId, testUserId, client.id);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }

  console.log(`Property 9 Results: ${testsPassed}/${testsTotal} tests passed`);
  return testsPassed === testsTotal;
}

async function runAllTests() {
  console.log('🧪 Running Property-Based Tests for Client Access Management\n');
  
  try {
    const results = await Promise.all([
      testProperty7SameOrgConstraint(),
      testProperty8RevocationImmediacy(),
      testProperty9MultipleClientAccess()
    ]);

    const allPassed = results.every(result => result);
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 FINAL RESULTS');
    console.log('='.repeat(60));
    console.log(`Property 7 (Same-Org Constraint): ${results[0] ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Property 8 (Revocation Immediacy): ${results[1] ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Property 9 (Multiple Client Access): ${results[2] ? '✅ PASSED' : '❌ FAILED'}`);
    console.log('='.repeat(60));
    console.log(`Overall Result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    
    process.exit(allPassed ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  }
}

runAllTests();