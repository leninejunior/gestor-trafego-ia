/**
 * Integration tests for subscription intent checkout flow
 * Contract-aligned with the current SubscriptionIntentService implementation.
 */

import { createClient } from '@supabase/supabase-js';
import { SubscriptionIntentService } from '@/lib/services/subscription-intent-service';
import {
  CreateSubscriptionIntentRequest,
  SubscriptionIntentStatus,
} from '@/lib/types/subscription-intent';

jest.mock('@supabase/supabase-js');

type DbRow = Record<string, any>;

describe('Checkout Flow Integration', () => {
  const testPlan = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Pro Plan',
    description: 'Professional plan with advanced features',
    monthly_price: 99.9,
    annual_price: 999.9,
    is_active: true,
    features: {
      max_clients: 50,
    },
  };

  const validIntentRequest: CreateSubscriptionIntentRequest = {
    plan_id: testPlan.id,
    billing_cycle: 'monthly',
    user_email: 'Test@Example.com',
    user_name: 'Test User',
    organization_name: 'Test Organization',
    cpf_cnpj: '123.456.789-01',
    phone: '+55 (11) 99999-9999',
    metadata: {
      source: 'integration_test',
    },
  };

  let plans: DbRow[];
  let intents: DbRow[];
  let mockSupabase: {
    from: jest.Mock;
    rpc: jest.Mock;
  };
  let service: SubscriptionIntentService;
  let executeTransitionMock: jest.Mock;

  const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

  const getRows = (table: string): DbRow[] => {
    if (table === 'subscription_plans') return plans;
    if (table === 'subscription_intents') return intents;
    return [];
  };

  const withPlan = (row: DbRow, table: string): DbRow => {
    if (table !== 'subscription_intents') {
      return clone(row);
    }

    return {
      ...clone(row),
      plan: plans.find((plan) => plan.id === row.plan_id) || null,
    };
  };

  const makeQuery = (table: string) => {
    const state: {
      filters: Array<(row: DbRow) => boolean>;
      orderBy: string | null;
      ascending: boolean;
      rangeStart: number | null;
      rangeEnd: number | null;
      updateData: DbRow | null;
    } = {
      filters: [],
      orderBy: null,
      ascending: true,
      rangeStart: null,
      rangeEnd: null,
      updateData: null,
    };

    const applyFilters = (rows: DbRow[]): DbRow[] => {
      return rows.filter((row) => state.filters.every((filter) => filter(row)));
    };

    const applySortAndRange = (rows: DbRow[]): DbRow[] => {
      let result = [...rows];

      if (state.orderBy) {
        const field = state.orderBy;
        result.sort((a, b) => {
          const first = a[field];
          const second = b[field];

          if (first === second) return 0;
          if (first == null) return state.ascending ? -1 : 1;
          if (second == null) return state.ascending ? 1 : -1;

          if (first > second) return state.ascending ? 1 : -1;
          return state.ascending ? -1 : 1;
        });
      }

      if (state.rangeStart != null && state.rangeEnd != null) {
        result = result.slice(state.rangeStart, state.rangeEnd + 1);
      }

      return result;
    };

    const execute = () => {
      if (state.updateData) {
        const matches = applyFilters(getRows(table));
        matches.forEach((row) => {
          Object.assign(row, state.updateData);
        });

        return {
          data: matches.map((row) => withPlan(row, table)),
          error: null,
          count: null,
        };
      }

      const filtered = applyFilters(getRows(table));
      const count = filtered.length;
      const selected = applySortAndRange(filtered);

      return {
        data: selected.map((row) => withPlan(row, table)),
        error: null,
        count,
      };
    };

    const query: any = {
      select: jest.fn(() => query),
      eq: jest.fn((field: string, value: any) => {
        state.filters.push((row) => row[field] === value);
        return query;
      }),
      in: jest.fn((field: string, values: any[]) => {
        state.filters.push((row) => values.includes(row[field]));
        return query;
      }),
      ilike: jest.fn((field: string, pattern: string) => {
        const needle = pattern.replace(/%/g, '').toLowerCase();
        state.filters.push((row) => String(row[field] || '').toLowerCase().includes(needle));
        return query;
      }),
      gte: jest.fn((field: string, value: any) => {
        state.filters.push((row) => String(row[field] || '') >= String(value));
        return query;
      }),
      lte: jest.fn((field: string, value: any) => {
        state.filters.push((row) => String(row[field] || '') <= String(value));
        return query;
      }),
      order: jest.fn((field: string, options?: { ascending?: boolean }) => {
        state.orderBy = field;
        state.ascending = options?.ascending !== false;
        return query;
      }),
      range: jest.fn((start: number, end: number) => {
        state.rangeStart = start;
        state.rangeEnd = end;
        return query;
      }),
      update: jest.fn((updateData: DbRow) => {
        state.updateData = updateData;
        return query;
      }),
      insert: jest.fn(async (payload: DbRow) => ({
        data: payload,
        error: null,
      })),
      single: jest.fn(async () => {
        const { data, error } = execute();

        if (error) {
          return { data: null, error };
        }

        if (!data || data.length === 0) {
          return { data: null, error: { message: 'Not found' } };
        }

        return { data: data[0], error: null };
      }),
      then: (resolve: any, reject: any) => Promise.resolve(execute()).then(resolve, reject),
    };

    return query;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

    plans = [clone(testPlan)];
    intents = [
      {
        id: 'intent-seeded',
        plan_id: testPlan.id,
        billing_cycle: 'monthly',
        status: 'pending',
        user_email: 'cached@example.com',
        user_name: 'Cached User',
        organization_name: 'Cached Org',
        cpf_cnpj: '12345678901',
        phone: '5511999999999',
        metadata: {},
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        completed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        iugu_customer_id: null,
        iugu_subscription_id: null,
        stripe_customer_id: null,
        stripe_session_id: null,
        stripe_subscription_id: null,
        checkout_url: null,
        user_id: null,
      },
    ];

    mockSupabase = {
      from: jest.fn((table: string) => makeQuery(table)),
      rpc: jest.fn(async (fn: string, params: any) => {
        if (fn === 'create_subscription_intent') {
          const now = new Date().toISOString();
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
          const id = `intent-${intents.length + 1}`;

          intents.push({
            id,
            plan_id: params.plan_id_param,
            billing_cycle: params.billing_cycle_param,
            status: 'pending',
            user_email: params.user_email_param,
            user_name: params.user_name_param,
            organization_name: params.organization_name_param,
            cpf_cnpj: params.cpf_cnpj_param,
            phone: params.phone_param,
            metadata: params.metadata_param || {},
            expires_at: expiresAt,
            completed_at: null,
            created_at: now,
            updated_at: now,
            iugu_customer_id: null,
            iugu_subscription_id: null,
            stripe_customer_id: null,
            stripe_session_id: null,
            stripe_subscription_id: null,
            checkout_url: null,
            user_id: null,
          });

          return { data: id, error: null };
        }

        if (fn === 'update_subscription_intent_status') {
          const intent = intents.find((item) => item.id === params.intent_id_param);
          if (!intent) {
            return { data: null, error: { message: 'Intent not found' } };
          }

          intent.status = params.new_status_param;
          intent.updated_at = new Date().toISOString();

          if (params.iugu_customer_id_param !== undefined && params.iugu_customer_id_param !== null) {
            intent.iugu_customer_id = params.iugu_customer_id_param;
          }
          if (params.iugu_subscription_id_param !== undefined && params.iugu_subscription_id_param !== null) {
            intent.iugu_subscription_id = params.iugu_subscription_id_param;
          }
          if (params.user_id_param !== undefined && params.user_id_param !== null) {
            intent.user_id = params.user_id_param;
          }
          if (params.metadata_update_param) {
            intent.metadata = {
              ...(intent.metadata || {}),
              ...params.metadata_update_param,
            };
          }
          if (params.new_status_param === 'completed') {
            intent.completed_at = new Date().toISOString();
          }

          return { data: null, error: null };
        }

        if (fn === 'get_subscription_intent_by_identifier') {
          const matches = intents.filter((intent) => {
            const sameEmail = intent.user_email === params.email_param;
            const sameCpf = params.cpf_param ? intent.cpf_cnpj === params.cpf_param : true;
            return sameEmail && sameCpf;
          });

          if (matches.length === 0) {
            return { data: [], error: null };
          }

          return { data: [{ id: matches[0].id }], error: null };
        }

        return { data: null, error: null };
      }),
    };

    (createClient as jest.Mock).mockReturnValue(mockSupabase);

    service = new SubscriptionIntentService(
      'https://test.supabase.co',
      'test-service-role-key'
    );

    executeTransitionMock = jest.fn(async () => true);

    (service as any).stateMachine = {
      createTransitionContext: (
        intentId: string,
        fromStatus: SubscriptionIntentStatus,
        toStatus: SubscriptionIntentStatus,
        options: {
          reason?: string;
          metadata?: Record<string, any>;
          triggeredBy?: string;
        } = {}
      ) => ({
        intentId,
        fromStatus,
        toStatus,
        reason: options.reason,
        metadata: options.metadata,
        triggeredBy: options.triggeredBy,
        timestamp: new Date().toISOString(),
      }),
      executeTransition: executeTransitionMock,
      isValidTransition: (from: SubscriptionIntentStatus, to: SubscriptionIntentStatus) => {
        const transitions: Record<SubscriptionIntentStatus, SubscriptionIntentStatus[]> = {
          pending: ['processing', 'failed', 'expired'],
          processing: ['completed', 'failed', 'expired'],
          completed: [],
          failed: ['pending', 'expired'],
          expired: [],
        };

        return (transitions[from] || []).includes(to);
      },
      getNextStates: jest.fn(),
      isFinalState: jest.fn(),
      getTransitionHistory: jest.fn(),
    };
  });

  it('creates subscription intent and sanitizes payload sent to rpc', async () => {
    const result = await service.createIntent(validIntentRequest);

    expect(result.success).toBe(true);
    expect(result.intent_id).toBe('intent-2');
    expect(result.status_url).toBe('http://localhost:3000/checkout/status/intent-2');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('create_subscription_intent', {
      plan_id_param: validIntentRequest.plan_id,
      billing_cycle_param: validIntentRequest.billing_cycle,
      user_email_param: 'test@example.com',
      user_name_param: 'Test User',
      organization_name_param: 'Test Organization',
      cpf_cnpj_param: '12345678901',
      phone_param: '5511999999999',
      metadata_param: { source: 'integration_test' },
    });
  });

  it('rejects creation when plan is invalid or inactive', async () => {
    plans = [];

    await expect(service.createIntent(validIntentRequest)).rejects.toThrow(
      'Invalid or inactive subscription plan'
    );
  });

  it('gets intent with plan and returns cached state on repeated read', async () => {
    const firstRead = await service.getIntent('intent-seeded');
    expect(firstRead.status).toBe('pending');
    expect(firstRead.plan.name).toBe('Pro Plan');

    intents[0].status = 'processing';

    const secondRead = await service.getIntent('intent-seeded');
    expect(secondRead.status).toBe('pending');

    const readsFromSubscriptionIntents = mockSupabase.from.mock.calls.filter(
      ([table]) => table === 'subscription_intents'
    ).length;
    expect(readsFromSubscriptionIntents).toBe(1);
  });

  it('updates status through state machine and persists transition fields', async () => {
    const updated = await service.updateIntent('intent-seeded', {
      status: 'processing',
      iugu_customer_id: 'iugu-customer-123',
      metadata: { iugu_customer_id: 'iugu-customer-123' },
    });

    expect(executeTransitionMock).toHaveBeenCalledTimes(1);
    expect(updated.status).toBe('processing');
    expect(updated.iugu_customer_id).toBe('iugu-customer-123');
  });

  it('updates non-status fields directly in subscription_intents table', async () => {
    const updated = await service.updateIntent('intent-seeded', {
      checkout_url: 'https://iugu.com/checkout/intent-seeded',
      metadata: { source: 'manual_update' },
    });

    expect(updated.checkout_url).toBe('https://iugu.com/checkout/intent-seeded');
    expect(updated.metadata).toMatchObject({ source: 'manual_update' });
  });

  it('searches intents by email and status filters', async () => {
    intents.push(
      {
        ...clone(intents[0]),
        id: 'intent-email-1',
        user_email: 'search@example.com',
        status: 'pending',
      },
      {
        ...clone(intents[0]),
        id: 'intent-email-2',
        user_email: 'search@example.com',
        status: 'completed',
      }
    );

    const byEmail = await service.searchIntents({
      filters: { user_email: 'search@example.com' },
      pagination: { page: 1, limit: 10 },
    });

    expect(byEmail.total).toBe(2);
    expect(byEmail.intents).toHaveLength(2);

    const byStatus = await service.searchIntents({
      filters: { status: ['pending'] },
      pagination: { page: 1, limit: 10 },
    });

    expect(byStatus.intents.every((item) => item.status === 'pending')).toBe(true);
  });

  it('gets intent by identifier and returns null when not found', async () => {
    intents.push({
      ...clone(intents[0]),
      id: 'intent-identifier',
      user_email: 'identifier@example.com',
      cpf_cnpj: '12345678901',
    });

    const found = await service.getIntentByIdentifier('identifier@example.com', '12345678901');
    expect(found?.id).toBe('intent-identifier');

    const notFound = await service.getIntentByIdentifier('missing@example.com', '00000000000');
    expect(notFound).toBeNull();
  });

  it('exposes valid and invalid state transitions', () => {
    expect(service.isValidStateTransition('pending', 'processing')).toBe(true);
    expect(service.isValidStateTransition('completed', 'pending')).toBe(false);
  });
});
