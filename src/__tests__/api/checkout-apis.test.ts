/**
 * Comprehensive API tests for Checkout APIs
 * Tests all checkout-related endpoints including validation, error handling, and integration scenarios
 * Requirements: 1.1, 1.2, 5.3
 */

import { NextRequest } from 'next/server';
import { POST as checkoutPost } from '@/app/api/subscriptions/checkout-iugu/route';
import { GET as statusGet } from '@/app/api/subscriptions/status/[intentId]/route';
import { POST as publicStatusPost, GET as publicStatusGet } from '@/app/api/subscriptions/status/public/route';
import { POST as regeneratePost } from '@/app/api/subscriptions/recovery/regenerate/route';
import { POST as resendEmailPost } from '@/app/api/subscriptions/recovery/resend-email/route';
import { POST as cancelPost } from '@/app/api/subscriptions/recovery/cancel/route';

// Mock dependencies
jest.mock('@/lib/services/subscription-intent-service');
jest.mock('@/lib/iugu/iugu-service');

const mockSubscriptionIntentService = {
  createIntent: jest.fn(),
  getIntent: jest.fn(),
  updateIntent: jest.fn(),
  getIntentByIdentifier: jest.fn(),
  getTransitionHistory: jest.fn(),
  getNextStates: jest.fn(),
  isFinalState: jest.fn(),
  executeStateTransition: jest.fn(),
};

const mockIuguService = {
  createOrGetCustomer: jest.fn(),
  createOrUpdatePlan: jest.fn(),
  createCheckoutUrl: jest.fn(),
  getCustomer: jest.fn(),
};

// Mock the service factory functions
jest.mock('@/lib/services/subscription-intent-service', () => ({
  getSubscriptionIntentService: () => mockSubscriptionIntentService,
}));

jest.mock('@/lib/iugu/iugu-service', () => ({
  IuguService: jest.fn(() => mockIuguService),
}));

// Test data
const validCheckoutData = {
  plan_id: '123e4567-e89b-12d3-a456-426614174000',
  billing_cycle: 'monthly' as const,
  user_email: 'test@example.com',
  user_name: 'Test User',
  organization_name: 'Test Organization',
  cpf_cnpj: '12345678901',
  phone: '+5511999999999',
};

const mockIntent = {
  id: 'intent-123',
  plan_id: validCheckoutData.plan_id,
  billing_cycle: validCheckoutData.billing_cycle,
  status: 'pending' as const,
  user_email: validCheckoutData.user_email,
  user_name: validCheckoutData.user_name,
  organization_name: validCheckoutData.organization_name,
  cpf_cnpj: validCheckoutData.cpf_cnpj,
  phone: validCheckoutData.phone,
  iugu_customer_id: 'iugu-customer-123',
  iugu_subscription_id: null,
  checkout_url: 'https://iugu.com/checkout/123',
  user_id: null,
  metadata: {},
  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  completed_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  plan: {
    id: validCheckoutData.plan_id,
    name: 'Test Plan',
    description: 'Test plan description',
    monthly_price: 99.99,
    annual_price: 999.99,
    features: {},
  },
};

const mockCustomer = {
  id: 'iugu-customer-123',
  email: validCheckoutData.user_email,
  name: validCheckoutData.user_name,
};

const mockPlan = {
  identifier: 'test-plan-monthly',
  name: 'Test Plan',
};

