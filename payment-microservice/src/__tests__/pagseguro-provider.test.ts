import { PagSeguroProvider } from '../domain/providers/pagseguro-provider';
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

describe('PagSeguroProvider', () => {
  let provider: PagSeguroProvider;
  let mockAxiosInstance: any;

  beforeEach(() => {
    provider = new PagSeguroProvider();
    
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
        name: 'pagseguro',
        isActive: true,
        priority: 1,
        credentials: {
          email: 'test@example.com',
          token: 'test_token_123',
          environment: 'sandbox'
        },
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await expect(provider.configure(config)).resolves.not.toThrow();
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://ws.sandbox.pagseguro.uol.com.br'
        })
      );
    });

    it('should fail configuration with empty credentials', async () => {
      const config = {
        id: 'test-config',
        name: 'pagseguro',
        isActive: true,
        priority: 1,
        credentials: {
          email: '',
          token: ''
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
        name: 'pagseguro',
        isActive: true,
        priority: 1,
        credentials: {
          email: 'test@example.com',
          token: 'test_token_123'
        },
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const invalidConfig = {
        ...validConfig,
        credentials: {
          email: '',
          token: ''
        }
      };

      // Mock successful API call for valid config
      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockResolvedValue({ data: '<session><id>session123</id></session>' }),
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
        name: 'pagseguro',
        isActive: true,
        priority: 1,
        credentials: {
          email: 'test@example.com',
          token: 'test_token_123'
        },
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockAxiosInstance.get.mockResolvedValue({ data: '<session><id>session123</id></session>' });

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
        name: 'pagseguro',
        isActive: true,
        priority: 1,
        credentials: {
          email: 'test@example.com',
          token: 'test_token_123',
          environment: 'sandbox'
        },
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await provider.configure(config);
    });

    it('should create payment successfully', async () => {
      const mockCheckoutResponse = '<checkout><code>checkout_code_123</code></checkout>';

      mockAxiosInstance.post.mockResolvedValue({ data: mockCheckoutResponse });

      const request: PaymentRequest = {
        amount: 1000,
        currency: Currency.BRL,
        organizationId: 'org_123',
        description: 'Test payment'
      };

      const result = await provider.createPayment(request);

      expect(result.id).toBe('checkout_code_123');
      expect(result.status).toBe(PaymentStatus.REQUIRES_ACTION);
      expect(result.amount).toBe(1000);
      expect(result.currency).toBe(Currency.BRL);
      expect(result.checkoutUrl).toContain('checkout_code_123');
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        expect.stringContaining('/v2/checkout'),
        expect.stringContaining('<description>Test payment</description>'),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/xml; charset=ISO-8859-1'
          }
        })
      );
    });

    it('should capture payment (get current status)', async () => {
      const mockTransactionResponse = `
        <transaction>
          <code>transaction_123</code>
          <status>3</status>
          <grossAmount>10.00</grossAmount>
          <date>2023-01-01T00:00:00</date>
        </transaction>
      `;

      mockAxiosInstance.get.mockResolvedValue({ data: mockTransactionResponse });

      const result = await provider.capturePayment('transaction_123');

      expect(result.id).toBe('transaction_123');
      expect(result.status).toBe(PaymentStatus.SUCCEEDED);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining('/v3/transactions/transaction_123')
      );
    });

    it('should refund payment successfully', async () => {
      const mockRefundResponse = '<refund><code>refund_123</code></refund>';

      mockAxiosInstance.post.mockResolvedValue({ data: mockRefundResponse });

      const result = await provider.refundPayment('transaction_123', 1000);

      expect(result.paymentId).toBe('transaction_123');
      expect(result.amount).toBe(1000);
      expect(result.status).toBe(PaymentStatus.SUCCEEDED);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        expect.stringContaining('/v2/transactions/refunds'),
        expect.stringContaining('<value>10.00</value>'),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/xml; charset=ISO-8859-1'
          }
        })
      );
    });
  });

  describe('Subscription Operations', () => {
    beforeEach(async () => {
      const config = {
        id: 'test-config',
        name: 'pagseguro',
        isActive: true,
        priority: 1,
        credentials: {
          email: 'test@example.com',
          token: 'test_token_123',
          environment: 'sandbox'
        },
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await provider.configure(config);
    });

    it('should create subscription successfully', async () => {
      const mockSubscriptionResponse = '<preApprovalRequest><code>subscription_123</code></preApprovalRequest>';

      mockAxiosInstance.post.mockResolvedValue({ data: mockSubscriptionResponse });

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
        expect.stringContaining('/v2/pre-approvals/request'),
        expect.stringContaining('<reference>plan_basic</reference>'),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/xml; charset=ISO-8859-1'
          }
        })
      );
    });

    it('should update subscription successfully', async () => {
      const mockSubscriptionResponse = `
        <preApproval>
          <code>subscription_123</code>
          <status>ACTIVE</status>
          <amount>10.00</amount>
          <period>MONTHLY</period>
          <date>2023-01-01T00:00:00</date>
        </preApproval>
      `;

      mockAxiosInstance.get.mockResolvedValue({ data: mockSubscriptionResponse });

      const result = await provider.updateSubscription('subscription_123', {
        cancelAtPeriodEnd: false
      });

      expect(result.id).toBe('subscription_123');
      expect(result.status).toBe(SubscriptionStatus.ACTIVE);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining('/v2/pre-approvals/subscription_123')
      );
    });

    it('should cancel subscription successfully', async () => {
      const mockSubscriptionResponse = `
        <preApproval>
          <code>subscription_123</code>
          <status>CANCELLED</status>
          <amount>10.00</amount>
          <period>MONTHLY</period>
          <date>2023-01-01T00:00:00</date>
        </preApproval>
      `;

      mockAxiosInstance.put.mockResolvedValue({ data: {} }); // cancel call
      mockAxiosInstance.get.mockResolvedValue({ data: mockSubscriptionResponse });

      const result = await provider.cancelSubscription('subscription_123');

      expect(result.id).toBe('subscription_123');
      expect(result.status).toBe(SubscriptionStatus.CANCELED);
      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        expect.stringContaining('/v2/pre-approvals/subscription_123/cancel')
      );
    });
  });

  describe('Webhook Operations', () => {
    beforeEach(async () => {
      const config = {
        id: 'test-config',
        name: 'pagseguro',
        isActive: true,
        priority: 1,
        credentials: {
          email: 'test@example.com',
          token: 'test_token_123'
        },
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await provider.configure(config);
    });

    it('should validate webhook successfully', () => {
      const result = provider.validateWebhook('payload', 'signature');
      expect(result).toBe(true); // PagSeguro sempre retorna true
    });

    it('should parse webhook event successfully', () => {
      const payload = 'notificationCode=notification_123&notificationType=transaction';
      const result = provider.parseWebhook(payload);

      expect(result.type).toBe('payment.succeeded');
      expect(result.provider).toBe('pagseguro');
      expect(result.data.object.notificationCode).toBe('notification_123');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      const config = {
        id: 'test-config',
        name: 'pagseguro',
        isActive: true,
        priority: 1,
        credentials: {
          email: 'test@example.com',
          token: 'test_token_123'
        },
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await provider.configure(config);
    });

    it('should handle PagSeguro validation errors correctly', async () => {
      const pagSeguroError = new Error('Validation failed');
      (pagSeguroError as any).response = {
        status: 400,
        data: {
          message: 'Validation failed'
        }
      };

      mockAxiosInstance.post.mockRejectedValue(pagSeguroError);

      const request: PaymentRequest = {
        amount: 1000,
        currency: Currency.BRL,
        organizationId: 'org_123'
      };

      await expect(provider.createPayment(request)).rejects.toThrow('Validation failed');
    });

    it('should handle PagSeguro API errors correctly', async () => {
      const pagSeguroError = new Error('Internal server error');
      (pagSeguroError as any).response = {
        status: 500,
        data: {
          message: 'Internal server error'
        }
      };

      mockAxiosInstance.post.mockRejectedValue(pagSeguroError);

      const request: PaymentRequest = {
        amount: 1000,
        currency: Currency.BRL,
        organizationId: 'org_123'
      };

      await expect(provider.createPayment(request)).rejects.toThrow('Internal server error');
    });
  });
});