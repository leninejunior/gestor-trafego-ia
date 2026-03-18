/**
 * Google Ads audit logging integration tests (deterministic)
 */

import { GoogleAdsAuditService } from '@/lib/google/audit-service';
import { createServiceClient } from '@/lib/supabase/server';

jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: jest.fn(),
}));

const createServiceClientMock = createServiceClient as jest.MockedFunction<typeof createServiceClient>;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('Google Ads Audit Log Schema', () => {
  let auditService: GoogleAdsAuditService;
  let insertedLogs: Array<Record<string, any>>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    insertedLogs = [];

    createServiceClientMock.mockReturnValue({
      from: jest.fn((table: string) => {
        if (table !== 'google_ads_audit_log') {
          throw new Error(`Unexpected table: ${table}`);
        }

        return {
          insert: jest.fn((payload: Record<string, any>) => {
            const record = {
              id: `log-${insertedLogs.length + 1}`,
              ...payload,
            };
            insertedLogs.push(record);

            return {
              select: jest.fn(() => ({
                single: jest.fn(async () => ({
                  data: { id: record.id },
                  error: null,
                })),
              })),
            };
          }),
        };
      }),
    } as any);

    auditService = new GoogleAdsAuditService();
  });

  test('should write audit records with required schema fields', async () => {
    const auditId = await auditService.logEvent({
      operation: 'sync',
      resourceType: 'google_ads_metrics',
      resourceId: 'resource-1',
      userId: 'user-1',
      clientId: '00000000-0000-4000-8000-000000000001',
      success: true,
      metadata: { source: 'test' },
    });

    expect(auditId).toBe('log-1');
    expect(insertedLogs).toHaveLength(1);

    const row = insertedLogs[0];
    const requiredColumns = [
      'operation',
      'resource_type',
      'resource_id',
      'user_id',
      'client_id',
      'success',
      'error_message',
      'metadata',
      'sensitive_data',
      'created_at',
    ];

    requiredColumns.forEach((column) => {
      expect(row).toHaveProperty(column);
    });

    expect(row.resource_type).toBe('google_ads_metrics');
    expect(row.created_at).toBeDefined();
  });

  test('should log connection event with client_id and connection_id', async () => {
    const clientId = '00000000-0000-4000-8000-000000000002';
    const connectionId = '00000000-0000-4000-8000-000000000003';

    await auditService.logConnection('connect', connectionId, clientId, 'user-1', true, undefined, {
      env: 'test',
    });

    const row = insertedLogs[0];

    expect(row.operation).toBe('connect');
    expect(row.resource_type).toBe('google_ads_connection');
    expect(row.resource_id).toBe(connectionId);
    expect(row.client_id).toBe(clientId);
    expect(row.client_id).toMatch(UUID_REGEX);
    expect(row.resource_id).toMatch(UUID_REGEX);
  });

  test('should log data access event with client_id', async () => {
    const clientId = '00000000-0000-4000-8000-000000000004';

    await auditService.logDataAccess(
      'view_campaigns',
      'google_ads_campaign',
      'campaign-123',
      clientId,
      'user-1',
      { campaignName: 'Campaign A' }
    );

    const row = insertedLogs[0];

    expect(row.operation).toBe('view_campaigns');
    expect(row.resource_type).toBe('google_ads_campaign');
    expect(row.resource_id).toBe('campaign-123');
    expect(row.client_id).toBe(clientId);
    expect(row.success).toBe(true);
  });

  test('should log token operation as sensitive and hash token metadata', async () => {
    const clientId = '00000000-0000-4000-8000-000000000005';
    const connectionId = '00000000-0000-4000-8000-000000000006';

    await auditService.logTokenOperation(
      'token_refresh',
      connectionId,
      clientId,
      true,
      undefined,
      { tokenHash: 'plain-token-value' }
    );

    const row = insertedLogs[0];
    const metadata = JSON.parse(row.metadata);

    expect(row.operation).toBe('token_refresh');
    expect(row.resource_type).toBe('access_token');
    expect(row.client_id).toBe(clientId);
    expect(row.sensitive_data).toBe(true);
    expect(metadata.tokenHash).toBeDefined();
    expect(metadata.tokenHash).not.toBe('plain-token-value');
  });

  test('should log API call with endpoint metadata', async () => {
    const clientId = '00000000-0000-4000-8000-000000000007';

    await auditService.logApiCall(
      '/api/google/sync',
      clientId,
      'user-1',
      true,
      180,
      undefined,
      { method: 'POST' }
    );

    const row = insertedLogs[0];
    const metadata = JSON.parse(row.metadata);

    expect(row.operation).toBe('api_call');
    expect(row.resource_type).toBe('api_endpoint');
    expect(row.resource_id).toBe('/api/google/sync');
    expect(row.client_id).toBe(clientId);
    expect(metadata.endpoint).toBe('/api/google/sync');
    expect(metadata.responseTime).toBe(180);
    expect(metadata.method).toBe('POST');
  });

  test('should handle missing client_id gracefully', async () => {
    await expect(
      auditService.logEvent({
        operation: 'data_access',
        resourceType: 'google_ads_metrics',
        success: true,
      })
    ).resolves.not.toThrow();

    const row = insertedLogs[0];
    expect(row.client_id).toBeUndefined();
    expect(row.success).toBe(true);
  });
});
