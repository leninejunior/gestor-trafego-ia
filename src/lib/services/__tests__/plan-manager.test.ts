// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
  })),
};

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => mockSupabaseClient,
}));

import { PlanManager } from '../plan-manager';
import { CreatePlanRequest, PlanFeatures, SubscriptionPlan } from '@/lib/types/subscription-plans';

describe('PlanManager', () => {
  let planManager: PlanManager;
  
  const mockPlanFeatures: PlanFeatures = {
    maxClients: 10,
    maxCampaigns: 50,
    advancedAnalytics: true,
    customReports: true,
    apiAccess: true,
    whiteLabel: false,
    prioritySupport: true,
  };

  const mockPlan: SubscriptionPlan = {
    id: 'plan-123',
    name: 'Pro Plan',
    description: 'Professional plan with advanced features',
    monthlyPrice: 99.99,
    annualPrice: 999.99,
    features: mockPlanFeatures,
    maxClients: 10,
    maxCampaigns: 50,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCreatePlanRequest: CreatePlanRequest = {
    name: 'Pro Plan',
    description: 'Professional plan with advanced features',
    monthlyPrice: 99.99,
    annualPrice: 999.99,
    features: mockPlanFeatures,
    maxClients: 10,
    maxCampaigns: 50,
    isActive: true,
  };

  beforeEach(() => {
    planManager = new PlanManager();
    jest.clearAllMocks();
  });

  describe('getAvailablePlans', () => {
    it('should return active plans only', async () => {
      const mockPlans = [mockPlan, { ...mockPlan, id: 'plan-456', isActive: false }];
      mockSupabaseClient.from().select().mockResolvedValue({
        data: mockPlans.filter(p => p.isActive),
        error: null,
      });

      const result = await planManager.getAvailablePlans();

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('subscription_plans');
      expect(result).toHaveLength(1);
      expect(result[0].isActive).toBe(true);
    });

    it('should handle database errors', async () => {
      mockSupabaseClient.from().select().mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      await expect(planManager.getAvailablePlans()).rejects.toThrow('Database error');
    });
  });

  describe('createPlan', () => {
    it('should create a new plan successfully', async () => {
      mockSupabaseClient.from().insert().single().mockResolvedValue({
        data: mockPlan,
        error: null,
      });

      const result = await planManager.createPlan(mockCreatePlanRequest);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('subscription_plans');
      expect(result).toEqual(mockPlan);
    });

    it('should validate plan data before creation', async () => {
      const invalidPlan = { ...mockCreatePlanRequest, monthlyPrice: -10 };

      await expect(planManager.createPlan(invalidPlan)).rejects.toThrow();
    });
  });

  describe('calculateUpgradeProration', () => {
    const basicPlan: SubscriptionPlan = {
      ...mockPlan,
      id: 'basic-plan',
      monthlyPrice: 29.99,
      annualPrice: 299.99,
    };

    const proPlan: SubscriptionPlan = {
      ...mockPlan,
      id: 'pro-plan',
      monthlyPrice: 99.99,
      annualPrice: 999.99,
    };

    it('should calculate monthly upgrade proration correctly', () => {
      const daysRemaining = 15; // Half month remaining
      const result = planManager.calculateUpgradeProration(basicPlan, proPlan, 'monthly', daysRemaining);

      // Expected: (99.99 - 29.99) * (15/30) = 35.00
      expect(result.proratedAmount).toBeCloseTo(35.00, 2);
      expect(result.creditAmount).toBeCloseTo(15.00, 2); // 29.99 * (15/30)
      expect(result.upgradeAmount).toBeCloseTo(50.00, 2); // 99.99 * (15/30)
    });

    it('should calculate annual upgrade proration correctly', () => {
      const daysRemaining = 183; // Half year remaining
      const result = planManager.calculateUpgradeProration(basicPlan, proPlan, 'annual', daysRemaining);

      // Expected: (999.99 - 299.99) * (183/365) = 350.50
      expect(result.proratedAmount).toBeCloseTo(350.50, 2);
    });

    it('should handle downgrade scenarios', () => {
      const daysRemaining = 15;
      const result = planManager.calculateUpgradeProration(proPlan, basicPlan, 'monthly', daysRemaining);

      expect(result.proratedAmount).toBeLessThan(0); // Should be negative for downgrades
    });

    it('should handle zero days remaining', () => {
      const result = planManager.calculateUpgradeProration(basicPlan, proPlan, 'monthly', 0);

      expect(result.proratedAmount).toBe(0);
      expect(result.creditAmount).toBe(0);
      expect(result.upgradeAmount).toBe(0);
    });
  });

  describe('validatePlanFeatures', () => {
    it('should validate valid plan features', () => {
      const validFeatures: PlanFeatures = {
        maxClients: 10,
        maxCampaigns: 50,
        advancedAnalytics: true,
        customReports: true,
        apiAccess: true,
        whiteLabel: false,
        prioritySupport: true,
      };

      expect(() => planManager.validatePlanFeatures(validFeatures)).not.toThrow();
    });

    it('should reject invalid feature limits', () => {
      const invalidFeatures = {
        ...mockPlanFeatures,
        maxClients: -1,
      };

      expect(() => planManager.validatePlanFeatures(invalidFeatures)).toThrow();
    });
  });

  describe('getPlanById', () => {
    it('should return plan by ID', async () => {
      mockSupabaseClient.from().select().eq().single().mockResolvedValue({
        data: mockPlan,
        error: null,
      });

      const result = await planManager.getPlanById('plan-123');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('subscription_plans');
      expect(result).toEqual(mockPlan);
    });

    it('should handle plan not found', async () => {
      mockSupabaseClient.from().select().eq().single().mockResolvedValue({
        data: null,
        error: { message: 'Plan not found' },
      });

      await expect(planManager.getPlanById('nonexistent')).rejects.toThrow('Plan not found');
    });
  });
});