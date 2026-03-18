/**
 * Admin subscription intents integration tests (contract-aligned)
 */

import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GET as listIntents } from '@/app/api/admin/subscription-intents/route';
import {
  GET as getIntentDetails,
  PATCH as patchIntent,
  DELETE as deleteIntent,
} from '@/app/api/admin/subscription-intents/[intentId]/route';
import {
  GET as getAnalytics,
  POST as analyticsActions,
} from '@/app/api/admin/subscription-intents/analytics/route';

const mockIntentService = {
  executeStateTransition: jest.fn(),
  deleteIntent: jest.fn(),
  updateIntent: jest.fn(),
};

jest.mock('@/lib/supabase/server');
jest.mock('@/lib/services/subscription-intent-service', () => ({
  getSubscriptionIntentService: () => mockIntentService,
}));

type QueryResult = {
  data: any;
  error: any;
  count?: number | null;
};

function createThenableQuery(result: QueryResult) {
  const chain: any = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    in: jest.fn(() => chain),
    ilike: jest.fn(() => chain),
    gte: jest.fn(() => chain),
    lte: jest.fn(() => chain),
    order: jest.fn(() => chain),
    range: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    delete: jest.fn(() => chain),
    single: jest.fn(async () => result),
    then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
  };

  return chain;
}

type SupabaseScenario = {
  user?: { id: string; email?: string } | null;
  tableResults?: Record<string, QueryResult | QueryResult[]>;
};

function createSupabaseMock(scenario: SupabaseScenario = {}) {
  const { user = { id: 'admin-123', email: 'admin@example.com' }, tableResults = {} } = scenario;

  const resultsByTable = new Map<string, QueryResult[]>();
  const queryByTable: Record<string, any[]> = {};

  Object.entries(tableResults).forEach(([table, result]) => {
    resultsByTable.set(table, Array.isArray(result) ? [...result] : [result]);
  });

  const supabase = {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user },
        error: user ? null : { message: 'unauthorized' },
      }),
    },
    from: jest.fn((table: string) => {
      const queue = resultsByTable.get(table);
      const result = queue && queue.length > 0
        ? (queue.length > 1 ? queue.shift()! : queue[0])
        : { data: [], error: null, count: 0 };

      const query = createThenableQuery(result);
      if (!queryByTable[table]) {
        queryByTable[table] = [];
      }
      queryByTable[table].push(query);
      return query;
    }),
  };

  return { supabase, queryByTable };
}

