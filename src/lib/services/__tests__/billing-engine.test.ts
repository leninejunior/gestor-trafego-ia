// Mock Stripe
const mockStripe = {
  paymentIntents: {
    create: jest.fn(),
    retrieve: jest.fn(),
  },
  customers: {
    create: jest.fn(),
    retrieve: jest.fn(),
  },
  invoices: {
    create: jest.fn(),
    finalize: jest.fn(),
  },
};

jest.mock('stripe', () => {
  return jest.fn(() => mockStripe);
});

// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    single: jest.fn(),
  })),
};

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => mockSupabaseClient,
}));

import { BillingEngine } from '../billing-engine';
import { SubscriptionInvoice } from '@/lib/types/subscription';

describe('BillingEngine', () => {
  let billingEngine: BillingEngine;
  
  const mockSubscription = {
    id: 'sub-123',
    organizationId: 'org-123',
    planId: 'plan-123',
    status: 'active',
    billingCycle: 'monthly',
    currentPeriodStart: new Date('2024-01-01'),
    currentPeriodEnd: new Date('2024-02-01'),
    plan: {
      monthlyPrice: 99.99,
      name: 'Pro Plan',
    },
  };

  beforeEach(() => {
    billingEngine = new BillingEngine();
    jest.clearAllMocks();
  });

  describe('processRecurringBilling', () => {
    it('should process due subscriptions', async () => {
      const dueSubscriptions = [mockSubscription];
      
      mockSupabaseClient.from().select().lte().mockResolvedValue({
        data: dueSubscriptions,
        error: null,
      });

      mockStripe.paymentIntents.create.mockResolvedValue({
        id: 'pi_123',
        status: 'succeeded',
        amount: 9999,
      });

      mockSupabaseClient.from().insert().mockResolvedValue({
        data: { id: 'inv-123' },
        error: null,
      });

      const result = await billingEngine.processRecurringBilling();

      expect(result.processed).toBe(1);
      expect(result.failed).toBe(0);
      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: 9999,
        currency: 'usd',
        automatic_payment_methods: { enabled: true },
        metadata: {
          subscriptionId: 'sub-123',
          organizationId: 'org-123',
        },
      });
    });

    it('should handle payment failures', async () => {
      const dueSubscriptions = [mockSubscription];
      
      mockSupabaseClient.from().select().lte().mockResolvedValue({
        data: dueSubscriptions,
        error: null,
      });

      mockStripe.paymentIntents.create.mockRejectedValue(new Error('Payment failed'));

      const result = await billingEngine.processRecurringBilling();

      expect(result.processed).toBe(0);
      expect(result.failed).toBe(1);
    });

    it('should skip subscriptions with no due date', async () => {
      mockSupabaseClient.from().select().lte().mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await billingEngine.processRecurringBilling();

      expect(result.processed).toBe(0);
      expect(result.failed).toBe(0);
    });
  });

  describe('createInvoice', () => {
    it('should create invoice with correct line items', async () => {
      const expectedInvoice: Partial<SubscriptionInvoice> = {
        subscriptionId: 'sub-123',
        invoiceNumber: expect.stringMatching(/INV-\d{8}-\d{4}/),
        amount: 99.99,
        currency: 'usd',
        status: 'draft',
        lineItems: [
          {
            description: 'Pro Plan - Monthly Subscription',
            amount: 99.99,
            quantity: 1,
          },
        ],
        dueDate: expect.any(Date),
      };

      mockSupabaseClient.from().insert().single().mockResolvedValue({
        data: { id: 'inv-123', ...expectedInvoice },
        error: null,
      });

      const result = await billingEngine.createInvoice('sub-123');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('subscription_invoices');
      expect(result.amount).toBe(99.99);
      expect(result.lineItems).toHaveLength(1);
      expect(result.lineItems[0].description).toContain('Pro Plan');
    });

    it('should handle subscription not found', async () => {
      mockSupabaseClient.from().select().eq().single().mockResolvedValue({
        data: null,
        error: { message: 'Subscription not found' },
      });

      await expect(billingEngine.createInvoice('nonexistent')).rejects.toThrow('Subscription not found');
    });

    it('should generate unique invoice numbers', async () => {
      const invoice1 = await billingEngine.generateInvoiceNumber();
      const invoice2 = await billingEngine.generateInvoiceNumber();

      expect(invoice1).not.toBe(invoice2);
      expect(invoice1).toMatch(/INV-\d{8}-\d{4}/);
      expect(invoice2).toMatch(/INV-\d{8}-\d{4}/);
    });
  });

  describe('handlePaymentSuccess', () => {
    it('should update subscription and invoice on successful payment', async () => {
      const paymentIntent = {
        id: 'pi_123',
        status: 'succeeded',
        metadata: {
          subscriptionId: 'sub-123',
          invoiceId: 'inv-123',
        },
      };

      mockSupabaseClient.from().update().eq().mockResolvedValue({
        data: {},
        error: null,
      });

      await billingEngine.handlePaymentSuccess(paymentIntent);

      // Should update invoice status
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('subscription_invoices');
      // Should update subscription period
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('subscriptions');
    });

    it('should handle missing metadata', async () => {
      const paymentIntent = {
        id: 'pi_123',
        status: 'succeeded',
        metadata: {},
      };

      await expect(billingEngine.handlePaymentSuccess(paymentIntent)).rejects.toThrow('Missing subscription ID in payment metadata');
    });
  });

  describe('handlePaymentFailure', () => {
    it('should implement retry logic with exponential backoff', async () => {
      const paymentIntent = {
        id: 'pi_123',
        status: 'requires_payment_method',
        metadata: {
          subscriptionId: 'sub-123',
          retryCount: '0',
        },
      };

      mockSupabaseClient.from().select().eq().single().mockResolvedValue({
        data: mockSubscription,
        error: null,
      });

      mockStripe.paymentIntents.create.mockResolvedValue({
        id: 'pi_retry_123',
        status: 'requires_payment_method',
      });

      await billingEngine.handlePaymentFailure(paymentIntent);

      expect(mockStripe.paymentIntents.create).toHaveBeenCalled();
    });

    it('should cancel subscription after max retries', async () => {
      const paymentIntent = {
        id: 'pi_123',
        status: 'requires_payment_method',
        metadata: {
          subscriptionId: 'sub-123',
          retryCount: '3', // Max retries reached
        },
      };

      mockSupabaseClient.from().update().eq().mockResolvedValue({
        data: {},
        error: null,
      });

      await billingEngine.handlePaymentFailure(paymentIntent);

      // Should update subscription status to canceled
      expect(mockSupabaseClient.from().update).toHaveBeenCalledWith({
        status: 'canceled',
        updatedAt: expect.any(Date),
      });
    });
  });

  describe('calculateProration', () => {
    it('should calculate prorated amount for plan upgrade', () => {
      const currentPlan = { monthlyPrice: 29.99 };
      const newPlan = { monthlyPrice: 99.99 };
      const daysRemaining = 15; // Half month

      const result = billingEngine.calculateProration(
        mockSubscription,
        newPlan,
        daysRemaining
      );

      // Expected: (99.99 - 29.99) * (15/30) = 35.00
      expect(result.proratedAmount).toBeCloseTo(35.00, 2);
      expect(result.creditAmount).toBeCloseTo(15.00, 2);
      expect(result.upgradeAmount).toBeCloseTo(50.00, 2);
    });

    it('should handle annual billing cycles', () => {
      const annualSubscription = {
        ...mockSubscription,
        billingCycle: 'annual',
        plan: { annualPrice: 999.99 },
      };
      
      const newPlan = { annualPrice: 1999.99 };
      const daysRemaining = 183; // Half year

      const result = billingEngine.calculateProration(
        annualSubscription,
        newPlan,
        daysRemaining
      );

      expect(result.proratedAmount).toBeCloseTo(500.00, 2);
    });

    it('should return zero for same-day billing', () => {
      const result = billingEngine.calculateProration(
        mockSubscription,
        { monthlyPrice: 199.99 },
        0
      );

      expect(result.proratedAmount).toBe(0);
      expect(result.creditAmount).toBe(0);
      expect(result.upgradeAmount).toBe(0);
    });
  });

  describe('getRetryDelay', () => {
    it('should implement exponential backoff', () => {
      expect(billingEngine.getRetryDelay(0)).toBe(24 * 60 * 60 * 1000); // 1 day
      expect(billingEngine.getRetryDelay(1)).toBe(3 * 24 * 60 * 60 * 1000); // 3 days
      expect(billingEngine.getRetryDelay(2)).toBe(7 * 24 * 60 * 60 * 1000); // 7 days
    });

    it('should cap at maximum delay', () => {
      expect(billingEngine.getRetryDelay(10)).toBe(7 * 24 * 60 * 60 * 1000); // Still 7 days
    });
  });
});