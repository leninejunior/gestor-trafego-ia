/**
 * Integration Tests for Google Ads RLS Policies
 * 
 * These tests verify that Row Level Security policies properly isolate
 * client data in all Google Ads related tables.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

describe('Google Ads RLS Policies', () => {
  let supabase: ReturnType<typeof createClient>;

  beforeAll(() => {
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required environment variables');
    }

    supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  });

  describe('RLS Policy Existence', () => {
    it('should have RLS enabled on google_ads_connections', async () => {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT relrowsecurity 
          FROM pg_class 
          WHERE relname = 'google_ads_connections';
        `
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data[0]?.relrowsecurity).toBe(true);
    });

    it('should have RLS enabled on google_ads_campaigns', async () => {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT relrowsecurity 
          FROM pg_class 
          WHERE relname = 'google_ads_campaigns';
        `
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data[0]?.relrowsecurity).toBe(true);
    });

    it('should have RLS enabled on google_ads_metrics', async () => {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT relrowsecurity 
          FROM pg_class 
          WHERE relname = 'google_ads_metrics';
        `
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data[0]?.relrowsecurity).toBe(true);
    });

    it('should have RLS enabled on google_ads_sync_logs', async () => {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT relrowsecurity 
          FROM pg_class 
          WHERE relname = 'google_ads_sync_logs';
        `
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data[0]?.relrowsecurity).toBe(true);
    });

    it('should have RLS enabled on google_ads_audit_log', async () => {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT relrowsecurity 
          FROM pg_class 
          WHERE relname = 'google_ads_audit_log';
        `
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data[0]?.relrowsecurity).toBe(true);
    });
  });

  describe('RLS Policy Configuration', () => {
    it('should have client isolation policies for google_ads_connections', async () => {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT policyname, cmd, roles::text[]
          FROM pg_policies
          WHERE tablename = 'google_ads_connections'
          AND policyname LIKE '%client%'
          ORDER BY policyname;
        `
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.length).toBeGreaterThan(0);
      
      // Should have policies for SELECT, INSERT, UPDATE, DELETE
      const commands = data.map((p: any) => p.cmd);
      expect(commands).toContain('SELECT');
      expect(commands).toContain('INSERT');
      expect(commands).toContain('UPDATE');
      expect(commands).toContain('DELETE');
    });

    it('should have client isolation policies for google_ads_campaigns', async () => {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT policyname, cmd, roles::text[]
          FROM pg_policies
          WHERE tablename = 'google_ads_campaigns'
          AND policyname LIKE '%client%'
          ORDER BY policyname;
        `
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.length).toBeGreaterThan(0);
      
      const commands = data.map((p: any) => p.cmd);
      expect(commands).toContain('SELECT');
      expect(commands).toContain('INSERT');
      expect(commands).toContain('UPDATE');
      expect(commands).toContain('DELETE');
    });

    it('should have client isolation policies for google_ads_metrics', async () => {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT policyname, cmd, roles::text[]
          FROM pg_policies
          WHERE tablename = 'google_ads_metrics'
          AND policyname LIKE '%client%'
          ORDER BY policyname;
        `
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.length).toBeGreaterThan(0);
      
      const commands = data.map((p: any) => p.cmd);
      expect(commands).toContain('SELECT');
      expect(commands).toContain('INSERT');
      expect(commands).toContain('UPDATE');
      expect(commands).toContain('DELETE');
    });

    it('should have client isolation policies for google_ads_sync_logs', async () => {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT policyname, cmd, roles::text[]
          FROM pg_policies
          WHERE tablename = 'google_ads_sync_logs'
          AND policyname LIKE '%client%'
          ORDER BY policyname;
        `
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.length).toBeGreaterThan(0);
      
      const commands = data.map((p: any) => p.cmd);
      expect(commands).toContain('SELECT');
      expect(commands).toContain('INSERT');
      expect(commands).toContain('UPDATE');
      expect(commands).toContain('DELETE');
    });

    it('should have service role bypass policies', async () => {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT tablename, policyname
          FROM pg_policies
          WHERE tablename IN (
            'google_ads_connections',
            'google_ads_campaigns',
            'google_ads_metrics',
            'google_ads_sync_logs'
          )
          AND policyname LIKE '%service_role%'
          ORDER BY tablename;
        `
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.length).toBeGreaterThanOrEqual(4); // One for each table
    });
  });

  describe('RLS Policy Logic', () => {
    it('should filter connections by client membership', async () => {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT qual
          FROM pg_policies
          WHERE tablename = 'google_ads_connections'
          AND policyname = 'google_connections_client_select';
        `
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data[0]?.qual).toContain('client_id');
      expect(data[0]?.qual).toContain('memberships');
      expect(data[0]?.qual).toContain('organization_id');
    });

    it('should filter campaigns by client membership', async () => {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT qual
          FROM pg_policies
          WHERE tablename = 'google_ads_campaigns'
          AND policyname = 'google_campaigns_client_select';
        `
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data[0]?.qual).toContain('client_id');
      expect(data[0]?.qual).toContain('memberships');
      expect(data[0]?.qual).toContain('organization_id');
    });

    it('should filter metrics by campaign ownership', async () => {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT qual
          FROM pg_policies
          WHERE tablename = 'google_ads_metrics'
          AND policyname = 'google_metrics_client_select';
        `
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data[0]?.qual).toContain('campaign_id');
      expect(data[0]?.qual).toContain('google_ads_campaigns');
      expect(data[0]?.qual).toContain('memberships');
    });

    it('should filter sync logs by connection ownership', async () => {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT qual
          FROM pg_policies
          WHERE tablename = 'google_ads_sync_logs'
          AND policyname = 'google_sync_logs_client_select';
        `
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data[0]?.qual).toContain('connection_id');
      expect(data[0]?.qual).toContain('google_ads_connections');
      expect(data[0]?.qual).toContain('memberships');
    });
  });

  describe('Policy Coverage', () => {
    it('should have all CRUD policies for each table', async () => {
      const tables = [
        'google_ads_connections',
        'google_ads_campaigns',
        'google_ads_metrics',
        'google_ads_sync_logs'
      ];

      for (const table of tables) {
        const { data, error } = await supabase.rpc('exec_sql', {
          sql: `
            SELECT cmd
            FROM pg_policies
            WHERE tablename = '${table}'
            AND policyname LIKE '%client%'
            ORDER BY cmd;
          `
        });

        expect(error).toBeNull();
        expect(data).toBeDefined();
        
        const commands = data.map((p: any) => p.cmd);
        expect(commands).toContain('SELECT');
        expect(commands).toContain('INSERT');
        expect(commands).toContain('UPDATE');
        expect(commands).toContain('DELETE');
      }
    });

    it('should not have overly permissive "access all" policies', async () => {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT tablename, policyname
          FROM pg_policies
          WHERE tablename IN (
            'google_ads_connections',
            'google_ads_campaigns',
            'google_ads_metrics',
            'google_ads_sync_logs'
          )
          AND policyname = 'authenticated_users_can_access_all';
        `
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.length).toBe(0); // Should not find any overly permissive policies
    });
  });

  describe('Audit Log RLS', () => {
    it('should have proper RLS policies for audit log', async () => {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT policyname, cmd, roles::text[]
          FROM pg_policies
          WHERE tablename = 'google_ads_audit_log'
          ORDER BY policyname;
        `
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.length).toBeGreaterThan(0);
      
      // Should have service role and authenticated user policies
      const policyNames = data.map((p: any) => p.policyname);
      expect(policyNames.some((name: string) => name.includes('service_role'))).toBe(true);
      expect(policyNames.some((name: string) => name.includes('authenticated'))).toBe(true);
    });

    it('should filter audit logs by client_id', async () => {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT qual
          FROM pg_policies
          WHERE tablename = 'google_ads_audit_log'
          AND policyname = 'authenticated_users_audit_log_access';
        `
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data[0]?.qual).toContain('client_id');
      expect(data[0]?.qual).toContain('memberships');
    });
  });
});
