import { MercadoPagoProvider } from '../domain/providers/mercadopago-provider';
import {
  PaymentRequest,
  SubscriptionRequest,
  Currency,
  BillingInterval,
  PaymentStatus,
  SubscriptionStatus,
  PaymentErrorType
} from '../domain/types';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('MercadoPagoProvider', () => {
  let provider: MercadoPagoProvider;
  let mockAxiosInstance: any;

  beforeEach(() => {
    provider = new MercadoPagoProvider();
    
    // Create mock axios instance
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn()
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance);
    jest.clearAllMocks();
  });

  describe('Configuration', () => {
    it('should configure successfully with valid credentials', async () => {
      const config = {
        id: 'test-config',
        name: 'mercadopago',
        isActive: true,
        priority: 1,
        credentials: {
          accessToken: 'TEST-123456789-access-token',
          webhookSecret: 'webhook_secret_123'
        },
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await expect(provider.configure(config)).resolves.not.toThrow();
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://api.mercadopago.com',
          headers: expect.objectContaining({
            'Authorization': 'Bearer TEST-123456789-access-token'
          })
        })
      );
    });

    it('should fail configuration with empty access token', async () => {
      const config = {
        id: 'test-config',
        name: 'mercadopago',
        isActive: true,
        priority: 1,
        credentials: {
          accessToken: '',
          webhookSecret: 'webhook_secret_123'
        },
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await expect(provider.configure(config)).rejects.toThrow();
    });

    it('should validate config correctly', async () => {
      const validConfig = {
        id: 'test-config',
        name: 'mercadopago',
        isActive: true,
        priority: 1,
        credentials: {
          accessToken: 'TEST-123456789-access-token'
        },
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const invalidConfig = {
        ...validConfig,
        credentials: {
          accessToken: ''
        }
      };

      // Mock successful API call for valid config
      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockResolvedValue({ data: { id: 'user_123' } }),
        post: jest.fn(),
        put: jest.fn(),
        delete: jest.fn(),
        defaults: {},
        interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } }
      } as any);

      await expect(provider.validateConfig(validConfig)).resolves.toBe(true);
      await expect(provider.validateConfig(invalidConfig)).resolves.toBe(false);
    });
  });

  describe('Health Check', () => {
    it('should return healthy status when configured and API is accessible', async () => {
      const config = {
        id: 'test-config',
        name: 'mercadopago',
        isActive: true,
        priority: 1,
        credentials: {
          accessToken: 'TEST-123456789-access-token'
        },
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockAxiosInstance.get.mockResolvedValue({ data: { id: 'user_123' } });

      await provider.configure(config);
      const health = await provider.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.details?.apiAccessible).toBe(true);
    });

    it('should return offline status when not configured', async () => {
      const health = await provider.healthCheck();

      expect(health.status).toBe('offline');
      expect(health.details?.apiAccessible).toBe(false);
    });
  });

  describe('Payment Operations', () => {
    beforeEach(async () => {
      const config = {
        id: 'test-config',
        name: 'mercadopago',
        isActive: true,
        priority: 1,
        credentials: {
          accessToken: 'TEST-123456789-access-token',
          webhookSecret: 'webhook_secret_123'
        },
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await provider.configure(config);
    });

    it('should create payment successfully', async () => {
      const mockPreference = {
        id: 'preference_123',
        init_point: 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=preference_123',
        sandbox_init_point: 'https://sandbox.mercadopago.com.br/checkout/v1/redirect?pref_id=preference_123',
        date_created: new Date().toISOString()
      };

      mockAxiosInstance.post.mockResolvedValue({ data: mockPreference });

      const request: PaymentRequest = {
        amount: 1000,
        currency: Currency.BRL,
        organizationId: 'org_123',
        description: 'Test payment'
      };

      const result = await provider.createPayment(request);

      expect(result.id).toBe('preference_123');
      expect(result.status).toBe(PaymentStatus.REQUIRES_ACTION);
      expect(result.amount).toBe(1000);
      expect(result.currency).toBe(Currency.BRL);
      expect(result.checkoutUrl).toContain('preference_123');
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/checkout/preferences',
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({
              title: 'Test payment',
              quantity: 1,
              unit_price: 10
            })
          ])
        })
      );
    });

    it('should capture payment (get current status)', async () => {
      const mockPayment = {
        id: 123456789,
        status: 'approved',
        transaction_amount: 10.00,
        currency_id: 'BRL',
        date_created: new Date().toISOString(),
        date_last_updated: new Date().toISOString(),
        point_of_interaction: {}
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockPayment });

      const result = await provider.capturePayment('123456789');

      expect(result.id).toBe('123456789');
      expect(result.status).toBe(PaymentStatus.SUCCEEDED);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/v1/payments/123456789');
    });

    it('should refund payment successfully', async () => {
      const mockRefund = {
        id: 987654321,
        amount: 10.00,
        reason: 'requested_by_customer',
        date_created: new Date().toISOString()
      };

      mockAxiosInstance.post.mockResolvedValue({ data: mockRefund });

      const result = await provider.refundPayment('123456789', 1000);

      expect(result.paymentId).toBe('123456789');
      expect(result.amount).toBe(1000);
      expect(result.status).toBe(PaymentStatus.SUCCEEDED);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/v1/payments/123456789/refunds',
        { amount: 10 }
      );
    });
  });

  describe('Subscription Operations', () => {
    beforeEach(async () => {
      const config = {
        id: 'test-config',
        name: 'mercadopago',
        isActive: true,
        priority: 1,
        credentials: {
          accessToken: 'TEST-123456789-access-token',
          webhookSecret: 'webhook_secret_123'
        },
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await provider.configure(config);
    });

    it('should create subscription successfully', async () => {
      const mockSubscription = {
        id: 'subscription_123',
        status: 'pending',
        date_created: new Date().toISOString(),
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: 10.00,
          currency_id: 'BRL'
        }
      };

      mockAxiosInstance.post.mockResolvedValue({ data: mockSubscription });

      const request: SubscriptionRequest = {
        customerId: 'customer_test_123',
        organizationId: 'org_123',
        planId: 'plan_basic',
        amount: 1000,
        currency: 'BRL',
        billingInterval: BillingInterval.MONTHLY
      };

      const result = await provider.createSubscription(request);

      expect(result.id).toBe('subscription_123');
      expect(result.status).toBe(SubscriptionStatus.INCOMPLETE);
      expect(result.customerId).toBe('customer_test_123');
      expect(result.amount).toBe(1000);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/preapproval',
        expect.objectContaining({
          reason: 'Plano plan_basic',
          auto_recurring: expect.objectContaining({
            frequency: 1,
            frequency_type: 'months',
            transaction_amount: 10,
            currency_id: 'BRL'
          })
        })
      );
    });

    it('should update subscription successfully', async () => {
      const mockSubscription = {
        id: 'subscription_123',
        status: 'authorized',
        date_created: new Date().toISOString(),
        payer_email: 'customer@example.com',
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: 10.00,
          currency_id: 'BRL'
        },
        next_payment_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      };

      mockAxiosInstance.put.mockResolvedValue({ data: {} });
      mockAxiosInstance.get.mockResolvedValue({ data: mockSubscription });

      const result = await provider.updateSubscription('subscription_123', {
        cancelAtPeriodEnd: false
      });

      expect(result.id).toBe('subscription_123');
      expect(result.status).toBe(SubscriptionStatus.ACTIVE);
      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        '/preapproval/subscription_123',
        { status: 'authorized' }
      );
    });

    it('should cancel subscription successfully', async () => {
      const mockSubscription = {
        id: 'subscription_123',
        status: 'cancelled',
        date_created: new Date().toISOString(),
        payer_email: 'customer@example.com',
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: 10.00,
          currency_id: 'BRL'
        },
        next_payment_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      };

      mockAxiosInstance.put.mockResolvedValue({ data: {} }); // cancel call
      mockAxiosInstance.get.mockResolvedValue({ data: mockSubscription });

      const result = await provider.cancelSubscription('subscription_123');

      expect(result.id).toBe('subscription_123');
      expect(result.status).toBe(SubscriptionStatus.CANCELED);
      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        '/preapproval/subscription_123',
        { status: 'cancelled' }
      );
    });
  });

  describe('Webhook Operations', () => {
    beforeEach(async () => {
      const config = {
        id: 'test-config',
        name: 'mercadopago',
        isActive: true,
        priority: 1,
        credentials: {
          accessToken: 'TEST-123456789-access-token',
          webhookSecret: 'webhook_secret_123'
        },
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await provider.configure(config);
    });

    it('should validate webhook signature successfully', () => {
      // Mock crypto module
      const mockCrypto = {
        createHmac: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('expected_signature')
      };
      
      jest.doMock('crypto', () => mockCrypto);

      const result = provider.validateWebhook('payload', 'expected_signature');
      expect(result).toBe(true);
    });

    it('should fail webhook validation with invalid signature', () => {
      const mockCrypto = {
        createHmac: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('expected_signature')
      };
      
      jest.doMock('crypto', () => mockCrypto);

      const result = provider.validateWebhook('payload', 'invalid_signature');
      expect(result).toBe(false);
    });

    it('should parse webhook event successfully', () => {
      const mockEvent = {
        id: 123456789,
        type: 'payment.updated',
        action: 'payment.updated',
        date_created: new Date().toISOString(),
        data: {
          id: 'payment_123'
        }
      };

      const payload = JSON.stringify(mockEvent);
      const result = provider.parseWebhook(payload);

      expect(result.type).toBe('payment.succeeded');
      expect(result.provider).toBe('mercadopago');
      expect(result.data.object.id).toBe('payment_123');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      const config = {
        id: 'test-config',
        name: 'mercadopago',
        isActive: true,
        priority: 1,
        credentials: {
          accessToken: 'TEST-123456789-access-token'
        },
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await provider.configure(config);
    });

    it('should handle Mercado Pago validation errors correctly', async () => {
      const mercadoPagoError = new Error('Validation failed');
      (mercadoPagoError as any).response = {
        status: 400,
        data: {
          message: 'Validation failed'
        }
      };

      mockAxiosInstance.post.mockRejectedValue(mercadoPagoError);

      const request: PaymentRequest = {
        amount: 1000,
        currency: Currency.BRL,
        organizationId: 'org_123'
      };

      await expect(provider.createPayment(request)).rejects.toThrow('Validation failed');
    });

    it('should handle Mercado Pago API errors correctly', async () => {
      const mercadoPagoError = new Error('Internal server error');
      (mercadoPagoError as any).response = {
        status: 500,
        data: {
          message: 'Internal server error'
        }
      };

      mockAxiosInstance.post.mockRejectedValue(mercadoPagoError);

      const request: PaymentRequest = {
        amount: 1000,
        currency: Currency.BRL,
        organizationId: 'org_123'
      };

      await expect(provider.createPayment(request)).rejects.toThrow('Internal server error');
    });
  });
});