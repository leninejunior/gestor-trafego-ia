import { NextRequest } from 'next/server';
import { SubscriptionIntentNotFoundError } from '@/lib/types/subscription-intent';

const mockIuguService = {
  createOrGetCustomer: jest.fn(),
  createOrUpdatePlan: jest.fn(),
  createCheckoutUrl: jest.fn(),
  getCustomer: jest.fn(),
};

const mockSubscriptionIntentService = {
  createIntent: jest.fn(),
  getIntent: jest.fn(),
  updateIntent: jest.fn(),
  executeStateTransition: jest.fn(),
  getTransitionHistory: jest.fn(),
  getNextStates: jest.fn(),
  isFinalState: jest.fn(),
};

jest.mock('@/lib/iugu/iugu-service', () => ({
  IuguService: jest.fn(() => mockIuguService),
}));

jest.mock('@/lib/services/subscription-intent-service', () => ({
  getSubscriptionIntentService: () => mockSubscriptionIntentService,
}));

const planId = '10000000-0000-4000-8000-000000000001';
const intentId = '20000000-0000-4000-8000-000000000002';

function buildIntent(overrides: Record<string, any> = {}) {
  return {
    id: intentId,
    plan_id: planId,
    billing_cycle: 'monthly',
    user_email: 'cliente@exemplo.com',
    user_name: 'Cliente Teste',
    organization_name: 'Empresa Teste',
    cpf_cnpj: '12345678901',
    phone: '11999999999',
    iugu_customer_id: 'iugu-customer-1',
    iugu_subscription_id: null,
    checkout_url: 'https://iugu.com/checkout/original',
    user_id: null,
    metadata: {},
    status: 'pending',
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    completed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    plan: {
      id: planId,
      name: 'Plano Pro',
      description: 'Plano principal',
      monthly_price: 99.9,
      annual_price: 959.2,
      features: {},
    },
    ...overrides,
  };
}

