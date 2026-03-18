import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SubscriptionIntentError } from '@/lib/types/subscription-intent';

const mockCreateIntent = jest.fn();
const mockGetIntent = jest.fn();
const mockUpdateIntent = jest.fn();

const mockCreateOrGetCustomer = jest.fn();
const mockCreateOrUpdatePlan = jest.fn();
const mockCreateCheckoutUrl = jest.fn();

jest.mock('@/lib/services/subscription-intent-service', () => ({
  getSubscriptionIntentService: jest.fn(() => ({
    createIntent: mockCreateIntent,
    getIntent: mockGetIntent,
    updateIntent: mockUpdateIntent,
  })),
}));

jest.mock('@/lib/iugu/iugu-service', () => ({
  IuguService: jest.fn().mockImplementation(() => ({
    createOrGetCustomer: mockCreateOrGetCustomer,
    createOrUpdatePlan: mockCreateOrUpdatePlan,
    createCheckoutUrl: mockCreateCheckoutUrl,
  })),
}));

const validPlanId = '123e4567-e89b-12d3-a456-426614174000';

const buildRequest = (body: Record<string, any>, headers: Record<string, string> = {}) => {
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
  );

  return {
    json: async () => body,
    headers: {
      get: (key: string) => normalizedHeaders[key.toLowerCase()] || null,
    },
  };
};

describe('Checkout Iugu API Integration', () => {
  const getPostHandler = () => require('@/app/api/subscriptions/checkout-iugu/route').POST;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

    mockCreateIntent.mockResolvedValue({
      success: true,
      intent_id: 'intent-1',
      status_url: 'http://localhost:3000/checkout/status/intent-1',
      expires_at: '2026-12-31T00:00:00.000Z',
    });

    mockGetIntent.mockResolvedValue({
      id: 'intent-1',
      plan_id: validPlanId,
      billing_cycle: 'monthly',
      status: 'pending',
      user_email: 'test@example.com',
      user_name: 'Test User',
      organization_name: 'Test Org',
      metadata: {},
      expires_at: '2026-12-31T00:00:00.000Z',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      plan: {
        id: validPlanId,
        name: 'Pro Plan',
        monthly_price: 99.9,
        annual_price: 999.0,
        features: {},
      },
    });

    mockCreateOrGetCustomer.mockResolvedValue({ id: 'iugu-customer-1' });
    mockCreateOrUpdatePlan.mockResolvedValue({ identifier: 'pro-plan-monthly' });
    mockCreateCheckoutUrl.mockResolvedValue('https://iugu.com/checkout/intent-1');
    mockUpdateIntent.mockResolvedValue({ id: 'intent-1' });
  });

  it('creates checkout successfully with nested user_data payload', async () => {
    const request = buildRequest(
      {
        plan_id: validPlanId,
        billing_cycle: 'monthly',
        user_data: {
          name: 'Test User',
          email: 'test@example.com',
          organization_name: 'Test Org',
          cpf_cnpj: '12345678901',
          phone: '+5511999999999',
        },
        metadata: {
          source: 'integration-test',
        },
      },
      {
        'x-forwarded-for': '127.0.0.1',
        'user-agent': 'jest-checkout',
      }
    );

    const response = await getPostHandler()(request as any);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.intent_id).toBe('intent-1');
    expect(payload.checkout_url).toBe('https://iugu.com/checkout/intent-1');
    expect(payload.plan.billing_cycle).toBe('monthly');

    expect(mockCreateIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        plan_id: validPlanId,
        billing_cycle: 'monthly',
        user_email: 'test@example.com',
        user_name: 'Test User',
        organization_name: 'Test Org',
        metadata: expect.objectContaining({
          source: 'integration-test',
          request_ip: '127.0.0.1',
          user_agent: 'jest-checkout',
          created_via: 'checkout_api',
        }),
      })
    );

    expect(mockCreateOrGetCustomer).toHaveBeenCalledWith(
      'intent-1',
      'test@example.com',
      'Test User',
      expect.objectContaining({ organization_name: 'Test Org' })
    );

    expect(mockCreateOrUpdatePlan).toHaveBeenCalledWith(
      validPlanId,
      'Pro Plan',
      9990,
      'monthly'
    );

    expect(mockUpdateIntent).toHaveBeenCalledWith(
      'intent-1',
      expect.objectContaining({
        iugu_customer_id: 'iugu-customer-1',
        checkout_url: 'https://iugu.com/checkout/intent-1',
      }),
      expect.objectContaining({
        reason: 'Checkout URL created successfully',
        triggeredBy: 'checkout_api',
      })
    );
  });

  it('returns 400 with validation details for invalid payload schema', async () => {
    const request = buildRequest({
      plan_id: 'not-a-uuid',
      billing_cycle: 'weekly',
      user_data: {
        name: '',
        email: 'invalid-email',
        organization_name: '',
      },
    });

    const response = await getPostHandler()(request as any);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error).toBe('Dados de entrada inválidos');
    expect(Array.isArray(payload.details)).toBe(true);
    expect(payload.details.length).toBeGreaterThan(0);
  });

  it('returns 400 when required normalized fields are missing', async () => {
    const request = buildRequest({
      plan_id: validPlanId,
      billing_cycle: 'monthly',
    });

    const response = await getPostHandler()(request as any);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error).toBe('Dados obrigatórios faltando');
    expect(payload.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'email' }),
        expect.objectContaining({ field: 'name' }),
        expect.objectContaining({ field: 'organization_name' }),
      ])
    );
  });

  it('returns 400 when subscription intent service raises INVALID_PLAN', async () => {
    mockCreateIntent.mockRejectedValueOnce(
      new SubscriptionIntentError('Invalid or inactive subscription plan', 'INVALID_PLAN')
    );

    const request = buildRequest({
      plan_id: validPlanId,
      billing_cycle: 'monthly',
      user_data: {
        name: 'Test User',
        email: 'test@example.com',
        organization_name: 'Test Org',
      },
    });

    const response = await getPostHandler()(request as any);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error).toBe('Erro no processamento da assinatura');
    expect(payload.code).toBe('INVALID_PLAN');
  });

  it('returns 502 for Iugu gateway errors', async () => {
    mockCreateOrGetCustomer.mockRejectedValueOnce(new Error('Iugu gateway timeout'));

    const request = buildRequest({
      plan_id: validPlanId,
      billing_cycle: 'monthly',
      user_data: {
        name: 'Test User',
        email: 'test@example.com',
        organization_name: 'Test Org',
      },
    });

    const response = await getPostHandler()(request as any);
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload.success).toBe(false);
    expect(payload.code).toBe('PAYMENT_GATEWAY_ERROR');
  });

  it('returns 500 for unexpected internal errors', async () => {
    mockCreateIntent.mockRejectedValueOnce(new Error('Unexpected internal failure'));

    const request = buildRequest({
      plan_id: validPlanId,
      billing_cycle: 'monthly',
      user_data: {
        name: 'Test User',
        email: 'test@example.com',
        organization_name: 'Test Org',
      },
    });

    const response = await getPostHandler()(request as any);
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.success).toBe(false);
    expect(payload.error).toBe('Falha ao criar sessão de checkout');
    expect(payload.code).toBe('INTERNAL_ERROR');
    expect(payload.details).toBe('Unexpected internal failure');
  });
});
