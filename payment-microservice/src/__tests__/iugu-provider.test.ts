import { IuguProvider } from '../domain/providers/iugu-provider';
import {
  PaymentRequest,
  SubscriptionRequest,
  Currency,
  BillingInterval,
  PaymentStatus,
  SubscriptionStatus,
  PaymentErrorType
} from '../domain/types';
import axios, { AxiosError } from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('IuguProvider', () => {
  let provider: IuguProvider;
  let mockAxiosInstance: any;

  beforeEach(() => {
    provider = new IuguProvider();
    
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
        name: 'iugu',
        isActive: true,
        priority: 1,
        credentials: {
          apiToken: 'test_api_token_123',
          webhookToken: 'webhook_token_123'
        },
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await expect(provider.configure(config)).resolves.not.toThrow();
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://api.iugu.com/v1',
          auth: {
            username: 'test_api_token_123',
            password: ''
          }
        })
      );
    });

    it('should fail configuration with empty API token', async () => {
      const config = {
        id: 'test-config',
        name: 'iugu',
        isActive: true,
        priority: 1,
        credentials: {
          apiToken: '',
          webhookToken: 'webhook_token_123'
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
        name: 'iugu',
        isActive: true,
        priority: 1,
        credentials: {
          apiToken: 'test_api_token_123'
        },
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const invalidConfig = {
        ...validConfig,
        credentials: {
          apiToken: ''
        }
      };

      // Mock successful API call for valid config
      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockResolvedValue({ data: { id: 'account_123' } }),
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
        name: 'iugu',
        isActive: true,
        priority: 1,
        credentials: {
          apiToken: 'test_api_token_123'
        },
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockAxiosInstance.get.mockResolvedValue({ data: { id: 'account_123' } });

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
        name: 'iugu',
        isActive: true,
        priority: 1,
        credentials: {
          apiToken: 'test_api_token_123',
          webhookToken: 'webhook_token_123'
        },
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await provider.configure(config);
    });

    it('should create payment successfully', async () => {
      const mockInvoice = {
        id: 'invoice_test_123',
        status: 'pending',
        total_cents: 1000,
        secure_url: 'https://iugu.com/pay/invoice_test_123',
        token: 'token_123',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      mockAxiosInstance.post.mockResolvedValue({ data: mockInvoice });

      const request: PaymentRequest = {
        amount: 1000,
        currency: Currency.BRL,
        organizationId: 'org_123',
        description: 'Test payment'
      };

      const result = await provider.createPayment(request);

      expect(result.id).toBe('invoice_test_123');
      expect(result.status).toBe(PaymentStatus.PROCESSING);
      expect(result.amount).toBe(1000);
      expect(result.currency).toBe(Currency.BRL);
      expect(result.checkoutUrl).toBe('https://iugu.com/pay/invoice_test_123');
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/invoices',
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({
              description: 'Test payment',
              quantity: 1,
              price_cents: 1000
            })
          ])
        })
      );
    });

    it('should capture payment (get current status)', async () => {
      const mockInvoice = {
        id: 'invoice_test_123',
        status: 'paid',
        total_cents: 1000,
        secure_url: 'https://iugu.com/pay/invoice_test_123',
        token: 'token_123',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockInvoice });

      const result = await provider.capturePayment('invoice_test_123');

      expect(result.id).toBe('invoice_test_123');
      expect(result.status).toBe(PaymentStatus.SUCCEEDED);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/invoices/invoice_test_123');
    });

    it('should refund payment successfully', async () => {
      const mockRefund = {
        id: 'refund_test_123',
        amount_cents: 1000
      };

      mockAxiosInstance.post.mockResolvedValue({ data: mockRefund });

      const result = await provider.refundPayment('invoice_test_123', 1000);

      expect(result.paymentId).toBe('invoice_test_123');
      expect(result.amount).toBe(1000);
      expect(result.status).toBe(PaymentStatus.SUCCEEDED);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/invoices/invoice_test_123/refund',
        { amount_cents: 1000 }
      );
    });
  });

  describe('Subscription Operations', () => {
    beforeEach(async () => {
      const config = {
        id: 'test-config',
        name: 'iugu',
        isActive: true,
        priority: 1,
        credentials: {
          apiToken: 'test_api_token_123',
          webhookToken: 'webhook_token_123'
        },
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await provider.configure(config);
    });

    it('should create subscription successfully', async () => {
      const mockCustomer = { id: 'customer_test_123' };
      const mockPlan = { 
        id: 'plan_test_123', 
        identifier: 'plan_basic',
        value_cents: 1000,
        interval_type: 'monthly'
      };
      const mockSubscription = {
        id: 'subscription_test_123',
        status: 'active',
        customer_id: 'customer_test_123',
        price_cents: 1000,
        interval_type: 'monthly',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      };

      // Mock customer exists
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: mockCustomer }) // customer lookup
        .mockResolvedValueOnce({ data: mockPlan }); // plan lookup

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

      expect(result.id).toBe('subscription_test_123');
      expect(result.status).toBe(SubscriptionStatus.ACTIVE);
      expect(result.customerId).toBe('customer_test_123');
      expect(result.amount).toBe(1000);
    });

    it('should update subscription successfully', async () => {
      const mockSubscription = {
        id: 'subscription_test_123',
        status: 'active',
        customer_id: 'customer_test_123',
        price_cents: 1000,
        interval_type: 'monthly',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      };

      mockAxiosInstance.post.mockResolvedValue({ data: {} }); // suspend call
      mockAxiosInstance.get.mockResolvedValue({ data: mockSubscription });

      const result = await provider.updateSubscription('subscription_test_123', {
        cancelAtPeriodEnd: true
      });

      expect(result.id).toBe('subscription_test_123');
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/subscriptions/subscription_test_123/suspend');
    });

    it('should cancel subscription successfully', async () => {
      const mockSubscription = {
        id: 'subscription_test_123',
        status: 'suspended',
        customer_id: 'customer_test_123',
        price_cents: 1000,
        interval_type: 'monthly',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        suspended_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      };

      mockAxiosInstance.post.mockResolvedValue({ data: {} }); // suspend call
      mockAxiosInstance.get.mockResolvedValue({ data: mockSubscription });

      const result = await provider.cancelSubscription('subscription_test_123');

      expect(result.id).toBe('subscription_test_123');
      expect(result.status).toBe(SubscriptionStatus.PAST_DUE); // suspended maps to past_due
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/subscriptions/subscription_test_123/suspend');
    });
  });

  describe('Webhook Operations', () => {
    beforeEach(async () => {
      const config = {
        id: 'test-config',
        name: 'iugu',
        isActive: true,
        priority: 1,
        credentials: {
          apiToken: 'test_api_token_123',
          webhookToken: 'webhook_token_123'
        },
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await provider.configure(config);
    });

    it('should validate webhook signature successfully', () => {
      const result = provider.validateWebhook('payload', 'webhook_token_123');
      expect(result).toBe(true);
    });

    it('should fail webhook validation with invalid signature', () => {
      const result = provider.validateWebhook('payload', 'invalid_token');
      expect(result).toBe(false);
    });

    it('should parse webhook event successfully', () => {
      const mockEvent = {
        id: 'event_test_123',
        event: 'invoice.payment_completed',
        data: {
          id: 'invoice_test_123',
          status: 'paid'
        },
        occurred_at: new Date().toISOString()
      };

      const payload = JSON.stringify(mockEvent);
      const result = provider.parseWebhook(payload);

      expect(result.type).toBe('payment.succeeded');
      expect(result.provider).toBe('iugu');
      expect(result.data.object.id).toBe('invoice_test_123');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      const config = {
        id: 'test-config',
        name: 'iugu',
        isActive: true,
        priority: 1,
        credentials: {
          apiToken: 'test_api_token_123'
        },
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await provider.configure(config);
    });

    it('should handle Iugu validation errors correctly', async () => {
      const iuguError = new Error('Validation failed');
      (iuguError as any).response = {
        status: 422,
        data: {
          message: 'Validation failed'
        }
      };

      mockAxiosInstance.post.mockRejectedValue(iuguError);

      const request: PaymentRequest = {
        amount: 1000,
        currency: Currency.BRL,
        organizationId: 'org_123'
      };

      await expect(provider.createPayment(request)).rejects.toThrow('Validation failed');
    });

    it('should handle Iugu API errors correctly', async () => {
      const iuguError = new Error('Internal server error');
      (iuguError as any).response = {
        status: 500,
        data: {
          message: 'Internal server error'
        }
      };

      mockAxiosInstance.post.mockRejectedValue(iuguError);

      const request: PaymentRequest = {
        amount: 1000,
        currency: Currency.BRL,
        organizationId: 'org_123'
      };

      await expect(provider.createPayment(request)).rejects.toThrow('Internal server error');
    });
  });
});