// Mock environment variables
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_123';

// Mock Stripe
const mockStripe = {
  webhooks: {
    constructEvent: jest.fn(),
  },
};

jest.mock('stripe', () => jest.fn(() => mockStripe));

// Mock Supabase
const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
  })),
};

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => mockSupabaseClient,
}));

import { BillingEngine } from '@/lib/services/billing-engine';
import { SubscriptionService } from '@/lib/services/subscription-service';

describe('Webhook Processing Integration', () => {
  let billingEngine: BillingEngine;
  let subscriptionService: SubscriptionService;

  const mockSubscription = {
    id: 'sub-123',
    organizationId: 'org-123',
    planId: 'plan-123',
    status: 'active',
    billingCycle: 'monthly',
  };

  beforeEach(() => {
    billingEngine = new BillingEngine();
    subscriptionService = new SubscriptionService();
    jest.clearAllMocks();
  });

  describe('Stripe Webhook Events', () => {
    it('should process payment_intent.succeeded webhook', async () => {
      const webhookEvent = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_123',
            status: 'succeeded',
            amount: 9999,
            metadata: {
              subscriptionId: 'sub-123',
              organizationId: 'org-123',
            },
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(webhookEvent);

      // Mock subscription update
      mockSupabaseClient.from().update().eq().mockResolvedValue({
        data: { ...mockSubscription, status: 'active' },
        error: null,
      });

      // Mock invoice update
      mockSupabaseClient.from().update().eq().mockResolvedValue({
        data: { status: 'paid', paidAt: new Date() },
        error: null,
      });

      const result = await billingEngine.processWebhook(
        JSON.stringify(webhookEvent),
        'stripe-signature-123'
      );

      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
        JSON.stringify(webhookEvent),
        'stripe-signature-123',
        'whsec_test_123'
      );

      expect(result.processed).toBe(true);
      expect(result.eventType).toBe('payment_intent.succeeded');
    });

    it('should process payment_intent.payment_failed webhook', async () => {
      const webhookEvent = {
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: 'pi_failed_123',
            status: 'requires_payment_method',
            last_payment_error: {
              message: 'Your card was declined.',
            },
            metadata: {
              subscriptionId: 'sub-123',
              retryCount: '0',
            },
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(webhookEvent);

      // Mock subscription retrieval
      mockSupabaseClient.from().select().eq().single().mockResolvedValue({
        data: mockSubscription,
        error: null,
      });

      // Mock retry payment creation
      mockStripe.paymentIntents = {
        create: jest.fn().mockResolvedValue({
          id: 'pi_retry_123',
          status: 'requires_payment_method',
        }),
      };

      const result = await billingEngine.processWebhook(
        JSON.stringify(webhookEvent),
        'stripe-signature-123'
      );

      expect(result.processed).toBe(true);
      expect(result.eventType).toBe('payment_intent.payment_failed');
      expect(result.retryScheduled).toBe(true);
    });

    it('should process customer.subscription.deleted webhook', async () => {
      const webhookEvent = {
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'stripe_sub_123',
            status: 'canceled',
            metadata: {
              subscriptionId: 'sub-123',
            },
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(webhookEvent);

      // Mock subscription cancellation
      mockSupabaseClient.from().update().eq().mockResolvedValue({
        data: { ...mockSubscription, status: 'canceled' },
        error: null,
      });

      const result = await billingEngine.processWebhook(
        JSON.stringify(webhookEvent),
        'stripe-signature-123'
      );

      expect(mockSupabaseClient.from().update).toHaveBeenCalledWith({
        status: 'canceled',
        canceledAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });

      expect(result.processed).toBe(true);
    });

    it('should handle invalid webhook signatures', async () => {
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      await expect(
        billingEngine.processWebhook(
          '{"invalid": "payload"}',
          'invalid-signature'
        )
      ).rejects.toThrow('Invalid signature');
    });

    it('should handle unknown webhook events gracefully', async () => {
      const unknownEvent = {
        type: 'unknown.event.type',
        data: {
          object: {},
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(unknownEvent);

      const result = await billingEngine.processWebhook(
        JSON.stringify(unknownEvent),
        'stripe-signature-123'
      );

      expect(result.processed).toBe(false);
      expect(result.reason).toBe('Unhandled event type');
    });
  });

  describe('Recurring Billing Webhook Integration', () => {
    it('should process scheduled billing events', async () => {
      const billingEvent = {
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            id: 'in_123',
            status: 'paid',
            subscription: 'stripe_sub_123',
            amount_paid: 9999,
            metadata: {
              subscriptionId: 'sub-123',
            },
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(billingEvent);

      // Mock subscription period update
      mockSupabaseClient.from().update().eq().mockResolvedValue({
        data: {
          ...mockSubscription,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        error: null,
      });

      const result = await billingEngine.processWebhook(
        JSON.stringify(billingEvent),
        'stripe-signature-123'
      );

      expect(result.processed).toBe(true);
      expect(result.billingPeriodUpdated).toBe(true);
    });

    it('should handle dunning management for failed recurring payments', async () => {
      const failedRecurringEvent = {
        type: 'invoice.payment_failed',
        data: {
          object: {
            id: 'in_failed_123',
            status: 'open',
            subscription: 'stripe_sub_123',
            attempt_count: 1,
            metadata: {
              subscriptionId: 'sub-123',
            },
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(failedRecurringEvent);

      // Mock subscription status update to past_due
      mockSupabaseClient.from().update().eq().mockResolvedValue({
        data: { ...mockSubscription, status: 'past_due' },
        error: null,
      });

      const result = await billingEngine.processWebhook(
        JSON.stringify(failedRecurringEvent),
        'stripe-signature-123'
      );

      expect(mockSupabaseClient.from().update).toHaveBeenCalledWith({
        status: 'past_due',
        updatedAt: expect.any(Date),
      });

      expect(result.processed).toBe(true);
      expect(result.dunningTriggered).toBe(true);
    });
  });

  describe('Subscription Lifecycle Webhooks', () => {
    it('should handle subscription trial ending', async () => {
      const trialEndEvent = {
        type: 'customer.subscription.trial_will_end',
        data: {
          object: {
            id: 'stripe_sub_123',
            status: 'trialing',
            trial_end: Math.floor(Date.now() / 1000) + 86400, // 1 day from now
            metadata: {
              subscriptionId: 'sub-123',
            },
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(trialEndEvent);

      // Mock notification service
      const mockNotificationService = {
        sendTrialEndingNotification: jest.fn(),
      };

      const result = await billingEngine.processWebhook(
        JSON.stringify(trialEndEvent),
        'stripe-signature-123'
      );

      expect(result.processed).toBe(true);
      expect(result.notificationSent).toBe(true);
    });

    it('should handle subscription updates from Stripe dashboard', async () => {
      const subscriptionUpdateEvent = {
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'stripe_sub_123',
            status: 'active',
            current_period_start: Math.floor(Date.now() / 1000),
            current_period_end: Math.floor(Date.now() / 1000) + 2592000, // 30 days
            metadata: {
              subscriptionId: 'sub-123',
            },
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(subscriptionUpdateEvent);

      // Mock subscription sync
      mockSupabaseClient.from().update().eq().mockResolvedValue({
        data: {
          ...mockSubscription,
          currentPeriodStart: new Date(subscriptionUpdateEvent.data.object.current_period_start * 1000),
          currentPeriodEnd: new Date(subscriptionUpdateEvent.data.object.current_period_end * 1000),
        },
        error: null,
      });

      const result = await billingEngine.processWebhook(
        JSON.stringify(subscriptionUpdateEvent),
        'stripe-signature-123'
      );

      expect(result.processed).toBe(true);
      expect(result.subscriptionSynced).toBe(true);
    });
  });

  describe('Error Handling and Idempotency', () => {
    it('should handle duplicate webhook events idempotently', async () => {
      const duplicateEvent = {
        id: 'evt_duplicate_123',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_123',
            status: 'succeeded',
            metadata: {
              subscriptionId: 'sub-123',
            },
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(duplicateEvent);

      // Mock webhook event tracking
      mockSupabaseClient.from().select().eq().single()
        .mockResolvedValueOnce({
          data: { id: 'evt_duplicate_123', processed: true },
          error: null,
        });

      const result = await billingEngine.processWebhook(
        JSON.stringify(duplicateEvent),
        'stripe-signature-123'
      );

      expect(result.processed).toBe(false);
      expect(result.reason).toBe('Event already processed');
    });

    it('should handle database errors during webhook processing', async () => {
      const webhookEvent = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_123',
            status: 'succeeded',
            metadata: {
              subscriptionId: 'sub-123',
            },
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(webhookEvent);

      // Mock database error
      mockSupabaseClient.from().update().eq().mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      });

      await expect(
        billingEngine.processWebhook(
          JSON.stringify(webhookEvent),
          'stripe-signature-123'
        )
      ).rejects.toThrow('Database connection failed');
    });
  });
});