describe('Integração Iugu - Clientes e Assinaturas', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockSubscriptionIntentService.createIntent.mockResolvedValue({
      success: true,
      intent_id: intentId,
      status_url: `http://localhost:3000/checkout/status/${intentId}`,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    mockSubscriptionIntentService.getIntent.mockResolvedValue(buildIntent());
    mockSubscriptionIntentService.updateIntent.mockResolvedValue(buildIntent());
    mockSubscriptionIntentService.executeStateTransition.mockResolvedValue(buildIntent());
    mockSubscriptionIntentService.getTransitionHistory.mockResolvedValue([]);
    mockSubscriptionIntentService.getNextStates.mockReturnValue(['processing', 'expired']);
    mockSubscriptionIntentService.isFinalState.mockReturnValue(false);

    mockIuguService.createOrGetCustomer.mockResolvedValue({ id: 'iugu-customer-1' });
    mockIuguService.createOrUpdatePlan.mockResolvedValue({ identifier: 'iugu-plan-pro-monthly' });
    mockIuguService.createCheckoutUrl.mockResolvedValue('https://iugu.com/checkout/new');
    mockIuguService.getCustomer.mockResolvedValue({ id: 'iugu-customer-1' });
  });

  describe('Checkout Iugu', () => {
    it('cria checkout com dados válidos', async () => {
      const { POST } = await import('@/app/api/subscriptions/checkout-iugu/route');

      const request = new NextRequest('http://localhost:3000/api/subscriptions/checkout-iugu', {
        method: 'POST',
        body: JSON.stringify({
          plan_id: planId,
          billing_cycle: 'monthly',
          user_data: {
            name: 'Cliente Teste',
            email: 'cliente@exemplo.com',
            organization_name: 'Empresa Teste',
            cpf_cnpj: '12345678901',
            phone: '+5511999999999',
          },
        }),
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.intent_id).toBe(intentId);
      expect(body.checkout_url).toBe('https://iugu.com/checkout/new');
      expect(mockSubscriptionIntentService.createIntent).toHaveBeenCalled();
      expect(mockIuguService.createOrGetCustomer).toHaveBeenCalled();
      expect(mockIuguService.createOrUpdatePlan).toHaveBeenCalled();
      expect(mockIuguService.createCheckoutUrl).toHaveBeenCalled();
    });

    it('retorna 400 quando payload é inválido', async () => {
      const { POST } = await import('@/app/api/subscriptions/checkout-iugu/route');

      const request = new NextRequest('http://localhost:3000/api/subscriptions/checkout-iugu', {
        method: 'POST',
        body: JSON.stringify({
          plan_id: 'plan-123',
          billing_cycle: 'monthly',
          user_data: {
            name: 'X',
            email: 'invalido',
          },
        }),
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('Dados de entrada inválidos');
      expect(body.details).toBeDefined();
    });
  });

  describe('Recovery Cancel', () => {
    it('cancela intent pendente com sucesso', async () => {
      const { POST } = await import('@/app/api/subscriptions/recovery/cancel/route');
      mockSubscriptionIntentService.getIntent.mockResolvedValue(buildIntent({ status: 'pending' }));

      const request = new NextRequest('http://localhost:3000/api/subscriptions/recovery/cancel', {
        method: 'POST',
        body: JSON.stringify({
          intent_id: intentId,
          reason: 'Solicitação do cliente',
        }),
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.status).toBe('expired');
      expect(mockSubscriptionIntentService.executeStateTransition).toHaveBeenCalledWith(
        intentId,
        'expired',
        expect.objectContaining({
          reason: expect.stringContaining('Canceled'),
        })
      );
    });

    it('rejeita cancelamento para intent completed', async () => {
      const { POST } = await import('@/app/api/subscriptions/recovery/cancel/route');
      mockSubscriptionIntentService.getIntent.mockResolvedValue(buildIntent({ status: 'completed' }));

      const request = new NextRequest('http://localhost:3000/api/subscriptions/recovery/cancel', {
        method: 'POST',
        body: JSON.stringify({
          intent_id: intentId,
          reason: 'Solicitação do cliente',
        }),
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('Assinatura já foi completada');
    });
  });

  describe('Recovery Regenerate', () => {
    it('gera novo checkout para intent failed', async () => {
      const { POST } = await import('@/app/api/subscriptions/recovery/regenerate/route');
      mockSubscriptionIntentService.getIntent.mockResolvedValue(buildIntent({ status: 'failed' }));

      const request = new NextRequest('http://localhost:3000/api/subscriptions/recovery/regenerate', {
        method: 'POST',
        body: JSON.stringify({
          intent_id: intentId,
          reason: 'Nova tentativa',
        }),
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.intent_id).toBe(intentId);
      expect(body.checkout_url).toBe('https://iugu.com/checkout/new');
      expect(mockSubscriptionIntentService.executeStateTransition).toHaveBeenCalledWith(
        intentId,
        'pending',
        expect.any(Object)
      );
      expect(mockSubscriptionIntentService.updateIntent).toHaveBeenCalled();
    });

    it('rejeita regeneração para intent completed', async () => {
      const { POST } = await import('@/app/api/subscriptions/recovery/regenerate/route');
      mockSubscriptionIntentService.getIntent.mockResolvedValue(buildIntent({ status: 'completed' }));

      const request = new NextRequest('http://localhost:3000/api/subscriptions/recovery/regenerate', {
        method: 'POST',
        body: JSON.stringify({
          intent_id: intentId,
        }),
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('Assinatura já foi completada');
    });
  });

  describe('Status Endpoint', () => {
    it('retorna status detalhado da intent', async () => {
      const { GET } = await import('@/app/api/subscriptions/status/[intentId]/route');
      mockSubscriptionIntentService.getIntent.mockResolvedValue(buildIntent({ status: 'pending' }));
      mockSubscriptionIntentService.getTransitionHistory.mockResolvedValue([
        { from_status: 'pending', to_status: 'processing' },
      ]);

      const request = new NextRequest('http://localhost:3000/api/subscriptions/status/' + intentId);
      const response = await GET(request as any, {
        params: Promise.resolve({ intentId }),
      } as any);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.intent_id).toBe(intentId);
      expect(body.status).toBe('pending');
      expect(body.actions.next_possible_states).toEqual(['processing', 'expired']);
    });

    it('retorna 404 quando intent não existe', async () => {
      const { GET } = await import('@/app/api/subscriptions/status/[intentId]/route');
      mockSubscriptionIntentService.getIntent.mockRejectedValue(
        new SubscriptionIntentNotFoundError(intentId)
      );

      const request = new NextRequest('http://localhost:3000/api/subscriptions/status/' + intentId);
      const response = await GET(request as any, {
        params: Promise.resolve({ intentId }),
      } as any);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toBe('Intenção de assinatura não encontrada');
    });
  });
});
