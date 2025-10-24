// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';
process.env.STRIPE_SECRET_KEY = 'sk_test_123';

// Mock Stripe
const mockStripe = {
  paymentIntents: {
    create: jest.fn(),
    confirm: jest.fn(),
  },
  customers: {
    create: jest.fn(),
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
  auth: {
    getUser: jest.fn(),
  },
};

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => mockSupabaseClient,
}));

import { SubscriptionService } from '@/lib/services/subscription-service';
import { PlanManager } from '@/lib/services/plan-manager';
import { BillingEngine } from '@/lib/services/billing-engine';

describe('Subscription Signup Integration', () => {
  let subscriptionService: SubscriptionService;
  let planManager: PlanManager;
  let billingEngine: BillingEngine;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  };

  const mockOrganization = {
    id: 'org-123',
    name: 'Test Organization',
  };

  const mockPlan = {
    id: 'plan-123',
    name: 'Pro Plan',
    monthlyPrice: 99.99,
    features: {
      maxClients: 10,
      maxCampaigns: 50,
      advancedAnalytics: true,
      customReports: true,
      apiAccess: true,
      whiteLabel: false,
      prioritySupport: true,
    },
  };

  beforeEach(() => {
    subscriptionService = new SubscriptionService();
    planManager = new PlanManager();
    billingEngine = new BillingEngine();
    jest.clearAllMocks();

    // Mock user authentication
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
  });

  describe('Complete Subscription Signup Process', () => {
    it('should successfully create subscription with payment', async () => {
      // Mock plan retrieval
      mockSupabaseClient.from().select().eq().single().mockResolvedValueOnce({
        data: mockPlan,
        error: null,
      });

      // Mock Stripe customer creation
      mockStripe.customers.create.mockResolvedValue({
        id: 'cus_123',
        email: 'test@example.com',
      });

      // Mock payment intent creation
      mockStripe.paymentIntents.create.mockResolvedValue({
        id: 'pi_123',
        status: 'requires_payment_method',
        client_secret: 'pi_123_secret_123',
        amount: 9999,
      });

      // Mock subscription creation
      const mockSubscription = {
        id: 'sub-123',
        organizationId: 'org-123',
        planId: 'plan-123',
        status: 'active',
        billingCycle: 'monthly',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };

      mockSupabaseClient.from().insert().single().mockResolvedValue({
        data: mockSubscription,
        error: null,
      });

      // Execute subscription creation
      const result = await subscriptionService.createSubscription({
        organizationId: 'org-123',
        planId: 'plan-123',
        billingCycle: 'monthly',
        paymentMethodId: 'pm_123',
      });

      // Verify the complete flow
      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email: 'test@example.com',
        metadata: {
          organizationId: 'org-123',
          userId: 'user-123',
        },
      });

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: 9999,
        currency: 'usd',
        customer: 'cus_123',
        payment_method: 'pm_123',
        confirmation_method: 'manual',
        confirm: true,
        metadata: {
          subscriptionId: expect.any(String),
          organizationId: 'org-123',
        },
      });

      expect(result.subscription).toEqual(mockSubscription);
      expect(result.paymentIntent).toBeDefined();
    });

    it('should handle payment failure during signup', async () => {
      // Mock plan retrieval
      mockSupabaseClient.from().select().eq().single().mockResolvedValueOnce({
        data: mockPlan,
        error: null,
      });

      // Mock Stripe customer creation
      mockStripe.customers.create.mockResolvedValue({
        id: 'cus_123',
        email: 'test@example.com',
      });

      // Mock payment intent failure
      mockStripe.paymentIntents.create.mockRejectedValue(
        new Error('Your card was declined.')
      );

      // Execute subscription creation
      await expect(
        subscriptionService.createSubscription({
          organizationId: 'org-123',
          planId: 'plan-123',
          billingCycle: 'monthly',
          paymentMethodId: 'pm_invalid',
        })
      ).rejects.toThrow('Your card was declined.');

      // Verify no subscription was created
      expect(mockSupabaseClient.from().insert).not.toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'active',
        })
      );
    });

    it('should handle invalid plan selection', async () => {
      // Mock plan not found
      mockSupabaseClient.from().select().eq().single().mockResolvedValue({
        data: null,
        error: { message: 'Plan not found' },
      });

      await expect(
        subscriptionService.createSubscription({
          organizationId: 'org-123',
          planId: 'nonexistent-plan',
          billingCycle: 'monthly',
          paymentMethodId: 'pm_123',
        })
      ).rejects.toThrow('Plan not found');
    });

    it('should create trial subscription without payment', async () => {
      // Mock plan retrieval
      mockSupabaseClient.from().select().eq().single().mockResolvedValueOnce({
        data: { ...mockPlan, trialDays: 14 },
        error: null,
      });

      // Mock trial subscription creation
      const mockTrialSubscription = {
        id: 'sub-trial-123',
        organizationId: 'org-123',
        planId: 'plan-123',
        status: 'trialing',
        billingCycle: 'monthly',
        trialEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      };

      mockSupabaseClient.from().insert().single().mockResolvedValue({
        data: mockTrialSubscription,
        error: null,
      });

      const result = await subscriptionService.createTrialSubscription({
        organizationId: 'org-123',
        planId: 'plan-123',
        billingCycle: 'monthly',
      });

      expect(result.status).toBe('trialing');
      expect(result.trialEnd).toBeDefined();
      expect(mockStripe.paymentIntents.create).not.toHaveBeenCalled();
    });
  });

  describe('Subscription Upgrade/Downgrade Flow', () => {
    const currentSubscription = {
      id: 'sub-123',
      organizationId: 'org-123',
      planId: 'basic-plan',
      status: 'active',
      billingCycle: 'monthly',
      currentPeriodStart: new Date('2024-01-01'),
      currentPeriodEnd: new Date('2024-02-01'),
      plan: {
        monthlyPrice: 29.99,
      },
    };

    it('should successfully upgrade subscription with prorated billing', async () => {
      // Mock current subscription retrieval
      mockSupabaseClient.from().select().eq().single()
        .mockResolvedValueOnce({
          data: currentSubscription,
          error: null,
        })
        // Mock new plan retrieval
        .mockResolvedValueOnce({
          data: mockPlan,
          error: null,
        });

      // Mock proration calculation
      const prorationAmount = 35.00; // Calculated based on remaining days
      
      // Mock payment intent for upgrade
      mockStripe.paymentIntents.create.mockResolvedValue({
        id: 'pi_upgrade_123',
        status: 'succeeded',
        amount: 3500, // $35.00 in cents
      });

      // Mock subscription update
      mockSupabaseClient.from().update().eq().mockResolvedValue({
        data: { ...currentSubscription, planId: 'plan-123' },
        error: null,
      });

      const result = await subscriptionService.upgradeSubscription(
        'sub-123',
        'plan-123'
      );

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: 3500,
        currency: 'usd',
        automatic_payment_methods: { enabled: true },
        metadata: {
          subscriptionId: 'sub-123',
          upgradeType: 'plan_change',
          prorationAmount: '35.00',
        },
      });

      expect(result.prorationAmount).toBe(prorationAmount);
    });

    it('should handle downgrade with credit application', async () => {
      const premiumSubscription = {
        ...currentSubscription,
        planId: 'premium-plan',
        plan: { monthlyPrice: 199.99 },
      };

      // Mock current subscription retrieval
      mockSupabaseClient.from().select().eq().single()
        .mockResolvedValueOnce({
          data: premiumSubscription,
          error: null,
        })
        // Mock new plan retrieval
        .mockResolvedValueOnce({
          data: mockPlan, // Downgrading to Pro from Premium
          error: null,
        });

      // Mock subscription update
      mockSupabaseClient.from().update().eq().mockResolvedValue({
        data: { ...premiumSubscription, planId: 'plan-123' },
        error: null,
      });

      const result = await subscriptionService.upgradeSubscription(
        'sub-123',
        'plan-123'
      );

      // Should not create payment intent for downgrades
      expect(mockStripe.paymentIntents.create).not.toHaveBeenCalled();
      expect(result.creditAmount).toBeGreaterThan(0);
    });
  });

  describe('Payment Failure and Recovery', () => {
    it('should handle payment failure with retry logic', async () => {
      const failedPaymentIntent = {
        id: 'pi_failed_123',
        status: 'requires_payment_method',
        metadata: {
          subscriptionId: 'sub-123',
          retryCount: '0',
        },
      };

      // Mock subscription retrieval
      mockSupabaseClient.from().select().eq().single().mockResolvedValue({
        data: currentSubscription,
        error: null,
      });

      // Mock retry payment creation
      mockStripe.paymentIntents.create.mockResolvedValue({
        id: 'pi_retry_123',
        status: 'requires_payment_method',
        metadata: {
          subscriptionId: 'sub-123',
          retryCount: '1',
        },
      });

      await billingEngine.handlePaymentFailure(failedPaymentIntent);

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: expect.any(Number),
        currency: 'usd',
        automatic_payment_methods: { enabled: true },
        metadata: {
          subscriptionId: 'sub-123',
          retryCount: '1',
          retryAttempt: 'true',
        },
      });
    });

    it('should cancel subscription after maximum retry attempts', async () => {
      const maxRetriesPaymentIntent = {
        id: 'pi_max_retries_123',
        status: 'requires_payment_method',
        metadata: {
          subscriptionId: 'sub-123',
          retryCount: '3', // Maximum retries reached
        },
      };

      // Mock subscription update to canceled
      mockSupabaseClient.from().update().eq().mockResolvedValue({
        data: { ...currentSubscription, status: 'canceled' },
        error: null,
      });

      await billingEngine.handlePaymentFailure(maxRetriesPaymentIntent);

      expect(mockSupabaseClient.from().update).toHaveBeenCalledWith({
        status: 'canceled',
        updatedAt: expect.any(Date),
      });

      // Should not create another retry payment
      expect(mockStripe.paymentIntents.create).not.toHaveBeenCalled();
    });

    it('should recover subscription after successful payment retry', async () => {
      const successfulRetryIntent = {
        id: 'pi_success_retry_123',
        status: 'succeeded',
        metadata: {
          subscriptionId: 'sub-123',
          retryAttempt: 'true',
        },
      };

      // Mock subscription update to active
      mockSupabaseClient.from().update().eq().mockResolvedValue({
        data: { ...currentSubscription, status: 'active' },
        error: null,
      });

      await billingEngine.handlePaymentSuccess(successfulRetryIntent);

      expect(mockSupabaseClient.from().update).toHaveBeenCalledWith({
        status: 'active',
        currentPeriodStart: expect.any(Date),
        currentPeriodEnd: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });
  });
});