describe('Checkout APIs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    mockSubscriptionIntentService.createIntent.mockResolvedValue({
      success: true,
      intent_id: 'intent-123',
      status_url: 'http://localhost:3000/checkout/status/intent-123',
      expires_at: mockIntent.expires_at,
    });
    
    mockSubscriptionIntentService.getIntent.mockResolvedValue(mockIntent);
    mockIuguService.createOrGetCustomer.mockResolvedValue(mockCustomer);
    mockIuguService.createOrUpdatePlan.mockResolvedValue(mockPlan);
    mockIuguService.createCheckoutUrl.mockResolvedValue('https://iugu.com/checkout/123');
  });

  describe('POST /api/subscriptions/checkout-iugu', () => {
    it('should create checkout successfully with valid data', async () => {
      const request = new NextRequest('http://localhost:3000/api/subscriptions/checkout-iugu', {
        method: 'POST',
        body: JSON.stringify(validCheckoutData),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await checkoutPost(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.intent_id).toBe('intent-123');
      expect(data.checkout_url).toBe('https://iugu.com/checkout/123');
      expect(data.status_url).toContain('/checkout/status/intent-123');
      expect(data.plan).toBeDefined();
      expect(data.customer).toBeDefined();
    });

    it('should validate required fields', async () => {
      const invalidData = { ...validCheckoutData };
      delete invalidData.user_email;

      const request = new NextRequest('http://localhost:3000/api/subscriptions/checkout-iugu', {
        method: 'POST',
        body: JSON.stringify(invalidData),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await checkoutPost(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Dados de entrada inválidos');
      expect(data.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'user_email',
            message: expect.stringContaining('Required'),
          }),
        ])
      );
    });

    it('should validate email format', async () => {
      const invalidData = { ...validCheckoutData, user_email: 'invalid-email' };

      const request = new NextRequest('http://localhost:3000/api/subscriptions/checkout-iugu', {
        method: 'POST',
        body: JSON.stringify(invalidData),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await checkoutPost(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'user_email',
            message: expect.stringContaining('formato válido'),
          }),
        ])
      );
    });

    it('should validate CPF format', async () => {
      const invalidData = { ...validCheckoutData, cpf_cnpj: '123' };

      const request = new NextRequest('http://localhost:3000/api/subscriptions/checkout-iugu', {
        method: 'POST',
        body: JSON.stringify(invalidData),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await checkoutPost(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'cpf_cnpj',
            message: expect.stringContaining('11 dígitos'),
          }),
        ])
      );
    });

    it('should handle subscription intent service errors', async () => {
      mockSubscriptionIntentService.createIntent.mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = new NextRequest('http://localhost:3000/api/subscriptions/checkout-iugu', {
        method: 'POST',
        body: JSON.stringify(validCheckoutData),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await checkoutPost(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Falha ao criar sessão de checkout');
    });

    it('should handle Iugu service errors', async () => {
      mockIuguService.createOrGetCustomer.mockRejectedValue(
        new Error('Iugu API error')
      );

      const request = new NextRequest('http://localhost:3000/api/subscriptions/checkout-iugu', {
        method: 'POST',
        body: JSON.stringify(validCheckoutData),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await checkoutPost(request);
      const data = await response.json();

      expect(response.status).toBe(502);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Erro no gateway de pagamento');
      expect(data.code).toBe('PAYMENT_GATEWAY_ERROR');
    });
  });

  describe('GET /api/subscriptions/status/[intentId]', () => {
    it('should return intent status successfully', async () => {
      mockSubscriptionIntentService.getTransitionHistory.mockResolvedValue([]);
      mockSubscriptionIntentService.getNextStates.mockReturnValue(['processing', 'expired']);
      mockSubscriptionIntentService.isFinalState.mockReturnValue(false);

      const request = new NextRequest('http://localhost:3000/api/subscriptions/status/intent-123');
      const response = await statusGet(request, { params: { intentId: 'intent-123' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.intent_id).toBe('intent-123');
      expect(data.status).toBe('pending');
      expect(data.plan).toBeDefined();
      expect(data.customer).toBeDefined();
      expect(data.timeline).toBeDefined();
      expect(data.actions).toBeDefined();
    });

    it('should handle missing intent ID', async () => {
      const request = new NextRequest('http://localhost:3000/api/subscriptions/status/');
      const response = await statusGet(request, { params: { intentId: '' } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Intent ID é obrigatório');
    });

    it('should handle intent not found', async () => {
      const { SubscriptionIntentNotFoundError } = jest.requireActual('@/lib/types/subscription-intent');
      mockSubscriptionIntentService.getIntent.mockRejectedValue(
        new SubscriptionIntentNotFoundError('intent-404')
      );

      const request = new NextRequest('http://localhost:3000/api/subscriptions/status/intent-404');
      const response = await statusGet(request, { params: { intentId: 'intent-404' } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Intenção de assinatura não encontrada');
      expect(data.code).toBe('INTENT_NOT_FOUND');
    });
  });

  describe('POST /api/subscriptions/status/public', () => {
    it('should return public status successfully', async () => {
      mockSubscriptionIntentService.getIntentByIdentifier.mockResolvedValue(mockIntent);

      const request = new NextRequest('http://localhost:3000/api/subscriptions/status/public', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          cpf_cnpj: '12345678901',
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await publicStatusPost(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.subscription).toBeDefined();
      expect(data.subscription.id).toBe('intent-123');
      expect(data.subscription.status).toBe('pending');
      expect(data.support).toBeDefined();
    });

    it('should handle subscription not found', async () => {
      mockSubscriptionIntentService.getIntentByIdentifier.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/subscriptions/status/public', {
        method: 'POST',
        body: JSON.stringify({
          email: 'notfound@example.com',
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await publicStatusPost(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Nenhuma assinatura encontrada');
      expect(data.code).toBe('NO_SUBSCRIPTION_FOUND');
    });

    it('should validate email format in public status', async () => {
      const request = new NextRequest('http://localhost:3000/api/subscriptions/status/public', {
        method: 'POST',
        body: JSON.stringify({
          email: 'invalid-email',
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await publicStatusPost(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Dados de entrada inválidos');
    });
  });

  describe('GET /api/subscriptions/status/public', () => {
    it('should return API documentation', async () => {
      const request = new NextRequest('http://localhost:3000/api/subscriptions/status/public');
      const response = await publicStatusGet();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.endpoint).toBe('/api/subscriptions/status/public');
      expect(data.method).toBe('POST');
      expect(data.description).toBeDefined();
      expect(data.required_fields).toBeDefined();
      expect(data.example_request).toBeDefined();
    });
  });

  describe('POST /api/subscriptions/recovery/regenerate', () => {
    it('should regenerate checkout successfully', async () => {
      mockSubscriptionIntentService.executeStateTransition.mockResolvedValue(mockIntent);
      mockIuguService.getCustomer.mockResolvedValue(mockCustomer);

      const request = new NextRequest('http://localhost:3000/api/subscriptions/recovery/regenerate', {
        method: 'POST',
        body: JSON.stringify({
          intent_id: 'intent-123',
          reason: 'User requested new checkout',
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await regeneratePost(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.intent_id).toBe('intent-123');
      expect(data.checkout_url).toBeDefined();
      expect(data.regeneration).toBeDefined();
    });

    it('should reject regeneration for completed intent', async () => {
      const completedIntent = { ...mockIntent, status: 'completed' };
      mockSubscriptionIntentService.getIntent.mockResolvedValue(completedIntent);

      const request = new NextRequest('http://localhost:3000/api/subscriptions/recovery/regenerate', {
        method: 'POST',
        body: JSON.stringify({
          intent_id: 'intent-123',
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await regeneratePost(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Assinatura já foi completada');
      expect(data.code).toBe('ALREADY_COMPLETED');
    });
  });

  describe('POST /api/subscriptions/recovery/resend-email', () => {
    it('should resend checkout email successfully', async () => {
      const request = new NextRequest('http://localhost:3000/api/subscriptions/recovery/resend-email', {
        method: 'POST',
        body: JSON.stringify({
          intent_id: 'intent-123',
          email_type: 'checkout',
          reason: 'User requested resend',
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await resendEmailPost(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.intent_id).toBe('intent-123');
      expect(data.email).toBeDefined();
      expect(data.email.type).toBe('checkout');
      expect(data.email.recipient).toBe('test@example.com');
    });

    it('should reject confirmation email for non-completed intent', async () => {
      const request = new NextRequest('http://localhost:3000/api/subscriptions/recovery/resend-email', {
        method: 'POST',
        body: JSON.stringify({
          intent_id: 'intent-123',
          email_type: 'confirmation',
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await resendEmailPost(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Pagamento não confirmado');
      expect(data.code).toBe('NOT_COMPLETED');
    });
  });

  describe('POST /api/subscriptions/recovery/cancel', () => {
    it('should cancel intent successfully', async () => {
      mockSubscriptionIntentService.executeStateTransition.mockResolvedValue({
        ...mockIntent,
        status: 'expired',
      });

      const request = new NextRequest('http://localhost:3000/api/subscriptions/recovery/cancel', {
        method: 'POST',
        body: JSON.stringify({
          intent_id: 'intent-123',
          reason: 'User requested cancellation',
          cancel_type: 'user_request',
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await cancelPost(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.intent_id).toBe('intent-123');
      expect(data.status).toBe('expired');
      expect(data.cancellation).toBeDefined();
      expect(data.cancellation.reason).toBe('User requested cancellation');
    });

    it('should reject cancellation for completed intent', async () => {
      const completedIntent = { ...mockIntent, status: 'completed' };
      mockSubscriptionIntentService.getIntent.mockResolvedValue(completedIntent);

      const request = new NextRequest('http://localhost:3000/api/subscriptions/recovery/cancel', {
        method: 'POST',
        body: JSON.stringify({
          intent_id: 'intent-123',
          reason: 'User requested cancellation',
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await cancelPost(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Assinatura já foi completada');
      expect(data.code).toBe('ALREADY_COMPLETED');
    });

    it('should require cancellation reason', async () => {
      const request = new NextRequest('http://localhost:3000/api/subscriptions/recovery/cancel', {
        method: 'POST',
        body: JSON.stringify({
          intent_id: 'intent-123',
          // Missing reason
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await cancelPost(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Dados de entrada inválidos');
      expect(data.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'reason',
            message: expect.stringContaining('obrigatório'),
          }),
        ])
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON in requests', async () => {
      const request = new NextRequest('http://localhost:3000/api/subscriptions/checkout-iugu', {
        method: 'POST',
        body: 'invalid json',
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await checkoutPost(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });

    it('should include processing time in error responses', async () => {
      mockSubscriptionIntentService.createIntent.mockRejectedValue(
        new Error('Service unavailable')
      );

      const request = new NextRequest('http://localhost:3000/api/subscriptions/checkout-iugu', {
        method: 'POST',
        body: JSON.stringify(validCheckoutData),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await checkoutPost(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.metadata).toBeDefined();
      expect(data.metadata.processing_time_ms).toBeGreaterThan(0);
    });
  });

  describe('Rate Limiting and Concurrency', () => {
    it('should handle concurrent checkout requests', async () => {
      const requests = Array.from({ length: 5 }, (_, i) => 
        new NextRequest('http://localhost:3000/api/subscriptions/checkout-iugu', {
          method: 'POST',
          body: JSON.stringify({
            ...validCheckoutData,
            user_email: `test${i}@example.com`,
          }),
          headers: {
            'content-type': 'application/json',
          },
        })
      );

      const responses = await Promise.all(
        requests.map(request => checkoutPost(request))
      );

      // All requests should succeed
      for (const response of responses) {
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
      }
    });
  });
});