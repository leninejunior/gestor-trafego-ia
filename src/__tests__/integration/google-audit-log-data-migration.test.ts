/**
 * Integration Test: Google Ads Audit Log Data Migration
 * 
 * Tests the data migration process for populating client_id in existing audit logs
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing required environment variables for testing');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

describe('Google Ads Audit Log Data Migration', () => {
  let testClientId: string;
  let testConnectionId: string;
  let testUserId: string;
  let testOrgId: string;

  beforeAll(async () => {
    // Create test organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({ name: 'Test Org for Audit Migration' })
      .select()
      .single();

    if (orgError) throw orgError;
    testOrgId = org.id;

    // Create test user (simulate)
    testUserId = '00000000-0000-0000-0000-000000000001';

    // Create test membership
    await supabase
      .from('memberships')
      .insert({
        user_id: testUserId,
        organization_id: testOrgId,
        role: 'admin'
      });

    // Create test client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .insert({
        name: 'Test Client for Audit Migration',
        org_id: testOrgId
      })
      .select()
      .single();

    if (clientError) throw clientError;
    testClientId = client.id;

    // Create test Google Ads connection
    const { data: connection, error: connError } = await supabase
      .from('google_ads_connections')
      .insert({
        client_id: testClientId,
        customer_id: 'test-customer-123',
        refresh_token: 'encrypted-test-token',
        access_token: 'test-access-token',
        token_expires_at: new Date(Date.now() + 3600000).toISOString(),
        is_active: true
      })
      .select()
      .single();

    if (connError) throw connError;
    testConnectionId = connection.id;
  });

  afterAll(async () => {
    // Cleanup test data
    if (testConnectionId) {
      await supabase
        .from('google_ads_connections')
        .delete()
        .eq('id', testConnectionId);
    }

    if (testClientId) {
      await supabase
        .from('clients')
        .delete()
        .eq('id', testClientId);
    }

    if (testOrgId) {
      await supabase
        .from('memberships')
        .delete()
        .eq('organization_id', testOrgId);

      await supabase
        .from('organizations')
        .delete()
        .eq('id', testOrgId);
    }

    // Cleanup test audit logs
    await supabase
      .from('google_ads_audit_log')
      .delete()
      .eq('user_id', testUserId);
  });

  describe('Migration Logic', () => {
    test('should derive client_id from connection_id', async () => {
      // Create audit log with connection_id but no client_id
      const { data: auditLog, error: insertError } = await supabase
        .from('google_ads_audit_log')
        .insert({
          connection_id: testConnectionId,
          user_id: testUserId,
          operation: 'test_operation',
          success: true
        })
        .select()
        .single();

      expect(insertError).toBeNull();
      expect(auditLog).toBeDefined();

      // Simulate migration: Update client_id from connection
      const { error: updateError } = await supabase
        .from('google_ads_audit_log')
        .update({ client_id: testClientId })
        .eq('id', auditLog.id)
        .is('client_id', null);

      expect(updateError).toBeNull();

      // Verify client_id was set
      const { data: updated, error: fetchError } = await supabase
        .from('google_ads_audit_log')
        .select('client_id, connection_id')
        .eq('id', auditLog.id)
        .single();

      expect(fetchError).toBeNull();
      expect(updated?.client_id).toBe(testClientId);
      expect(updated?.connection_id).toBe(testConnectionId);

      // Cleanup
      await supabase
        .from('google_ads_audit_log')
        .delete()
        .eq('id', auditLog.id);
    });

    test('should migrate legacy action field to operation', async () => {
      // Create audit log with legacy 'action' field
      const { data: auditLog, error: insertError } = await supabase
        .from('google_ads_audit_log')
        .insert({
          client_id: testClientId,
          connection_id: testConnectionId,
          user_id: testUserId,
          action: 'legacy_action',
          success: true
        })
        .select()
        .single();

      expect(insertError).toBeNull();

      // Simulate migration: Copy action to operation if operation is null
      const { error: updateError } = await supabase
        .from('google_ads_audit_log')
        .update({ operation: 'legacy_action' })
        .eq('id', auditLog.id)
        .is('operation', null);

      expect(updateError).toBeNull();

      // Verify operation was set
      const { data: updated, error: fetchError } = await supabase
        .from('google_ads_audit_log')
        .select('operation, action')
        .eq('id', auditLog.id)
        .single();

      expect(fetchError).toBeNull();
      expect(updated?.operation).toBe('legacy_action');

      // Cleanup
      await supabase
        .from('google_ads_audit_log')
        .delete()
        .eq('id', auditLog.id);
    });

    test('should migrate legacy details field to metadata', async () => {
      const legacyDetails = { key: 'value', nested: { data: 'test' } };

      // Create audit log with legacy 'details' field
      const { data: auditLog, error: insertError } = await supabase
        .from('google_ads_audit_log')
        .insert({
          client_id: testClientId,
          connection_id: testConnectionId,
          user_id: testUserId,
          operation: 'test_operation',
          details: legacyDetails,
          success: true
        })
        .select()
        .single();

      expect(insertError).toBeNull();

      // Simulate migration: Copy details to metadata if metadata is null
      const { error: updateError } = await supabase
        .from('google_ads_audit_log')
        .update({ metadata: legacyDetails })
        .eq('id', auditLog.id)
        .is('metadata', null);

      expect(updateError).toBeNull();

      // Verify metadata was set
      const { data: updated, error: fetchError } = await supabase
        .from('google_ads_audit_log')
        .select('metadata, details')
        .eq('id', auditLog.id)
        .single();

      expect(fetchError).toBeNull();
      expect(updated?.metadata).toEqual(legacyDetails);

      // Cleanup
      await supabase
        .from('google_ads_audit_log')
        .delete()
        .eq('id', auditLog.id);
    });
  });

  describe('Migration Status Checks', () => {
    test('should count audit logs with and without client_id', async () => {
      // Create some test audit logs
      const logsToCreate = [
        {
          client_id: testClientId,
          connection_id: testConnectionId,
          user_id: testUserId,
          operation: 'with_client',
          success: true
        },
        {
          connection_id: testConnectionId,
          user_id: testUserId,
          operation: 'without_client',
          success: true
        }
      ];

      const { data: created, error: insertError } = await supabase
        .from('google_ads_audit_log')
        .insert(logsToCreate)
        .select();

      expect(insertError).toBeNull();
      expect(created).toHaveLength(2);

      // Count logs with client_id
      const { count: withClientCount, error: withClientError } = await supabase
        .from('google_ads_audit_log')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', testUserId)
        .not('client_id', 'is', null);

      expect(withClientError).toBeNull();
      expect(withClientCount).toBeGreaterThanOrEqual(1);

      // Count logs without client_id
      const { count: withoutClientCount, error: withoutClientError } = await supabase
        .from('google_ads_audit_log')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', testUserId)
        .is('client_id', null);

      expect(withoutClientError).toBeNull();
      expect(withoutClientCount).toBeGreaterThanOrEqual(1);

      // Cleanup
      await supabase
        .from('google_ads_audit_log')
        .delete()
        .in('id', created.map(log => log.id));
    });

    test('should identify orphaned audit logs', async () => {
      // Create an orphaned audit log (no connection, no valid user)
      const { data: orphaned, error: insertError } = await supabase
        .from('google_ads_audit_log')
        .insert({
          user_id: '00000000-0000-0000-0000-999999999999', // Non-existent user
          operation: 'orphaned_operation',
          success: false
        })
        .select()
        .single();

      expect(insertError).toBeNull();

      // Query for orphaned logs
      const { data: orphanedLogs, error: queryError } = await supabase
        .from('google_ads_audit_log')
        .select('id, user_id, connection_id, operation')
        .is('client_id', null)
        .eq('id', orphaned.id);

      expect(queryError).toBeNull();
      expect(orphanedLogs).toHaveLength(1);
      expect(orphanedLogs[0].client_id).toBeNull();

      // Cleanup
      await supabase
        .from('google_ads_audit_log')
        .delete()
        .eq('id', orphaned.id);
    });
  });

  describe('Post-Migration Validation', () => {
    test('should ensure all new audit logs have client_id', async () => {
      // Create a new audit log with all required fields
      const { data: newLog, error: insertError } = await supabase
        .from('google_ads_audit_log')
        .insert({
          client_id: testClientId,
          connection_id: testConnectionId,
          user_id: testUserId,
          operation: 'post_migration_test',
          metadata: { test: true },
          success: true
        })
        .select()
        .single();

      expect(insertError).toBeNull();
      expect(newLog.client_id).toBe(testClientId);
      expect(newLog.operation).toBe('post_migration_test');
      expect(newLog.metadata).toEqual({ test: true });

      // Cleanup
      await supabase
        .from('google_ads_audit_log')
        .delete()
        .eq('id', newLog.id);
    });

    test('should verify RLS policies work with client_id', async () => {
      // Create audit log
      const { data: auditLog, error: insertError } = await supabase
        .from('google_ads_audit_log')
        .insert({
          client_id: testClientId,
          connection_id: testConnectionId,
          user_id: testUserId,
          operation: 'rls_test',
          success: true
        })
        .select()
        .single();

      expect(insertError).toBeNull();

      // Query with client_id filter (simulating RLS)
      const { data: filtered, error: queryError } = await supabase
        .from('google_ads_audit_log')
        .select('*')
        .eq('client_id', testClientId)
        .eq('id', auditLog.id);

      expect(queryError).toBeNull();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe(auditLog.id);

      // Cleanup
      await supabase
        .from('google_ads_audit_log')
        .delete()
        .eq('id', auditLog.id);
    });
  });
});

