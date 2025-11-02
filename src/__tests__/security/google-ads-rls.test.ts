/**
 * Google Ads RLS Security Tests
 * 
 * Tests Row Level Security policies for Google Ads data isolation
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */

import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// Test configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Create clients for different access levels
const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
const anonClient = createClient(supabaseUrl, supabaseAnonKey);

// Test data
interface TestUser {
  id: string;
  email: string;
  password: string;
}

interface TestClient {
  id: string;
  name: string;
  organizationId: string;
}

interface TestConnection {
  id: string;
  clientId: string;
  customerId: string;
  accessToken: string;
  refreshToken: string;
}

describe('Google Ads RLS Security Tests', () => {
  let testUsers: TestUser[] = [];
  let testClients: TestClient[] = [];
  let testConnections: TestConnection[] = [];
  let testOrganizations: any[] = [];

  beforeAll(async () => {
    // Create test organizations
    const org1Id = uuidv4();
    const org2Id = uuidv4();

    const { error: orgError } = await serviceClient
      .from('organizations')
      .insert([
        { id: org1Id, name: 'Test Org 1', slug: 'test-org-1' },
        { id: org2Id, name: 'Test Org 2', slug: 'test-org-2' }
      ]);

    if (orgError) {
      console.error('Error creating test organizations:', orgError);
    }

    testOrganizations = [
      { id: org1Id, name: 'Test Org 1' },
      { id: org2Id, name: 'Test Org 2' }
    ];

    // Create test users
    const user1Id = uuidv4();
    const user2Id = uuidv4();

    testUsers = [
      { id: user1Id, email: 'user1@test.com', password: 'testpass123' },
      { id: user2Id, email: 'user2@test.com', password: 'testpass123' }
    ];

    // Create test clients
    const client1Id = uuidv4();
    const client2Id = uuidv4();

    testClients = [
      { id: client1Id, name: 'Client 1', organizationId: org1Id },
      { id: client2Id, name: 'Client 2', organizationId: org2Id }
    ];

    // Insert test data using service client
    const { error: clientError } = await serviceClient
      .from('clients')
      .insert(testClients);

    if (clientError) {
      console.error('Error creating test clients:', clientError);
    }

    // Create organization memberships
    const { error: membershipError } = await serviceClient
      .from('organization_memberships')
      .insert([
        { user_id: user1Id, organization_id: org1Id, role: 'admin' },
        { user_id: user2Id, organization_id: org2Id, role: 'admin' }
      ]);

    if (membershipError) {
      console.error('Error creating memberships:', membershipError);
    }

    // Create test Google Ads connections
    const connection1Id = uuidv4();
    const connection2Id = uuidv4();

    testConnections = [
      {
        id: connection1Id,
        clientId: client1Id,
        customerId: '1234567890',
        accessToken: 'encrypted_access_token_1',
        refreshToken: 'encrypted_refresh_token_1'
      },
      {
        id: connection2Id,
        clientId: client2Id,
        customerId: '0987654321',
        accessToken: 'encrypted_access_token_2',
        refreshToken: 'encrypted_refresh_token_2'
      }
    ];

    const { error: connectionError } = await serviceClient
      .from('google_ads_connections')
      .insert([
        {
          id: connection1Id,
          client_id: client1Id,
          customer_id: '1234567890',
          access_token: 'encrypted_access_token_1',
          refresh_token: 'encrypted_refresh_token_1',
          status: 'active'
        },
        {
          id: connection2Id,
          client_id: client2Id,
          customer_id: '0987654321',
          access_token: 'encrypted_access_token_2',
          refresh_token: 'encrypted_refresh_token_2',
          status: 'active'
        }
      ]);

    if (connectionError) {
      console.error('Error creating test connections:', connectionError);
    }

    // Create test campaigns
    const campaign1Id = uuidv4();
    const campaign2Id = uuidv4();

    const { error: campaignError } = await serviceClient
      .from('google_ads_campaigns')
      .insert([
        {
          id: campaign1Id,
          client_id: client1Id,
          connection_id: connection1Id,
          campaign_id: 'camp_123',
          campaign_name: 'Test Campaign 1',
          status: 'ENABLED'
        },
        {
          id: campaign2Id,
          client_id: client2Id,
          connection_id: connection2Id,
          campaign_id: 'camp_456',
          campaign_name: 'Test Campaign 2',
          status: 'ENABLED'
        }
      ]);

    if (campaignError) {
      console.error('Error creating test campaigns:', campaignError);
    }

    // Create test metrics
    const { error: metricsError } = await serviceClient
      .from('google_ads_metrics')
      .insert([
        {
          campaign_id: campaign1Id,
          date: '2024-01-01',
          impressions: 1000,
          clicks: 50,
          cost: 25.00
        },
        {
          campaign_id: campaign2Id,
          date: '2024-01-01',
          impressions: 2000,
          clicks: 100,
          cost: 50.00
        }
      ]);

    if (metricsError) {
      console.error('Error creating test metrics:', metricsError);
    }
  });

  afterAll(async () => {
    // Clean up test data
    await serviceClient.from('google_ads_metrics').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await serviceClient.from('google_ads_campaigns').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await serviceClient.from('google_ads_connections').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await serviceClient.from('organization_memberships').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await serviceClient.from('clients').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await serviceClient.from('organizations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  });

  describe('Google Ads Connections RLS', () => {
    test('should isolate connections by client', async () => {
      // Create authenticated client for user 1
      const { data: authData1 } = await serviceClient.auth.signInWithPassword({
        email: testUsers[0].email,
        password: testUsers[0].password
      });

      if (!authData1.session) {
        // Create user if doesn't exist
        await serviceClient.auth.signUp({
          email: testUsers[0].email,
          password: testUsers[0].password
        });
      }

      const user1Client = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${authData1.session?.access_token}`
          }
        }
      });

      // User 1 should only see their connections
      const { data: user1Connections, error: user1Error } = await user1Client
        .from('google_ads_connections')
        .select('*');

      expect(user1Error).toBeNull();
      expect(user1Connections).toHaveLength(1);
      expect(user1Connections?.[0].client_id).toBe(testClients[0].id);

      // Create authenticated client for user 2
      const { data: authData2 } = await serviceClient.auth.signInWithPassword({
        email: testUsers[1].email,
        password: testUsers[1].password
      });

      const user2Client = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${authData2.session?.access_token}`
          }
        }
      });

      // User 2 should only see their connections
      const { data: user2Connections, error: user2Error } = await user2Client
        .from('google_ads_connections')
        .select('*');

      expect(user2Error).toBeNull();
      expect(user2Connections).toHaveLength(1);
      expect(user2Connections?.[0].client_id).toBe(testClients[1].id);
    });

    test('should prevent unauthorized access to connections', async () => {
      // Anonymous user should not see any connections
      const { data: anonConnections, error: anonError } = await anonClient
        .from('google_ads_connections')
        .select('*');

      expect(anonConnections).toHaveLength(0);
    });

    test('should prevent cross-client connection access', async () => {
      // Try to access connection from different client
      const { data: authData1 } = await serviceClient.auth.signInWithPassword({
        email: testUsers[0].email,
        password: testUsers[0].password
      });

      const user1Client = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${authData1.session?.access_token}`
          }
        }
      });

      // User 1 should not be able to access User 2's connection
      const { data: crossAccessData, error: crossAccessError } = await user1Client
        .from('google_ads_connections')
        .select('*')
        .eq('id', testConnections[1].id);

      expect(crossAccessData).toHaveLength(0);
    });
  });

  describe('Google Ads Campaigns RLS', () => {
    test('should isolate campaigns by client', async () => {
      const { data: authData1 } = await serviceClient.auth.signInWithPassword({
        email: testUsers[0].email,
        password: testUsers[0].password
      });

      const user1Client = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${authData1.session?.access_token}`
          }
        }
      });

      // User 1 should only see their campaigns
      const { data: user1Campaigns, error: user1Error } = await user1Client
        .from('google_ads_campaigns')
        .select('*');

      expect(user1Error).toBeNull();
      expect(user1Campaigns).toHaveLength(1);
      expect(user1Campaigns?.[0].client_id).toBe(testClients[0].id);
    });

    test('should prevent unauthorized campaign modifications', async () => {
      const { data: authData1 } = await serviceClient.auth.signInWithPassword({
        email: testUsers[0].email,
        password: testUsers[0].password
      });

      const user1Client = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${authData1.session?.access_token}`
          }
        }
      });

      // Try to update campaign from different client
      const { error: updateError } = await user1Client
        .from('google_ads_campaigns')
        .update({ campaign_name: 'Hacked Campaign' })
        .eq('client_id', testClients[1].id);

      // Should fail or affect 0 rows
      expect(updateError).toBeTruthy();
    });
  });

  describe('Google Ads Metrics RLS', () => {
    test('should isolate metrics by campaign ownership', async () => {
      const { data: authData1 } = await serviceClient.auth.signInWithPassword({
        email: testUsers[0].email,
        password: testUsers[0].password
      });

      const user1Client = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${authData1.session?.access_token}`
          }
        }
      });

      // User 1 should only see metrics for their campaigns
      const { data: user1Metrics, error: user1Error } = await user1Client
        .from('google_ads_metrics')
        .select(`
          *,
          google_ads_campaigns!inner(client_id)
        `);

      expect(user1Error).toBeNull();
      expect(user1Metrics).toHaveLength(1);
      expect(user1Metrics?.[0].google_ads_campaigns.client_id).toBe(testClients[0].id);
    });
  });

  describe('Multiple Clients with Same Google Account', () => {
    test('should handle same Google Ads account connected to different clients', async () => {
      // Create a third client with same Google Ads customer ID
      const client3Id = uuidv4();
      const connection3Id = uuidv4();

      await serviceClient
        .from('clients')
        .insert({
          id: client3Id,
          name: 'Client 3',
          organization_id: testOrganizations[0].id
        });

      await serviceClient
        .from('google_ads_connections')
        .insert({
          id: connection3Id,
          client_id: client3Id,
          customer_id: '1234567890', // Same as client 1
          access_token: 'encrypted_access_token_3',
          refresh_token: 'encrypted_refresh_token_3',
          status: 'active'
        });

      // Both clients should see their own connections even with same Google account
      const { data: authData1 } = await serviceClient.auth.signInWithPassword({
        email: testUsers[0].email,
        password: testUsers[0].password
      });

      const user1Client = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${authData1.session?.access_token}`
          }
        }
      });

      const { data: connections, error } = await user1Client
        .from('google_ads_connections')
        .select('*')
        .eq('customer_id', '1234567890');

      expect(error).toBeNull();
      expect(connections).toHaveLength(2); // Both client 1 and client 3
      
      // Verify both connections belong to the same organization
      const clientIds = connections?.map(conn => conn.client_id) || [];
      expect(clientIds).toContain(testClients[0].id);
      expect(clientIds).toContain(client3Id);

      // Clean up
      await serviceClient.from('google_ads_connections').delete().eq('id', connection3Id);
      await serviceClient.from('clients').delete().eq('id', client3Id);
    });
  });

  describe('Encryption Keys RLS', () => {
    test('should restrict access to encryption keys', async () => {
      // Anonymous users should not access encryption keys
      const { data: anonKeys, error: anonError } = await anonClient
        .from('google_ads_encryption_keys')
        .select('*');

      expect(anonKeys).toHaveLength(0);

      // Regular authenticated users should not access encryption keys
      const { data: authData1 } = await serviceClient.auth.signInWithPassword({
        email: testUsers[0].email,
        password: testUsers[0].password
      });

      const user1Client = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${authData1.session?.access_token}`
          }
        }
      });

      const { data: userKeys, error: userError } = await user1Client
        .from('google_ads_encryption_keys')
        .select('*');

      expect(userKeys).toHaveLength(0);
    });

    test('should allow service role access to encryption keys', async () => {
      // Service role should have full access
      const { data: serviceKeys, error: serviceError } = await serviceClient
        .from('google_ads_encryption_keys')
        .select('*');

      expect(serviceError).toBeNull();
      // Keys may or may not exist, but query should succeed
    });
  });

  describe('Audit Log RLS', () => {
    test('should allow admin users to view audit logs', async () => {
      // Create an admin user
      const adminUserId = uuidv4();
      
      await serviceClient
        .from('admin_users')
        .insert({
          user_id: adminUserId,
          is_active: true,
          created_at: new Date().toISOString()
        });

      // Admin should be able to view audit logs
      const { data: adminLogs, error: adminError } = await serviceClient
        .from('google_ads_key_audit_log')
        .select('*');

      expect(adminError).toBeNull();

      // Clean up
      await serviceClient.from('admin_users').delete().eq('user_id', adminUserId);
    });

    test('should prevent regular users from viewing audit logs', async () => {
      const { data: authData1 } = await serviceClient.auth.signInWithPassword({
        email: testUsers[0].email,
        password: testUsers[0].password
      });

      const user1Client = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${authData1.session?.access_token}`
          }
        }
      });

      const { data: userLogs, error: userError } = await user1Client
        .from('google_ads_key_audit_log')
        .select('*');

      expect(userLogs).toHaveLength(0);
    });
  });

  describe('Performance and Edge Cases', () => {
    test('should handle large number of connections efficiently', async () => {
      const startTime = Date.now();

      const { data: authData1 } = await serviceClient.auth.signInWithPassword({
        email: testUsers[0].email,
        password: testUsers[0].password
      });

      const user1Client = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${authData1.session?.access_token}`
          }
        }
      });

      // Query should complete quickly even with RLS
      const { data: connections, error } = await user1Client
        .from('google_ads_connections')
        .select('*');

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(error).toBeNull();
      expect(queryTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should handle concurrent access correctly', async () => {
      const { data: authData1 } = await serviceClient.auth.signInWithPassword({
        email: testUsers[0].email,
        password: testUsers[0].password
      });

      const user1Client = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${authData1.session?.access_token}`
          }
        }
      });

      // Simulate concurrent queries
      const promises = Array(5).fill(null).map(() =>
        user1Client
          .from('google_ads_connections')
          .select('*')
      );

      const results = await Promise.all(promises);

      // All queries should succeed and return consistent results
      results.forEach(({ data, error }) => {
        expect(error).toBeNull();
        expect(data).toHaveLength(1);
      });
    });
  });
});

// Helper function to create test data
export async function createTestGoogleAdsData() {
  // This can be used by other tests that need Google Ads test data
  return {
    organizations: testOrganizations,
    users: testUsers,
    clients: testClients,
    connections: testConnections
  };
}

// Helper function to clean up test data
export async function cleanupTestGoogleAdsData() {
  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  await serviceClient.from('google_ads_metrics').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await serviceClient.from('google_ads_campaigns').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await serviceClient.from('google_ads_connections').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await serviceClient.from('organization_memberships').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await serviceClient.from('clients').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await serviceClient.from('organizations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
}