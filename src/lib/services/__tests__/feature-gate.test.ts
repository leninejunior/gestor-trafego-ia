// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
  })),
};

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => mockSupabaseClient,
}));

import { FeatureGateService } from '../feature-gate';
import { PlanFeatures } from '@/lib/types/subscription-plans';

describe('FeatureGateService', () => {
  let featureGate: FeatureGateService;
  
  const mockPlanFeatures: PlanFeatures = {
    maxClients: 10,
    maxCampaigns: 50,
    advancedAnalytics: true,
    customReports: true,
    apiAccess: true,
    whiteLabel: false,
    prioritySupport: true,
  };

  const mockSubscription = {
    id: 'sub-123',
    organizationId: 'org-123',
    planId: 'plan-123',
    status: 'active',
    plan: {
      features: mockPlanFeatures,
    },
  };

  beforeEach(() => {
    featureGate = new FeatureGateService();
    jest.clearAllMocks();
  });

  describe('checkFeatureAccess', () => {
    it('should allow access to enabled features', async () => {
      mockSupabaseClient.from().select().eq().single().mockResolvedValue({
        data: mockSubscription,
        error: null,
      });

      const result = await featureGate.checkFeatureAccess('org-123', 'advancedAnalytics');

      expect(result.hasAccess).toBe(true);
      expect(result.reason).toBe('Feature included in current plan');
    });

    it('should deny access to disabled features', async () => {
      mockSupabaseClient.from().select().eq().single().mockResolvedValue({
        data: mockSubscription,
        error: null,
      });

      const result = await featureGate.checkFeatureAccess('org-123', 'whiteLabel');

      expect(result.hasAccess).toBe(false);
      expect(result.reason).toBe('Feature not included in current plan');
    });

    it('should deny access for inactive subscriptions', async () => {
      const inactiveSubscription = {
        ...mockSubscription,
        status: 'canceled',
      };

      mockSupabaseClient.from().select().eq().single().mockResolvedValue({
        data: inactiveSubscription,
        error: null,
      });

      const result = await featureGate.checkFeatureAccess('org-123', 'advancedAnalytics');

      expect(result.hasAccess).toBe(false);
      expect(result.reason).toBe('Subscription is not active');
    });

    it('should deny access when no subscription found', async () => {
      mockSupabaseClient.from().select().eq().single().mockResolvedValue({
        data: null,
        error: { message: 'No subscription found' },
      });

      const result = await featureGate.checkFeatureAccess('org-123', 'advancedAnalytics');

      expect(result.hasAccess).toBe(false);
      expect(result.reason).toBe('No active subscription found');
    });
  });

  describe('checkUsageLimit', () => {
    it('should allow usage within limits', async () => {
      // Mock subscription check
      mockSupabaseClient.from().select().eq().single()
        .mockResolvedValueOnce({
          data: mockSubscription,
          error: null,
        })
        // Mock usage check
        .mockResolvedValueOnce({
          data: { usage_count: 5 },
          error: null,
        });

      const result = await featureGate.checkUsageLimit('org-123', 'clients');

      expect(result.withinLimit).toBe(true);
      expect(result.currentUsage).toBe(5);
      expect(result.limit).toBe(10);
    });

    it('should deny usage when limit exceeded', async () => {
      // Mock subscription check
      mockSupabaseClient.from().select().eq().single()
        .mockResolvedValueOnce({
          data: mockSubscription,
          error: null,
        })
        // Mock usage check
        .mockResolvedValueOnce({
          data: { usage_count: 15 },
          error: null,
        });

      const result = await featureGate.checkUsageLimit('org-123', 'clients');

      expect(result.withinLimit).toBe(false);
      expect(result.currentUsage).toBe(15);
      expect(result.limit).toBe(10);
    });

    it('should handle zero usage', async () => {
      // Mock subscription check
      mockSupabaseClient.from().select().eq().single()
        .mockResolvedValueOnce({
          data: mockSubscription,
          error: null,
        })
        // Mock usage check - no usage record found
        .mockResolvedValueOnce({
          data: null,
          error: null,
        });

      const result = await featureGate.checkUsageLimit('org-123', 'clients');

      expect(result.withinLimit).toBe(true);
      expect(result.currentUsage).toBe(0);
      expect(result.limit).toBe(10);
    });
  });

  describe('incrementUsage', () => {
    it('should increment usage count', async () => {
      mockSupabaseClient.from().upsert().mockResolvedValue({
        data: { usage_count: 6 },
        error: null,
      });

      await featureGate.incrementUsage('org-123', 'clients');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('feature_usage');
      expect(mockSupabaseClient.from().upsert).toHaveBeenCalled();
    });

    it('should handle database errors during increment', async () => {
      mockSupabaseClient.from().upsert().mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      await expect(featureGate.incrementUsage('org-123', 'clients')).rejects.toThrow('Database error');
    });
  });

  describe('getFeatureMatrix', () => {
    it('should return feature matrix for plan', async () => {
      mockSupabaseClient.from().select().eq().single().mockResolvedValue({
        data: { features: mockPlanFeatures },
        error: null,
      });

      const result = await featureGate.getFeatureMatrix('plan-123');

      expect(result).toEqual(mockPlanFeatures);
    });

    it('should handle plan not found', async () => {
      mockSupabaseClient.from().select().eq().single().mockResolvedValue({
        data: null,
        error: { message: 'Plan not found' },
      });

      await expect(featureGate.getFeatureMatrix('nonexistent')).rejects.toThrow('Plan not found');
    });
  });

  describe('validateFeatureKey', () => {
    it('should validate known feature keys', () => {
      expect(() => featureGate.validateFeatureKey('advancedAnalytics')).not.toThrow();
      expect(() => featureGate.validateFeatureKey('customReports')).not.toThrow();
      expect(() => featureGate.validateFeatureKey('apiAccess')).not.toThrow();
    });

    it('should reject unknown feature keys', () => {
      expect(() => featureGate.validateFeatureKey('unknownFeature')).toThrow('Invalid feature key');
    });
  });

  describe('getUsageLimitForFeature', () => {
    it('should return correct limits for usage-based features', () => {
      expect(featureGate.getUsageLimitForFeature('clients', mockPlanFeatures)).toBe(10);
      expect(featureGate.getUsageLimitForFeature('campaigns', mockPlanFeatures)).toBe(50);
    });

    it('should return unlimited for boolean features', () => {
      expect(featureGate.getUsageLimitForFeature('advancedAnalytics', mockPlanFeatures)).toBe(-1);
      expect(featureGate.getUsageLimitForFeature('customReports', mockPlanFeatures)).toBe(-1);
    });

    it('should handle disabled boolean features', () => {
      const disabledFeatures = { ...mockPlanFeatures, whiteLabel: false };
      expect(featureGate.getUsageLimitForFeature('whiteLabel', disabledFeatures)).toBe(0);
    });
  });
});