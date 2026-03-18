import { StripeProvider } from '../domain/providers/stripe-provider';
import {
  PaymentRequest,
  SubscriptionRequest,
  Currency,
  BillingInterval,
  PaymentStatus,
  SubscriptionStatus,
  PaymentErrorType
} from '../domain/types';

// Create mock functions
const mockStripeInstance = {
  balance: {
    retrieve: jest.fn().mockResolvedValue({ available: [{ amount: 1000 }] })
  },
  paymentIntents: {
    create: jest.fn(),
    capture: jest.fn(),
    retrieve: jest.fn()
  },
  refunds: {
    create: jest.fn()
  },
  customers: {
    create: jest.fn(),
    retrieve: jest.fn()
  },
  subscriptions: {
    create: jest.fn(),
    update: jest.fn(),
    cancel: jest.fn(),
    retrieve: jest.fn()
  },
  products: {
    create: jest.fn()
  },
  prices: {
    create: jest.fn(),
    list: jest.fn()
  },
  webhooks: {
    constructEvent: jest.fn()
  }
};

// Mock do Stripe
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => mockStripeInstance);
});

describe('StripeProvider', () => {
  let provider: StripeProvider;

  beforeEach(() => {
    provider = new StripeProvider();
    // Reset mocks
    jest.clearAllMocks();
  });

  describe('Configuration', () => {
    it('should configure successfully with valid credentials', async () => {
      const config = {
        id: 'test-config',
        name: 'stripe',
        isActive: true,
        priority: 1,
        credentials: {
          secretKey: 'sk_mock_123456789',
          webhookSecret: 'whsec_test_123'
        },
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await expect(provider.configure(config)).resolves.not.toThrow();
    });

    it('should fail configuration with invalid secret key', async () => {
      const config = {
        id: 'test-config',
        name: 'stripe',
        isActive: true,
        priority: 1,
        credentials: {
          secretKey: 'invalid_key',
          webhookSecret: 'whsec_test_123'
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
        name: 'stripe',
        isActive: true,
        priority: 1,
        credentials: {
          secretKey: 'sk_mock_123456789'
        },
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const invalidConfig = {
        ...validConfig,
        credentials: {
          secretKey: 'invalid_key'
        }
      };

      await expect(provider.validateConfig(validConfig)).resolves.toBe(true);
      await expect(provider.validateConfig(invalidConfig)).resolves.toBe(false);
    });
  });

  describe('Health Check', () => {
    it('should return healthy status when configured and API is accessible', async () => {
      const config = {
        id: 'test-config',
        name: 'stripe',
        isActive: true,
        priority: 1,
        credentials: {
          secretKey: 'sk_mock_123456789'
        },
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

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
        name: 'stripe',
        isActive: true,
        priority: 1,
        credentials: {
          secretKey: 'sk_mock_123456789',
          webhookSecret: 'whsec_test_123'
        },
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await provider.configure(config);
    });

    it('should create payment successfully', async () => {
      const mockPaymentIntent = {
        id: 'pi_test_123',
        status: 'succeeded',
        amount: 1000,
        currency: 'brl',
        created: Math.floor(Date.now() / 1000),
        client_secret: 'pi_test_123_secret'
      };

      mockStripeInstance.paymentIntents.create.mockResolvedValue(mockPaymentIntent);

      const request: PaymentRequest = {
        amount: 1000,
        currency: Currency.BRL,
        organizationId: 'org_123',
        description: 'Test payment'
      };

      const result = await provider.createPayment(request);

      expect(result.id).toBe('pi_test_123');
      expect(result.status).toBe(PaymentStatus.SUCCEEDED);
      expect(result.amount).toBe(1000);
      expect(result.currency).toBe(Currency.BRL);
      expect(mockStripeInstance.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 1000,
          currency: 'brl',
          description: 'Test payment'
        })
      );
    });

    it('should capture payment successfully', async () => {
      const mockPaymentIntent = {
        id: 'pi_test_123',
        status: 'succeeded',
        amount: 1000,
        currency: 'brl',
        created: Math.floor(Date.now() / 1000),
        charges: { data: [] }
      };

      mockStripeInstance.paymentIntents.capture.mockResolvedValue(mockPaymentIntent);

      const result = await provider.capturePayment('pi_test_123');

      expect(result.id).toBe('pi_test_123');
      expect(result.status).toBe(PaymentStatus.SUCCEEDED);
      expect(mockStripeInstance.paymentIntents.capture).toHaveBeenCalledWith('pi_test_123');
    });

    it('should refund payment successfully', async () => {
      const mockRefund = {
        id: 're_test_123',
        amount: 1000,
        status: 'succeeded',
        created: Math.floor(Date.now() / 1000),
        reason: null
      };

      mockStripeInstance.refunds.create.mockResolvedValue(mockRefund);

      const result = await provider.refundPayment('pi_test_123', 1000);

      expect(result.id).toBe('re_test_123');
      expect(result.amount).toBe(1000);
      expect(result.status).toBe(PaymentStatus.SUCCEEDED);
      expect(mockStripeInstance.refunds.create).toHaveBeenCalledWith({
        payment_intent: 'pi_test_123',
        amount: 1000
      });
    });
  });

  describe('Subscription Operations', () => {
    beforeEach(async () => {
      const config = {
        id: 'test-config',
        name: 'stripe',
        isActive: true,
        priority: 1,
        credentials: {
          secretKey: 'sk_mock_123456789',
          webhookSecret: 'whsec_test_123'
        },
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await provider.configure(config);
    });

    it('should create subscription successfully', async () => {
      const mockCustomer = { id: 'cus_test_123' };
      const mockProduct = { id: 'prod_test_123' };
      const mockPrice = { id: 'price_test_123' };
      const mockSubscription = {
        id: 'sub_test_123',
        status: 'active',
        customer: 'cus_test_123',
        currency: 'brl',
        start_date: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 2592000, // +30 days
        created: Math.floor(Date.now() / 1000),
        canceled_at: null,
        items: {
          data: [{
            price: {
              unit_amount: 1000,
              recurring: { interval: 'month' }
            }
          }]
        }
      };

      mockStripeInstance.customers.retrieve.mockResolvedValue(mockCustomer);
      mockStripeInstance.prices.list.mockResolvedValue({ data: [] });
      mockStripeInstance.products.create.mockResolvedValue(mockProduct);
      mockStripeInstance.prices.create.mockResolvedValue(mockPrice);
      mockStripeInstance.subscriptions.create.mockResolvedValue(mockSubscription);

      const request: SubscriptionRequest = {
        customerId: 'cus_test_123',
        organizationId: 'org_123',
        planId: 'plan_basic',
        amount: 1000,
        currency: 'BRL',
        billingInterval: BillingInterval.MONTHLY
      };

      const result = await provider.createSubscription(request);

      expect(result.id).toBe('sub_test_123');
      expect(result.status).toBe(SubscriptionStatus.ACTIVE);
      expect(result.customerId).toBe('cus_test_123');
      expect(result.amount).toBe(1000);
    });

    it('should update subscription successfully', async () => {
      const mockSubscription = {
        id: 'sub_test_123',
        status: 'active',
        customer: 'cus_test_123',
        currency: 'brl',
        start_date: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 2592000,
        created: Math.floor(Date.now() / 1000),
        canceled_at: null,
        items: {
          data: [{
            price: {
              unit_amount: 1500,
              recurring: { interval: 'month' }
            }
          }]
        }
      };

      mockStripeInstance.subscriptions.update.mockResolvedValue(mockSubscription);

      const result = await provider.updateSubscription('sub_test_123', {
        cancelAtPeriodEnd: true
      });

      expect(result.id).toBe('sub_test_123');
      expect(mockStripeInstance.subscriptions.update).toHaveBeenCalledWith(
        'sub_test_123',
        expect.objectContaining({
          cancel_at_period_end: true
        })
      );
    });

    it('should cancel subscription successfully', async () => {
      const mockSubscription = {
        id: 'sub_test_123',
        status: 'canceled',
        customer: 'cus_test_123',
        currency: 'brl',
        start_date: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 2592000,
        created: Math.floor(Date.now() / 1000),
        canceled_at: Math.floor(Date.now() / 1000),
        items: {
          data: [{
            price: {
              unit_amount: 1000,
              recurring: { interval: 'month' }
            }
          }]
        }
      };

      mockStripeInstance.subscriptions.cancel.mockResolvedValue(mockSubscription);

      const result = await provider.cancelSubscription('sub_test_123');

      expect(result.id).toBe('sub_test_123');
      expect(result.status).toBe(SubscriptionStatus.CANCELED);
      expect(mockStripeInstance.subscriptions.cancel).toHaveBeenCalledWith('sub_test_123');
    });
  });

  describe('Webhook Operations', () => {
    beforeEach(async () => {
      const config = {
        id: 'test-config',
        name: 'stripe',
        isActive: true,
        priority: 1,
        credentials: {
          secretKey: 'sk_mock_123456789',
          webhookSecret: 'whsec_test_123'
        },
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await provider.configure(config);
    });

    it('should validate webhook signature successfully', () => {
      mockStripeInstance.webhooks.constructEvent.mockReturnValue({});

      const result = provider.validateWebhook('payload', 'signature');

      expect(result).toBe(true);
      expect(mockStripeInstance.webhooks.constructEvent).toHaveBeenCalledWith(
        'payload',
        'signature',
        'whsec_test_123'
      );
    });

    it('should fail webhook validation with invalid signature', () => {
      mockStripeInstance.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      const result = provider.validateWebhook('payload', 'invalid_signature');

      expect(result).toBe(false);
    });

    it('should parse webhook event successfully', () => {
      const mockEvent = {
        id: 'evt_test_123',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_123',
            status: 'succeeded'
          }
        },
        created: Math.floor(Date.now() / 1000)
      };

      const payload = JSON.stringify(mockEvent);
      const result = provider.parseWebhook(payload);

      expect(result.type).toBe('payment.succeeded');
      expect(result.id).toBe('evt_test_123');
      expect(result.provider).toBe('stripe');
      expect(result.data.object.id).toBe('pi_test_123');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      const config = {
        id: 'test-config',
        name: 'stripe',
        isActive: true,
        priority: 1,
        credentials: {
          secretKey: 'sk_mock_123456789'
        },
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await provider.configure(config);
    });

    it('should handle Stripe card errors correctly', async () => {
      const stripeError = {
        type: 'StripeCardError',
        message: 'Your card was declined.'
      };

      mockStripeInstance.paymentIntents.create.mockRejectedValue(stripeError);

      const request: PaymentRequest = {
        amount: 1000,
        currency: Currency.BRL,
        organizationId: 'org_123'
      };

      await expect(provider.createPayment(request)).rejects.toMatchObject({
        type: PaymentErrorType.PAYMENT_DECLINED,
        retryable: false
      });
    });

    it('should handle Stripe API errors correctly', async () => {
      const stripeError = {
        type: 'StripeAPIError',
        message: 'An error occurred with our API.'
      };

      mockStripeInstance.paymentIntents.create.mockRejectedValue(stripeError);

      const request: PaymentRequest = {
        amount: 1000,
        currency: Currency.BRL,
        organizationId: 'org_123'
      };

      await expect(provider.createPayment(request)).rejects.toMatchObject({
        type: PaymentErrorType.PROVIDER_UNAVAILABLE,
        retryable: true
      });
    });
  });
});