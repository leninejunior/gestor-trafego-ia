process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';
process.env.STRIPE_SECRET_KEY = 'sk_mock_123';

const mockQueryBuilder: any = {
  select: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  eq: jest.fn(),
  single: jest.fn(),
};

const mockSupabaseClient: any = {
  from: jest.fn(),
  auth: {
    getUser: jest.fn(),
  },
};

const mockNotificationIntegration = {
  handleSubscriptionConfirmation: jest.fn(),
  handlePlanUpgrade: jest.fn(),
  handlePaymentFailure: jest.fn(),
};

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => mockSupabaseClient),
}));

jest.mock('@/lib/services/subscription-notification-integration', () => ({
  SubscriptionNotificationIntegration: jest.fn(() => mockNotificationIntegration),
}));

import { SubscriptionService } from '@/lib/services/subscription-service';
import { PlanManager } from '@/lib/services/plan-manager';

describe('Subscription Signup Integration', () => {
  let subscriptionService: SubscriptionService;

  const activePlan = {
    id: 'plan-pro',
    name: 'Pro Plan',
    is_active: true,
    monthly_price: 99.99,
    annual_price: 999.99,
    features: [],
  };

  const baseDbSubscription = {
    id: 'sub-123',
    organization_id: 'org-123',
    plan_id: 'plan-pro',
    status: 'active',
    billing_cycle: 'monthly',
    current_period_start: '2026-02-01T00:00:00.000Z',
    current_period_end: '2026-03-01T00:00:00.000Z',
    trial_end: null,
    payment_method_id: 'pm_123',
    stripe_subscription_id: null,
    stripe_customer_id: null,
    created_at: '2026-02-01T00:00:00.000Z',
    updated_at: '2026-02-01T00:00:00.000Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockQueryBuilder.select.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.insert.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.update.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.eq.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.single.mockReset();

    mockSupabaseClient.from.mockReturnValue(mockQueryBuilder);
    mockNotificationIntegration.handleSubscriptionConfirmation.mockResolvedValue(undefined);
    mockNotificationIntegration.handlePlanUpgrade.mockResolvedValue(undefined);
    mockNotificationIntegration.handlePaymentFailure.mockResolvedValue(undefined);

    subscriptionService = new SubscriptionService();
  });

  it('creates an active subscription when plan is valid and no active subscription exists', async () => {
    jest.spyOn(PlanManager.prototype, 'getPlanById').mockResolvedValue(activePlan);
    jest.spyOn(subscriptionService, 'getActiveSubscription').mockResolvedValue(null);
    mockQueryBuilder.single.mockResolvedValueOnce({
      data: baseDbSubscription,
      error: null,
    });

    const result = await subscriptionService.createSubscription({
      organization_id: 'org-123',
      plan_id: 'plan-pro',
      billing_cycle: 'monthly',
      payment_method_id: 'pm_123',
    });

    expect(mockSupabaseClient.from).toHaveBeenCalledWith('subscriptions');
    expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: 'org-123',
        plan_id: 'plan-pro',
        status: 'active',
        billing_cycle: 'monthly',
      })
    );
    expect(mockNotificationIntegration.handleSubscriptionConfirmation).toHaveBeenCalledWith(
      'sub-123',
      'plan-pro',
      'org-123'
    );
    expect(result.id).toBe('sub-123');
    expect(result.organization_id).toBe('org-123');
    expect(result.plan_id).toBe('plan-pro');
    expect(result.status).toBe('active');
  });

  it('creates a trial subscription when trial_days is informed', async () => {
    jest.spyOn(PlanManager.prototype, 'getPlanById').mockResolvedValue(activePlan);
    jest.spyOn(subscriptionService, 'getActiveSubscription').mockResolvedValue(null);

    mockQueryBuilder.single.mockResolvedValueOnce({
      data: {
        ...baseDbSubscription,
        id: 'sub-trial-123',
        status: 'trialing',
        trial_end: '2026-02-15T00:00:00.000Z',
      },
      error: null,
    });

    const result = await subscriptionService.createSubscription({
      organization_id: 'org-123',
      plan_id: 'plan-pro',
      billing_cycle: 'monthly',
      trial_days: 14,
    });

    expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'trialing',
      })
    );
    expect(result.status).toBe('trialing');
    expect(result.trial_end).toBe('2026-02-15T00:00:00.000Z');
  });

  it('throws when plan is invalid or inactive', async () => {
    jest.spyOn(PlanManager.prototype, 'getPlanById').mockResolvedValue(null);

    await expect(
      subscriptionService.createSubscription({
        organization_id: 'org-123',
        plan_id: 'plan-missing',
        billing_cycle: 'monthly',
      })
    ).rejects.toThrow('Invalid or inactive subscription plan');

    expect(mockSupabaseClient.from).not.toHaveBeenCalled();
  });

  it('upgrades subscription and returns proration payload', async () => {
    const currentSubscription = {
      id: 'sub-123',
      organization_id: 'org-123',
      plan_id: 'plan-basic',
      status: 'active',
      billing_cycle: 'monthly' as const,
      current_period_start: '2026-02-01T00:00:00.000Z',
      current_period_end: '2026-03-01T00:00:00.000Z',
      trial_end: null,
      payment_method_id: 'pm_123',
      stripe_subscription_id: null,
      stripe_customer_id: null,
      created_at: '2026-02-01T00:00:00.000Z',
      updated_at: '2026-02-01T00:00:00.000Z',
    };

    const expectedProration = {
      current_plan_cost: 20,
      new_plan_cost: 45,
      prorated_amount: 25,
      days_remaining: 15,
      effective_date: '2026-02-15T00:00:00.000Z',
    };

    jest.spyOn(subscriptionService, 'getSubscriptionById').mockResolvedValue(currentSubscription);
    jest.spyOn(PlanManager.prototype, 'getPlanById').mockResolvedValue(activePlan);
    jest.spyOn(subscriptionService as any, 'calculateProration').mockResolvedValue(expectedProration);

    mockQueryBuilder.single.mockResolvedValueOnce({
      data: {
        ...baseDbSubscription,
        plan_id: 'plan-pro',
      },
      error: null,
    });

    const result = await subscriptionService.upgradeSubscription('sub-123', 'plan-pro');

    expect(mockSupabaseClient.from).toHaveBeenCalledWith('subscriptions');
    expect(mockQueryBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        plan_id: 'plan-pro',
      })
    );
    expect(result.subscription.plan_id).toBe('plan-pro');
    expect(result.proration).toEqual(expectedProration);
    expect(mockNotificationIntegration.handlePlanUpgrade).toHaveBeenCalled();
  });
});
