import fs from 'fs';
import path from 'path';

const baseSchemaPath = path.join(process.cwd(), 'database/migrations/01-google-ads-complete-schema.sql');
const fixSchemaPath = path.join(process.cwd(), 'database/migrations/fix-google-ads-schema.sql');

const readSql = (filePath: string) => fs.readFileSync(filePath, 'utf-8');
const normalizeSql = (sql: string) => sql.replace(/\s+/g, ' ');

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const extractCreatePolicyBlock = (sql: string, policyName: string): string => {
  const pattern = new RegExp(`CREATE POLICY\\s+"${escapeRegExp(policyName)}"[\\s\\S]*?;`, 'i');
  const match = sql.match(pattern);
  return match ? normalizeSql(match[0]) : '';
};

describe('Google Ads RLS Policies', () => {
  let baseSchemaSql: string;
  let fixSchemaSql: string;

  beforeAll(() => {
    baseSchemaSql = readSql(baseSchemaPath);
    fixSchemaSql = readSql(fixSchemaPath);
  });

  describe('RLS Enablement', () => {
    it('enables RLS for all Google Ads operational tables', () => {
      const tables = [
        'google_ads_connections',
        'google_ads_campaigns',
        'google_ads_metrics',
        'google_ads_sync_logs',
        'google_ads_audit_log',
      ];

      for (const table of tables) {
        expect(baseSchemaSql).toMatch(
          new RegExp(`ALTER TABLE\\s+${table}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY;`, 'i')
        );
      }
    });
  });

  describe('Client Isolation Policy Coverage', () => {
    it('defines SELECT/INSERT/UPDATE/DELETE policies for all core Google Ads tables', () => {
      const policyPrefixes: Record<string, string> = {
        google_ads_connections: 'google_connections_client',
        google_ads_campaigns: 'google_campaigns_client',
        google_ads_metrics: 'google_metrics_client',
        google_ads_sync_logs: 'google_sync_logs_client',
      };

      const commands = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];

      for (const [table, prefix] of Object.entries(policyPrefixes)) {
        for (const command of commands) {
          const policyName = `${prefix}_${command.toLowerCase()}`;
          const block = extractCreatePolicyBlock(fixSchemaSql, policyName);

          expect(block).not.toBe('');
          expect(block).toMatch(new RegExp(`ON\\s+${table}`, 'i'));
          expect(block).toMatch(new RegExp(`FOR\\s+${command}`, 'i'));
          expect(block).toMatch(/TO\s+authenticated/i);
        }
      }
    });
  });

  describe('Service Role Bypass', () => {
    it('defines full-access service_role policies for core tables', () => {
      const servicePolicies: Array<{ table: string; policy: string }> = [
        { table: 'google_ads_connections', policy: 'service_role_full_access_connections' },
        { table: 'google_ads_campaigns', policy: 'service_role_full_access_campaigns' },
        { table: 'google_ads_metrics', policy: 'service_role_full_access_metrics' },
        { table: 'google_ads_sync_logs', policy: 'service_role_full_access_sync_logs' },
      ];

      for (const entry of servicePolicies) {
        const block = extractCreatePolicyBlock(fixSchemaSql, entry.policy);
        expect(block).not.toBe('');
        expect(block).toMatch(new RegExp(`ON\\s+${entry.table}`, 'i'));
        expect(block).toMatch(/FOR\s+ALL/i);
        expect(block).toMatch(/TO\s+service_role/i);
        expect(block).toMatch(/USING\s*\(\s*true\s*\)/i);
      }
    });
  });

  describe('Isolation Logic', () => {
    it('uses membership-based checks in connection and campaign policies', () => {
      const connectionSelect = extractCreatePolicyBlock(
        fixSchemaSql,
        'google_connections_client_select'
      );
      const campaignSelect = extractCreatePolicyBlock(
        fixSchemaSql,
        'google_campaigns_client_select'
      );

      expect(connectionSelect).toContain('client_id IN');
      expect(connectionSelect).toContain('JOIN memberships m ON m.organization_id = c.org_id');

      expect(campaignSelect).toContain('client_id IN');
      expect(campaignSelect).toContain('JOIN memberships m ON m.organization_id = c.org_id');
    });

    it('uses relationship-based checks for metrics and sync logs', () => {
      const metricsSelect = extractCreatePolicyBlock(fixSchemaSql, 'google_metrics_client_select');
      const syncLogsSelect = extractCreatePolicyBlock(
        fixSchemaSql,
        'google_sync_logs_client_select'
      );

      expect(metricsSelect).toContain('campaign_id IN');
      expect(metricsSelect).toContain('FROM google_ads_campaigns gc');
      expect(metricsSelect).toContain('JOIN memberships m ON m.organization_id = c.org_id');

      expect(syncLogsSelect).toContain('connection_id IN');
      expect(syncLogsSelect).toContain('FROM google_ads_connections gac');
      expect(syncLogsSelect).toContain('JOIN memberships m ON m.organization_id = c.org_id');
    });
  });

  describe('Audit Log Policies', () => {
    it('defines both service-role and authenticated-user policies for audit log', () => {
      const serviceBlock = extractCreatePolicyBlock(fixSchemaSql, 'service_role_audit_log_access');
      const userBlock = extractCreatePolicyBlock(
        fixSchemaSql,
        'authenticated_users_audit_log_access'
      );

      expect(serviceBlock).not.toBe('');
      expect(serviceBlock).toMatch(/ON\s+google_ads_audit_log/i);
      expect(serviceBlock).toMatch(/FOR\s+ALL/i);
      expect(serviceBlock).toMatch(/TO\s+service_role/i);

      expect(userBlock).not.toBe('');
      expect(userBlock).toMatch(/ON\s+google_ads_audit_log/i);
      expect(userBlock).toMatch(/FOR\s+SELECT/i);
      expect(userBlock).toMatch(/TO\s+authenticated/i);
      expect(userBlock).toContain('client_id IN');
      expect(userBlock).toContain('JOIN memberships m ON m.organization_id = c.org_id');
      expect(userBlock).toContain('OR user_id = auth.uid()');
    });
  });

  describe('Hardening Guardrail', () => {
    it('does not define the old permissive authenticated_users_can_access_all policy', () => {
      expect(fixSchemaSql).not.toMatch(
        /CREATE POLICY\s+"authenticated_users_can_access_all"/i
      );
    });
  });
});
