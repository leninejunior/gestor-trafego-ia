import { describe, it, expect, beforeEach, jest } from '@jest/globals';

type StripeSubscriptionStub = {
  id: string;
  status: string;
  customer: string;
  metadata?: Record<string, string>;
};

type LoaderOptions = {
  stripeSignature?: string | null;
  webhookSecret?: string | null;
  constructedEvent?: Record<string, any>;
  constructEventError?: Error;
  stripeSubscriptionById?: Record<string, StripeSubscriptionStub>;
  subscriptionRowsByStripeId?: Record<string, { id: string }>;
  customerDefaultPaymentMethod?: string | null;
};

const buildRequest = (body: string): { text: () => Promise<string> } => ({
  text: async () => body,
});

const loadRoute = async (options: LoaderOptions = {}) => {
  const headerSignature =
    options.stripeSignature !== undefined ? options.stripeSignature : 'stripe-signature-123';
  const webhookSecret =
    options.webhookSecret !== undefined ? options.webhookSecret : 'whsec_test_123';

  const headersMock = jest.fn(async () => ({
    get: (name: string) => (name === 'stripe-signature' ? headerSignature : null),
  }));

  const constructWebhookEvent = jest.fn((body: string, signature: string, secret: string) => {
    if (options.constructEventError) {
      throw options.constructEventError;
    }

    return (
      options.constructedEvent ?? {
        id: 'evt_default',
        type: 'unknown.event.type',
        data: { object: {} },
      }
    );
  });

  const updateDefaultPaymentMethod = jest.fn(async () => undefined);
  class StripeServiceMock {
    constructWebhookEvent(body: string, signature: string, secret: string) {
      return constructWebhookEvent(body, signature, secret);
    }

    updateDefaultPaymentMethod(customerId: string, paymentMethodId: string) {
      return updateDefaultPaymentMethod(customerId, paymentMethodId);
    }
  }

  const updateSubscriptionStatus = jest.fn(async () => ({ id: 'sub_updated' }));
  class SubscriptionServiceMock {
    updateSubscriptionStatus(
      subscriptionId: string,
      status: string,
      metadata?: Record<string, string>
    ) {
      return updateSubscriptionStatus(subscriptionId, status, metadata);
    }
  }

  const updateIntent = jest.fn(async () => undefined);
  const getSubscriptionIntentService = jest.fn(() => ({ updateIntent }));

  const stripeSubscriptionById = {
    stripe_sub_123: {
      id: 'stripe_sub_123',
      status: 'active',
      customer: 'cus_123',
      metadata: {
        organization_id: 'org-123',
        subscription_id: 'local-sub-123',
      },
    },
    ...(options.stripeSubscriptionById ?? {}),
  };

  const stripeCustomerRetrieve = jest.fn(async () => ({
    deleted: false,
    invoice_settings: {
      default_payment_method: options.customerDefaultPaymentMethod ?? null,
    },
  }));

  const stripeSubscriptionRetrieve = jest.fn(async (subscriptionId: string) => {
    return stripeSubscriptionById[subscriptionId] ?? stripeSubscriptionById.stripe_sub_123;
  });

  const getStripe = jest.fn(() => ({
    subscriptions: {
      retrieve: stripeSubscriptionRetrieve,
    },
    customers: {
      retrieve: stripeCustomerRetrieve,
    },
  }));

  const subscriptionRowsByStripeId = {
    stripe_sub_123: { id: 'local-sub-123' },
    ...(options.subscriptionRowsByStripeId ?? {}),
  };
  const invoiceInserts: Record<string, any>[] = [];
  const subscriptionUpdates: Record<string, any>[] = [];

  const from = jest.fn((table: string) => {
    if (table === 'subscriptions') {
      return {
        select: jest.fn(() => ({
          eq: jest.fn((column: string, value: string) => ({
            single: jest.fn(async () => {
              if (column !== 'stripe_subscription_id') {
                return { data: null, error: { message: `Unexpected filter: ${column}` } };
              }
              const row = subscriptionRowsByStripeId[value];
              if (!row) {
                return { data: null, error: { message: 'Subscription not found' } };
              }
              return { data: row, error: null };
            }),
          })),
        })),
        update: jest.fn((payload: Record<string, any>) => {
          subscriptionUpdates.push(payload);
          return {
            eq: jest.fn(() => ({
              eq: jest.fn(async () => ({ data: null, error: null })),
            })),
          };
        }),
      };
    }

    if (table === 'subscription_invoices') {
      return {
        insert: jest.fn(async (payload: Record<string, any>) => {
          invoiceInserts.push(payload);
          return { data: payload, error: null };
        }),
      };
    }

    return {
      insert: jest.fn(async () => ({ data: null, error: null })),
    };
  });

  const createClient = jest.fn(async () => ({ from }));

  jest.resetModules();
  jest.doMock('next/headers', () => ({
    headers: headersMock,
  }));
  jest.doMock('@/lib/stripe/config', () => ({
    getStripe,
    STRIPE_WEBHOOK_SECRET: webhookSecret,
  }));
  jest.doMock('@/lib/stripe/stripe-service', () => ({
    StripeService: StripeServiceMock,
  }));
  jest.doMock('@/lib/services/subscription-service', () => ({
    SubscriptionService: SubscriptionServiceMock,
  }));
  jest.doMock('@/lib/services/subscription-intent-service', () => ({
    getSubscriptionIntentService,
  }));
  jest.doMock('@/lib/supabase/server', () => ({
    createClient,
  }));

  const route = await import('@/app/api/webhooks/stripe/route');

  return {
    POST: route.POST,
    mocks: {
      headersMock,
      constructWebhookEvent,
      getStripe,
      stripeSubscriptionRetrieve,
      stripeCustomerRetrieve,
      updateIntent,
      updateSubscriptionStatus,
      updateDefaultPaymentMethod,
      createClient,
      from,
      invoiceInserts,
      subscriptionUpdates,
    },
  };
};

