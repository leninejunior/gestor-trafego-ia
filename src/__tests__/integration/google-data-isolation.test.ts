/**
 * Google Ads Data Isolation Integration Tests (contract-aligned)
 */

import { createClient } from '@/lib/supabase/server';

jest.mock('@/lib/supabase/server');

jest.mock('@/lib/middleware/user-access-middleware', () => ({
  requireClientAccess: () => (handler: any) => async (request: any) =>
    handler(request, {
      user: { id: 'user-123' },
      hasClientAccess: jest.fn().mockResolvedValue(true),
    }),
  createAccessControl: {
    createConnection: () => (handler: any) => async (request: any) =>
      handler(request, {
        user: { id: 'user-123' },
        hasClientAccess: jest.fn().mockResolvedValue(true),
      }),
  },
}));

jest.mock('@/lib/google/cache-service', () => ({
  googleAdsCache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  },
  CacheKeyBuilder: {
    metrics: jest.fn(() => 'google-metrics-cache-key'),
  },
  CACHE_TTL: {
    metrics: 300,
  },
}));

type QueryResult = { data: any; error: any };

function createThenableQuery(result: QueryResult) {
  const chain: any = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    gte: jest.fn(() => chain),
    lte: jest.fn(() => chain),
    gt: jest.fn(() => chain),
    in: jest.fn(() => chain),
    order: jest.fn(() => chain),
    maybeSingle: jest.fn(async () => result),
    single: jest.fn(async () => result),
    then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
  };

  return chain;
}

function createRequest(url: URL | string) {
  return { url: typeof url === 'string' ? url : url.toString(), nextUrl: new URL(url.toString()) } as any;
}

describe('Google Ads Data Isolation Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GOOGLE_CLIENT_ID = 'google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret';
    process.env.GOOGLE_DEVELOPER_TOKEN = 'google-developer-token';
  });

  it('lists only client connections in connections route', async () => {
    const supabaseMock = {
      from: jest.fn((table: string) => {
        if (table === 'google_ads_connections') {
          return createThenableQuery({
            data: [{ id: 'conn-1', client_id: '11111111-1111-1111-1111-111111111111', status: 'active' }],
            error: null,
          });
        }
        return createThenableQuery({ data: [], error: null });
      }),
    };

    (createClient as jest.Mock).mockResolvedValue(supabaseMock);

    const { GET } = await import('@/app/api/google/connections/route');
    const url = new URL('http://localhost:3000/api/google/connections');
    url.searchParams.set('clientId', '11111111-1111-1111-1111-111111111111');

    const response = await GET(createRequest(url));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.connections).toHaveLength(1);
    expect(body.connections[0].client_id).toBe('11111111-1111-1111-1111-111111111111');
  });

  it('validates missing clientId in connections route', async () => {
    (createClient as jest.Mock).mockResolvedValue({
      from: jest.fn(() => createThenableQuery({ data: [], error: null })),
    });

    const { GET } = await import('@/app/api/google/connections/route');
    const response = await GET(createRequest('http://localhost:3000/api/google/connections'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('clientId é obrigatório');
  });

  it('returns 401 in campaigns route when user is not authenticated', async () => {
    const supabaseMock = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: null },
          error: { message: 'unauthorized' },
        }),
      },
      from: jest.fn(() => createThenableQuery({ data: [], error: null })),
    };

    (createClient as jest.Mock).mockResolvedValue(supabaseMock);

    const { GET } = await import('@/app/api/google/campaigns/route');
    const url = new URL('http://localhost:3000/api/google/campaigns');
    url.searchParams.set('clientId', '11111111-1111-1111-1111-111111111111');

    const response = await GET(createRequest(url));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.message).toBe('Usuário não autenticado');
  });

  it('filters campaigns by client in campaigns route', async () => {
    const supabaseMock = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'user-123', email: 'user@example.com' } },
          error: null,
        }),
      },
      from: jest.fn((table: string) => {
        if (table === 'google_ads_connections') {
          return createThenableQuery({
            data: { id: 'conn-1', customer_id: '1234567890', status: 'active' },
            error: null,
          });
        }

        if (table === 'google_ads_campaigns') {
          return createThenableQuery({
            data: [
              {
                id: 'camp-1',
                campaign_id: 'c-001',
                campaign_name: 'Campaign 1',
                status: 'ENABLED',
                created_at: '2026-02-01T00:00:00.000Z',
                updated_at: '2026-02-02T00:00:00.000Z',
                start_date: '2026-02-01',
                end_date: null,
                connection: { customer_id: '1234567890' },
                metrics: [
                  {
                    date: '2026-02-01',
                    impressions: 1000,
                    clicks: 100,
                    conversions: 10,
                    cost: 50,
                    ctr: 10,
                    cpc: 0.5,
                    cpa: 5,
                    roas: 2,
                  },
                ],
              },
            ],
            error: null,
          });
        }

        return createThenableQuery({ data: [], error: null });
      }),
    };

    (createClient as jest.Mock).mockResolvedValue(supabaseMock);

    const { GET } = await import('@/app/api/google/campaigns/route');
    const url = new URL('http://localhost:3000/api/google/campaigns');
    url.searchParams.set('clientId', '11111111-1111-1111-1111-111111111111');
    url.searchParams.set('startDate', '2026-02-01');
    url.searchParams.set('endDate', '2026-02-01');

    const response = await GET(createRequest(url));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.campaigns).toHaveLength(1);
    expect(body.campaigns[0].campaign_id).toBe('c-001');
    expect(body.campaigns[0].metrics.impressions).toBe(1000);
  });

  it('validates UUID format in metrics route', async () => {
    (createClient as jest.Mock).mockResolvedValue({
      auth: {
        getUser: jest.fn(),
      },
      from: jest.fn(() => createThenableQuery({ data: [], error: null })),
    });

    const { GET } = await import('@/app/api/google/metrics/route');
    const url = new URL('http://localhost:3000/api/google/metrics');
    url.searchParams.set('clientId', 'client-123');
    url.searchParams.set('dateFrom', '2026-02-01');
    url.searchParams.set('dateTo', '2026-02-10');

    const response = await GET(createRequest(url));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Parâmetros inválidos');
  });

  it('returns 403 when user has no membership for requested client in metrics route', async () => {
    const supabaseMock = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'user-123', email: 'user@example.com' } },
          error: null,
        }),
      },
      from: jest.fn((table: string) => {
        if (table === 'clients') {
          return createThenableQuery({
            data: { id: '11111111-1111-1111-1111-111111111111', org_id: 'org-123' },
            error: null,
          });
        }
        if (table === 'memberships') {
          return createThenableQuery({
            data: null,
            error: null,
          });
        }
        return createThenableQuery({ data: [], error: null });
      }),
    };

    (createClient as jest.Mock).mockResolvedValue(supabaseMock);

    const { GET } = await import('@/app/api/google/metrics/route');
    const url = new URL('http://localhost:3000/api/google/metrics');
    url.searchParams.set('clientId', '11111111-1111-1111-1111-111111111111');
    url.searchParams.set('dateFrom', '2026-02-01');
    url.searchParams.set('dateTo', '2026-02-10');

    const response = await GET(createRequest(url));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Acesso negado ao cliente especificado');
  });
});
