import fs from 'fs';
import path from 'path';

const migrationPath = path.join(process.cwd(), 'database/migrations/fix-google-ads-schema.sql');

const normalizeSql = (sql: string) => sql.replace(/\s+/g, ' ');

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const extractCreatePolicyBlock = (sql: string, policyName: string): string => {
  const pattern = new RegExp(`CREATE POLICY\\s+"${escapeRegExp(policyName)}"[\\s\\S]*?;`, 'i');
  const match = sql.match(pattern);
  return match ? normalizeSql(match[0]) : '';
};

describe('Google Ads Audit Log Data Migration', () => {
  let migrationSql: string;

  beforeAll(() => {
    migrationSql = fs.readFileSync(migrationPath, 'utf-8');
  });

  describe('Migration Logic', () => {
    it('derives client_id from connection_id for existing logs', () => {
      expect(migrationSql).toMatch(
        /UPDATE\s+google_ads_audit_log\s+AS\s+audit\s+SET\s+client_id\s*=\s*conn\.client_id\s+FROM\s+google_ads_connections\s+AS\s+conn\s+WHERE\s+audit\.connection_id\s*=\s*conn\.id\s+AND\s+audit\.client_id\s+IS\s+NULL\s+AND\s+audit\.connection_id\s+IS\s+NOT\s+NULL;/i
      );
    });

    it('migrates legacy action into operation when operation is null', () => {
      expect(migrationSql).toMatch(
        /UPDATE\s+google_ads_audit_log\s+SET\s+operation\s*=\s*action\s+WHERE\s+operation\s+IS\s+NULL\s+AND\s+action\s+IS\s+NOT\s+NULL;/i
      );
    });

    it('migrates legacy details into metadata when metadata is null', () => {
      expect(migrationSql).toMatch(
        /UPDATE\s+google_ads_audit_log\s+SET\s+metadata\s*=\s*details\s+WHERE\s+metadata\s+IS\s+NULL\s+AND\s+details\s+IS\s+NOT\s+NULL;/i
      );
    });
  });

  describe('Migration Status Checks', () => {
    it('tracks total, migrated and orphaned audit log counts', () => {
      expect(migrationSql).toMatch(
        /SELECT COUNT\(\*\)\s+INTO total_count\s+FROM google_ads_audit_log;/i
      );
      expect(migrationSql).toMatch(
        /SELECT COUNT\(\*\)\s+INTO migrated_count\s+FROM google_ads_audit_log\s+WHERE client_id IS NOT NULL;/i
      );
      expect(migrationSql).toMatch(
        /SELECT COUNT\(\*\)\s+INTO orphaned_count\s+FROM google_ads_audit_log\s+WHERE client_id IS NULL;/i
      );
    });

    it('emits warning path for orphaned audit logs', () => {
      expect(migrationSql).toMatch(/IF orphaned_count > 0 THEN/i);
      expect(migrationSql).toContain('audit log entries still have no client_id');
      expect(migrationSql).toContain('These entries may need manual review');
    });
  });

  describe('Post-Migration Validation', () => {
    it('adds required structured audit columns for new writes', () => {
      const requiredColumns = [
        'client_id',
        'connection_id',
        'operation',
        'metadata',
        'resource_type',
        'resource_id',
        'success',
        'error_message',
        'sensitive_data',
      ];

      for (const column of requiredColumns) {
        expect(migrationSql).toMatch(
          new RegExp(
            `ALTER TABLE\\s+google_ads_audit_log\\s+ADD COLUMN IF NOT EXISTS\\s+${column}\\b`,
            'i'
          )
        );
      }
    });

    it('defines authenticated audit-log RLS policy scoped by client membership', () => {
      const block = extractCreatePolicyBlock(migrationSql, 'authenticated_users_audit_log_access');

      expect(block).not.toBe('');
      expect(block).toMatch(/ON\s+google_ads_audit_log/i);
      expect(block).toMatch(/FOR\s+SELECT/i);
      expect(block).toMatch(/TO\s+authenticated/i);
      expect(block).toContain('client_id IN');
      expect(block).toContain('JOIN memberships m ON m.organization_id = c.org_id');
      expect(block).toContain('OR user_id = auth.uid()');
    });
  });
});
