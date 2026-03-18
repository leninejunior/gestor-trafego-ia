/**
 * Google Ads Sync API integration tests (contract-aligned)
 */

import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const mockSyncService = {
  startSync: jest.fn(),
};

jest.mock('@/lib/supabase/server');
jest.mock('@/lib/google/sync-service', () => ({
  getGoogleSyncService: () => mockSyncService,
}));

type QueryResult = { data: any; error: any };

function createThenableQuery(result: QueryResult) {
  const chain: any = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    in: jest.fn(() => chain),
    is: jest.fn(() => chain),
    gte: jest.fn(() => chain),
    single: jest.fn(async () => result),
    then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
  };

  return chain;
}

type SupabaseScenario = {
  user?: { id: string } | null;
  client?: { org_id: string } | null;
  membership?: { id: string } | null;
  connections?: Array<{ id: string; customer_id: string; status: string; last_sync_at?: string | null }>;
  activeSyncs?: Array<{ id: string; connection_id: string; sync_type: string; started_at: string }>;
};

function createSupabaseMock(scenario: SupabaseScenario = {}) {
  const {
    user = { id: 'user-123' },
    client = { org_id: 'org-123' },
    membership = { id: 'membership-123' },
    connections = [
      {
        id: '30000000-0000-4000-8000-000000000003',
        customer_id: '1234567890',
        status: 'active',
        last_sync_at: null,
      },
    ],
    activeSyncs = [],
  } = scenario;

  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user },
        error: user ? null : { message: 'unauthorized' },
      }),
    },
    from: jest.fn((table: string) => {
      if (table === 'clients') {
        return createThenableQuery({ data: client, error: null });
      }
      if (table === 'memberships') {
        return createThenableQuery({ data: membership, error: null });
      }
      if (table === 'google_ads_connections') {
        return createThenableQuery({ data: connections, error: null });
      }
      if (table === 'google_ads_sync_logs') {
        return createThenableQuery({ data: activeSyncs, error: null });
      }
      return createThenableQuery({ data: [], error: null });
    }),
  };
}

function buildSyncRequest(payload: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/google/sync', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

describe('Google Ads Sync End-to-End Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSyncService.startSync.mockResolvedValue({
      syncId: 'sync-123',
      status: 'started',
      estimatedTime: 45,
    });
  });

  it('returns 400 for invalid UUID payload', async () => {
    const { POST } = await import('@/app/api/google/sync/route');

    const response = await POST(
      buildSyncRequest({
        clientId: 'client-123',
        fullSync: true,
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Dados inválidos');
  });

  it('returns 401 when user is not authenticated', async () => {
    (createClient as jest.Mock).mockResolvedValue(
      createSupabaseMock({
        user: null,
      })
    );

    const { POST } = await import('@/app/api/google/sync/route');
    const response = await POST(
      buildSyncRequest({
        clientId: '10000000-0000-4000-8000-000000000001',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Não autorizado');
  });

  it('starts sync successfully with valid payload', async () => {
    const clientId = '10000000-0000-4000-8000-000000000001';
    const connectionId = '30000000-0000-4000-8000-000000000003';

    (createClient as jest.Mock).mockResolvedValue(
      createSupabaseMock({
        connections: [
          {
            id: connectionId,
            customer_id: '1234567890',
            status: 'active',
          },
        ],
      })
    );

    const { POST } = await import('@/app/api/google/sync/route');
    const response = await POST(
      buildSyncRequest({
        clientId,
        fullSync: false,
        syncType: 'campaigns',
        dateFrom: '2026-02-01',
        dateTo: '2026-02-10',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.summary.successful).toBe(1);
    expect(body.results[0].status).toBe('started');
    expect(mockSyncService.startSync).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId,
        connectionId,
        customerId: '1234567890',
        fullSync: false,
        syncType: 'campaigns',
        dateRange: {
          startDate: '2026-02-01',
          endDate: '2026-02-10',
        },
      })
    );
  });

  it('returns 403 when user has no membership for the client', async () => {
    (createClient as jest.Mock).mockResolvedValue(
      createSupabaseMock({
        membership: null,
      })
    );

    const { POST } = await import('@/app/api/google/sync/route');
    const response = await POST(
      buildSyncRequest({
        clientId: '20000000-0000-4000-8000-000000000002',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Acesso negado ao cliente especificado');
  });

  it('returns 409 when a sync is already in progress', async () => {
    (createClient as jest.Mock).mockResolvedValue(
      createSupabaseMock({
        connections: [
          {
            id: '30000000-0000-4000-8000-000000000003',
            customer_id: '1234567890',
            status: 'active',
          },
        ],
        activeSyncs: [
          {
            id: 'sync-log-1',
            connection_id: '30000000-0000-4000-8000-000000000003',
            sync_type: 'full',
            started_at: '2026-02-26T10:00:00.000Z',
          },
        ],
      })
    );

    const { POST } = await import('@/app/api/google/sync/route');
    const response = await POST(
      buildSyncRequest({
        clientId: '30000000-0000-4000-8000-000000000003',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe('Sincronização já em andamento');
  });

  it('returns 400 when connection has invalid customer ID format', async () => {
    (createClient as jest.Mock).mockResolvedValue(
      createSupabaseMock({
        connections: [
          {
            id: '40000000-0000-4000-8000-000000000004',
            customer_id: '123',
            status: 'active',
          },
        ],
      })
    );

    const { POST } = await import('@/app/api/google/sync/route');
    const response = await POST(
      buildSyncRequest({
        clientId: '40000000-0000-4000-8000-000000000004',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Formato inválido de Customer ID');
  });

  it('enforces rate limit after 3 sync requests', async () => {
    const rateLimitClientId = '50000000-0000-4000-8000-000000000005';
    (createClient as jest.Mock).mockResolvedValue(createSupabaseMock());

    const { POST } = await import('@/app/api/google/sync/route');

    const first = await POST(buildSyncRequest({ clientId: rateLimitClientId }));
    const second = await POST(buildSyncRequest({ clientId: rateLimitClientId }));
    const third = await POST(buildSyncRequest({ clientId: rateLimitClientId }));
    const fourth = await POST(buildSyncRequest({ clientId: rateLimitClientId }));
    const fourthBody = await fourth.json();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(200);
    expect(fourth.status).toBe(429);
    expect(fourthBody.error).toBe('Limite de sincronizações excedido');
    expect(mockSyncService.startSync).toHaveBeenCalledTimes(3);
  });
});