describe('Admin Panel Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIntentService.executeStateTransition.mockReset();
    mockIntentService.deleteIntent.mockReset();
    mockIntentService.updateIntent.mockReset();
  });

  it('lists intents with filters and pagination', async () => {
    const intents = [
      { id: 'intent-1', status: 'pending', user_email: 'first@example.com' },
      { id: 'intent-2', status: 'processing', user_email: 'second@example.com' },
    ];

    const { supabase, queryByTable } = createSupabaseMock({
      tableResults: {
        user_profiles: { data: { role: 'admin' }, error: null },
        subscription_intents: [
          { data: intents, error: null, count: 2 },
          { data: null, error: null, count: 2 },
        ],
      },
    });
    (createClient as jest.Mock).mockResolvedValue(supabase);

    const request = new NextRequest(
      'http://localhost:3000/api/admin/subscription-intents?status=pending,processing&plan_id=plan-pro&user_email=example.com&created_after=2026-01-01&created_before=2026-01-31&page=2&limit=20'
    );

    const response = await listIntents(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.intents).toHaveLength(2);
    expect(body.page).toBe(2);
    expect(body.limit).toBe(20);
    expect(body.total).toBe(2);

    const listQuery = queryByTable.subscription_intents[0];
    expect(listQuery.in).toHaveBeenCalledWith('status', ['pending', 'processing']);
    expect(listQuery.eq).toHaveBeenCalledWith('plan_id', 'plan-pro');
    expect(listQuery.ilike).toHaveBeenCalledWith('user_email', '%example.com%');
    expect(listQuery.gte).toHaveBeenCalledWith('created_at', '2026-01-01');
    expect(listQuery.lte).toHaveBeenCalledWith('created_at', '2026-01-31');
    expect(listQuery.range).toHaveBeenCalledWith(20, 39);
  });

  it('returns 401 for unauthenticated admin listing', async () => {
    const { supabase } = createSupabaseMock({ user: null });
    (createClient as jest.Mock).mockResolvedValue(supabase);

    const response = await listIntents(
      new NextRequest('http://localhost:3000/api/admin/subscription-intents')
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns details, webhook logs and state transitions for an intent', async () => {
    const { supabase } = createSupabaseMock({
      tableResults: {
        user_profiles: { data: { role: 'admin' }, error: null },
        subscription_intents: {
          data: { id: 'intent-123', status: 'pending', plan: { id: 'plan-pro', name: 'Pro' } },
          error: null,
        },
        webhook_logs: {
          data: [{ id: 'log-1', subscription_intent_id: 'intent-123' }],
          error: null,
        },
        subscription_intent_transitions: {
          data: [{ id: 'transition-1', subscription_intent_id: 'intent-123' }],
          error: null,
        },
      },
    });
    (createClient as jest.Mock).mockResolvedValue(supabase);

    const response = await getIntentDetails(
      new NextRequest('http://localhost:3000/api/admin/subscription-intents/intent-123'),
      { params: { intentId: 'intent-123' } } as any
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.intent.id).toBe('intent-123');
    expect(body.webhook_logs).toHaveLength(1);
    expect(body.state_transitions).toHaveLength(1);
  });

  it('patch activate delegates to state transition service', async () => {
    const { supabase } = createSupabaseMock({
      tableResults: {
        user_profiles: { data: { role: 'admin' }, error: null },
      },
    });
    (createClient as jest.Mock).mockResolvedValue(supabase);

    mockIntentService.executeStateTransition.mockResolvedValue({
      id: 'intent-123',
      status: 'completed',
    });

    const response = await patchIntent(
      new NextRequest('http://localhost:3000/api/admin/subscription-intents/intent-123', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'activate' }),
      }),
      { params: { intentId: 'intent-123' } } as any
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.intent.status).toBe('completed');
    expect(mockIntentService.executeStateTransition).toHaveBeenCalledWith(
      'intent-123',
      'completed',
      expect.objectContaining({
        triggeredBy: 'admin-123',
      })
    );
  });

  it('returns 400 for invalid patch action', async () => {
    const { supabase } = createSupabaseMock({
      tableResults: {
        user_profiles: { data: { role: 'admin' }, error: null },
      },
    });
    (createClient as jest.Mock).mockResolvedValue(supabase);

    const response = await patchIntent(
      new NextRequest('http://localhost:3000/api/admin/subscription-intents/intent-123', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'unknown_action' }),
      }),
      { params: { intentId: 'intent-123' } } as any
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('Invalid action');
  });

  it('forbids delete for non super admin', async () => {
    const { supabase } = createSupabaseMock({
      tableResults: {
        user_profiles: { data: { role: 'admin' }, error: null },
      },
    });
    (createClient as jest.Mock).mockResolvedValue(supabase);

    const response = await deleteIntent(
      new NextRequest('http://localhost:3000/api/admin/subscription-intents/intent-123', {
        method: 'DELETE',
      }),
      { params: { intentId: 'intent-123' } } as any
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Forbidden');
  });

  it('calculates analytics metrics and trend', async () => {
    const { supabase } = createSupabaseMock({
      tableResults: {
        memberships: { data: { role: 'admin' }, error: null },
        subscription_intents: {
          data: [
            {
              id: 'intent-1',
              status: 'completed',
              created_at: '2026-02-01T10:00:00.000Z',
              completed_at: '2026-02-01T11:00:00.000Z',
              plan_id: 'plan-pro',
              billing_cycle: 'monthly',
              subscription_plans: { name: 'Pro', monthly_price: 100, annual_price: 1000 },
            },
            {
              id: 'intent-2',
              status: 'pending',
              created_at: '2026-02-02T10:00:00.000Z',
              completed_at: null,
              plan_id: 'plan-pro',
              billing_cycle: 'monthly',
              subscription_plans: { name: 'Pro', monthly_price: 100, annual_price: 1000 },
            },
          ],
          error: null,
        },
      },
    });
    (createClient as jest.Mock).mockResolvedValue(supabase);

    const response = await getAnalytics(
      new NextRequest(
        'http://localhost:3000/api/admin/subscription-intents/analytics?period_start=2026-02-01T00:00:00.000Z&period_end=2026-02-28T23:59:59.999Z'
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.analytics.metrics.total_intents).toBe(2);
    expect(body.analytics.metrics.completed_intents).toBe(1);
    expect(body.analytics.metrics.conversion_rate).toBe(50);
    expect(body.analytics.metrics.total_revenue).toBe(100);
    expect(body.conversion_trend).toHaveLength(30);
  });

  it('exports analytics as csv', async () => {
    const { supabase } = createSupabaseMock({
      tableResults: {
        memberships: { data: { role: 'admin' }, error: null },
        subscription_intents: {
          data: [
            {
              id: 'intent-123',
              status: 'completed',
              user_email: 'customer@example.com',
              user_name: 'Customer Name',
              organization_name: 'Customer Org',
              billing_cycle: 'monthly',
              created_at: '2026-02-01T10:00:00.000Z',
              completed_at: '2026-02-01T11:00:00.000Z',
              subscription_plans: { name: 'Pro', monthly_price: 100, annual_price: 1000 },
            },
          ],
          error: null,
        },
      },
    });
    (createClient as jest.Mock).mockResolvedValue(supabase);

    const response = await analyticsActions(
      new NextRequest('http://localhost:3000/api/admin/subscription-intents/analytics', {
        method: 'POST',
        body: JSON.stringify({
          action: 'export_analytics',
          format: 'csv',
          period_start: '2026-02-01T00:00:00.000Z',
          period_end: '2026-02-28T23:59:59.999Z',
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toContain('ID,Status,Email');
    expect(body.data).toContain('intent-123,completed,customer@example.com');
  });
});