describe('Stripe Webhook Route Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('returns 400 when stripe signature is missing', async () => {
    const { POST } = await loadRoute({ stripeSignature: null });

    const response = await POST(buildRequest('{}') as any);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Missing signature or webhook secret');
  });

  it('returns 400 when webhook secret is missing', async () => {
    const { POST } = await loadRoute({ webhookSecret: null });

    const response = await POST(buildRequest('{}') as any);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Missing signature or webhook secret');
  });

  it('returns 400 when signature verification fails', async () => {
    const { POST, mocks } = await loadRoute({
      constructEventError: new Error('Invalid signature'),
    });

    const response = await POST(buildRequest('{"type":"invoice.payment_failed"}') as any);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid signature');
    expect(mocks.constructWebhookEvent).toHaveBeenCalledTimes(1);
  });

  it('returns 200 for unknown events without side effects', async () => {
    const { POST, mocks } = await loadRoute({
      constructedEvent: {
        id: 'evt_unknown',
        type: 'unknown.event.type',
        data: { object: {} },
      },
    });

    const payload = '{"id":"evt_unknown","type":"unknown.event.type"}';
    const response = await POST(buildRequest(payload) as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.received).toBe(true);
    expect(mocks.constructWebhookEvent).toHaveBeenCalledWith(
      payload,
      'stripe-signature-123',
      'whsec_test_123'
    );
    expect(mocks.updateSubscriptionStatus).not.toHaveBeenCalled();
  });

  it('processes checkout.session.completed through subscription intent flow', async () => {
    const event = {
      id: 'evt_checkout_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_123',
          subscription: 'stripe_sub_123',
          payment_status: 'paid',
          metadata: {
            intent_id: 'intent-123',
            organization_id: 'org-123',
            plan_id: 'plan-123',
            billing_cycle: 'monthly',
          },
        },
      },
    };
    const { POST, mocks } = await loadRoute({ constructedEvent: event });

    const response = await POST(buildRequest(JSON.stringify(event)) as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.received).toBe(true);
    expect(mocks.stripeSubscriptionRetrieve).toHaveBeenCalledWith('stripe_sub_123');
    expect(mocks.updateIntent).toHaveBeenCalledWith(
      'intent-123',
      expect.objectContaining({
        status: 'completed',
        stripe_subscription_id: 'stripe_sub_123',
        metadata: expect.objectContaining({
          stripe_session_id: 'cs_test_123',
          stripe_subscription_status: 'active',
          payment_status: 'paid',
          completed_at: expect.any(String),
        }),
      }),
      expect.objectContaining({
        reason: 'Stripe checkout session completed',
        triggeredBy: 'stripe_webhook',
      })
    );
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('updates local subscription status on customer.subscription.updated', async () => {
    const event = {
      id: 'evt_sub_updated_1',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'stripe_sub_123',
          status: 'past_due',
          metadata: {
            organization_id: 'org-123',
          },
        },
      },
    };
    const { POST, mocks } = await loadRoute({ constructedEvent: event });

    const response = await POST(buildRequest(JSON.stringify(event)) as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.received).toBe(true);
    expect(mocks.updateSubscriptionStatus).toHaveBeenCalledWith(
      'local-sub-123',
      'past_due',
      undefined
    );
  });

  it('stores failed invoice and sets subscription to past_due', async () => {
    const event = {
      id: 'evt_invoice_failed_1',
      type: 'invoice.payment_failed',
      data: {
        object: {
          id: 'in_failed_123',
          subscription: 'stripe_sub_123',
          amount_due: 2599,
          currency: 'usd',
          due_date: 1735660800,
          lines: {
            data: [
              {
                id: 'line_123',
                description: 'Monthly Plan',
                quantity: 1,
                amount: 2599,
              },
            ],
          },
        },
      },
    };
    const { POST, mocks } = await loadRoute({ constructedEvent: event });

    const response = await POST(buildRequest(JSON.stringify(event)) as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.received).toBe(true);
    expect(mocks.updateSubscriptionStatus).toHaveBeenCalledWith(
      'local-sub-123',
      'past_due',
      undefined
    );
    expect(mocks.invoiceInserts).toHaveLength(1);
    expect(mocks.invoiceInserts[0]).toEqual(
      expect.objectContaining({
        subscription_id: 'local-sub-123',
        amount: 25.99,
        status: 'uncollectible',
        stripe_invoice_id: 'in_failed_123',
      })
    );
  });

  it('sets default payment method when customer has none', async () => {
    const event = {
      id: 'evt_pm_attached_1',
      type: 'payment_method.attached',
      data: {
        object: {
          id: 'pm_123',
          customer: 'cus_123',
        },
      },
    };
    const { POST, mocks } = await loadRoute({
      constructedEvent: event,
      customerDefaultPaymentMethod: null,
    });

    const response = await POST(buildRequest(JSON.stringify(event)) as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.received).toBe(true);
    expect(mocks.stripeCustomerRetrieve).toHaveBeenCalledWith('cus_123');
    expect(mocks.updateDefaultPaymentMethod).toHaveBeenCalledWith('cus_123', 'pm_123');
  });
});
