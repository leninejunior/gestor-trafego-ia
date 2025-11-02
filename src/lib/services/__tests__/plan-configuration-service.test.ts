/**
 * Unit Tests for PlanConfigurationService
 * Tests plan limits management, validation, and user permissions
 */

import { PlanConfigurationService } from '../plan-configuration-service';
import { DEFAULT_PLAN_LIMITS } from '@/lib/types/plan-limits';

// Mock Supabase client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(),
          })),
        })),
      })),
    })),
  })),
}));

describe('PlanConfigurationService', () => {
  let service: PlanConfigurationService;
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PlanConfigurationService();
    
    // Get mock supabase instance
    const { createClient } = require('@/lib/supabase/server');
    mockSupabase = createClient();
  });

  describe('getPlanLimits', () => {
    it('should return plan limits when they exist', async () => {
      const mockLimits = {
        id: 'limit-1',
        plan_id: 'plan-1',
        ...DEFAULT_PLAN_LIMITS,
      };

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: mockLimits,
        error: null,
      });

      const result = await service.getPlanLimits('plan-1');

      expect(result).toEqual(mockLimits);
      expect(mockSupabase.from).toHaveBeenCalledWith('plan_limits');
    });

    it('should return null when plan limits do not exist', async () => {
      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      const result = await service.getPlanLimits('plan-1');

      expect(result).toBeNull();
    });

    it('should throw error on database failure', async () => {
      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: null,
        error: { message: 'Database error', code: 'ERROR' },
      });

      await expect(service.getPlanLimits('plan-1')).rejects.toThrow(
        'Erro ao buscar limites do plano'
      );
    });
  });

  describe('createPlanLimits', () => {
    it('should create plan limits with default values', async () => {
      const mockCreated = {
        id: 'limit-1',
        plan_id: 'plan-1',
        ...DEFAULT_PLAN_LIMITS,
      };

      mockSupabase.from().insert().select().single.mockResolvedValue({
        data: mockCreated,
        error: null,
      });

      const result = await service.createPlanLimits('plan-1');

      expect(result).toEqual(mockCreated);
      expect(mockSupabase.from).toHaveBeenCalledWith('plan_limits');
    });

    it('should create plan limits with custom values', async () => {
      const customLimits = {
        max_clients: 10,
        data_retention_days: 180,
      };

      const mockCreated = {
        id: 'limit-1',
        plan_id: 'plan-1',
        ...DEFAULT_PLAN_LIMITS,
        ...customLimits,
      };

      mockSupabase.from().insert().select().single.mockResolvedValue({
        data: mockCreated,
        error: null,
      });

      const result = await service.createPlanLimits('plan-1', customLimits);

      expect(result.max_clients).toBe(10);
      expect(result.data_retention_days).toBe(180);
    });

    it('should throw error on validation failure', async () => {
      const invalidLimits = {
        data_retention_days: 10, // Below minimum of 30
      };

      await expect(
        service.createPlanLimits('plan-1', invalidLimits)
      ).rejects.toThrow('Validação falhou');
    });
  });

  describe('updatePlanLimits', () => {
    it('should update existing plan limits', async () => {
      const existingLimits = {
        id: 'limit-1',
        plan_id: 'plan-1',
        ...DEFAULT_PLAN_LIMITS,
      };

      const updates = {
        max_clients: 20,
        allow_csv_export: true,
      };

      // Mock getPlanLimits
      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: existingLimits,
        error: null,
      });

      // Mock update
      mockSupabase.from().update().eq().select().single.mockResolvedValue({
        data: { ...existingLimits, ...updates },
        error: null,
      });

      const result = await service.updatePlanLimits('plan-1', updates);

      expect(result.max_clients).toBe(20);
      expect(result.allow_csv_export).toBe(true);
    });

    it('should create plan limits if they do not exist', async () => {
      const updates = {
        max_clients: 15,
      };

      // Mock getPlanLimits returning null
      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      // Mock insert
      mockSupabase.from().insert().select().single.mockResolvedValue({
        data: {
          id: 'limit-1',
          plan_id: 'plan-1',
          ...DEFAULT_PLAN_LIMITS,
          ...updates,
        },
        error: null,
      });

      const result = await service.updatePlanLimits('plan-1', updates);

      expect(result.max_clients).toBe(15);
    });
  });

  describe('validateLimits', () => {
    it('should validate correct plan limits', async () => {
      const validLimits = {
        plan_id: 'plan-1',
        ...DEFAULT_PLAN_LIMITS,
      };

      const result = await service.validateLimits(validLimits);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should reject invalid data_retention_days', async () => {
      const invalidLimits = {
        plan_id: 'plan-1',
        data_retention_days: 10, // Below minimum
      };

      const result = await service.validateLimits(invalidLimits);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0]).toContain('data_retention_days');
    });

    it('should reject invalid sync_interval_hours', async () => {
      const invalidLimits = {
        plan_id: 'plan-1',
        sync_interval_hours: 200, // Above maximum
      };

      const result = await service.validateLimits(invalidLimits);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should accept unlimited values (-1)', async () => {
      const unlimitedLimits = {
        plan_id: 'plan-1',
        max_clients: -1,
        max_campaigns_per_client: -1,
      };

      const result = await service.validateLimits(unlimitedLimits);

      expect(result.valid).toBe(true);
    });
  });

  describe('getUserPlanLimits', () => {
    it('should return limits for user with active subscription', async () => {
      const mockSubscription = {
        plan_id: 'plan-1',
      };

      const mockLimits = {
        id: 'limit-1',
        plan_id: 'plan-1',
        ...DEFAULT_PLAN_LIMITS,
      };

      // Mock subscription query
      mockSupabase.from().select().eq().single
        .mockResolvedValueOnce({
          data: mockSubscription,
          error: null,
        })
        // Mock limits query
        .mockResolvedValueOnce({
          data: mockLimits,
          error: null,
        });

      const result = await service.getUserPlanLimits('user-1');

      expect(result).toEqual(mockLimits);
    });

    it('should return null for user without active subscription', async () => {
      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      const result = await service.getUserPlanLimits('user-1');

      expect(result).toBeNull();
    });
  });

  describe('canAddClient', () => {
    it('should allow adding client when under limit', async () => {
      const mockLimits = {
        ...DEFAULT_PLAN_LIMITS,
        max_clients: 5,
      };

      // Mock getUserPlanLimits
      jest.spyOn(service, 'getUserPlanLimits').mockResolvedValue(mockLimits as any);

      // Mock client count
      mockSupabase.from().select.mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          count: 3,
          error: null,
        }),
      });

      const result = await service.canAddClient('user-1');

      expect(result.allowed).toBe(true);
      expect(result.current).toBe(3);
      expect(result.limit).toBe(5);
    });

    it('should block adding client when at limit', async () => {
      const mockLimits = {
        ...DEFAULT_PLAN_LIMITS,
        max_clients: 5,
      };

      jest.spyOn(service, 'getUserPlanLimits').mockResolvedValue(mockLimits as any);

      mockSupabase.from().select.mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          count: 5,
          error: null,
        }),
      });

      const result = await service.canAddClient('user-1');

      expect(result.allowed).toBe(false);
      expect(result.current).toBe(5);
      expect(result.limit).toBe(5);
    });

    it('should always allow when limit is unlimited (-1)', async () => {
      const mockLimits = {
        ...DEFAULT_PLAN_LIMITS,
        max_clients: -1,
      };

      jest.spyOn(service, 'getUserPlanLimits').mockResolvedValue(mockLimits as any);

      const result = await service.canAddClient('user-1');

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(-1);
    });
  });

  describe('canAddCampaign', () => {
    it('should allow adding campaign when under limit', async () => {
      const mockClient = {
        user_id: 'user-1',
      };

      const mockLimits = {
        ...DEFAULT_PLAN_LIMITS,
        max_campaigns_per_client: 25,
      };

      // Mock client query
      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: mockClient,
        error: null,
      });

      jest.spyOn(service, 'getUserPlanLimits').mockResolvedValue(mockLimits as any);

      // Mock campaign count
      mockSupabase.from().select.mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          count: 10,
          error: null,
        }),
      });

      const result = await service.canAddCampaign('client-1');

      expect(result.allowed).toBe(true);
      expect(result.current).toBe(10);
      expect(result.limit).toBe(25);
    });

    it('should block adding campaign when at limit', async () => {
      const mockClient = {
        user_id: 'user-1',
      };

      const mockLimits = {
        ...DEFAULT_PLAN_LIMITS,
        max_campaigns_per_client: 25,
      };

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: mockClient,
        error: null,
      });

      jest.spyOn(service, 'getUserPlanLimits').mockResolvedValue(mockLimits as any);

      mockSupabase.from().select.mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          count: 25,
          error: null,
        }),
      });

      const result = await service.canAddCampaign('client-1');

      expect(result.allowed).toBe(false);
    });
  });

  describe('canAccessDataRange', () => {
    it('should allow access within retention period', async () => {
      const mockLimits = {
        ...DEFAULT_PLAN_LIMITS,
        data_retention_days: 90,
      };

      jest.spyOn(service, 'getUserPlanLimits').mockResolvedValue(mockLimits as any);

      const result = await service.canAccessDataRange('user-1', 60);

      expect(result).toBe(true);
    });

    it('should block access beyond retention period', async () => {
      const mockLimits = {
        ...DEFAULT_PLAN_LIMITS,
        data_retention_days: 90,
      };

      jest.spyOn(service, 'getUserPlanLimits').mockResolvedValue(mockLimits as any);

      const result = await service.canAccessDataRange('user-1', 120);

      expect(result).toBe(false);
    });
  });

  describe('canExport', () => {
    it('should allow CSV export when enabled', async () => {
      const mockLimits = {
        ...DEFAULT_PLAN_LIMITS,
        allow_csv_export: true,
      };

      jest.spyOn(service, 'getUserPlanLimits').mockResolvedValue(mockLimits as any);

      const result = await service.canExport('user-1', 'csv');

      expect(result).toBe(true);
    });

    it('should block CSV export when disabled', async () => {
      const mockLimits = {
        ...DEFAULT_PLAN_LIMITS,
        allow_csv_export: false,
      };

      jest.spyOn(service, 'getUserPlanLimits').mockResolvedValue(mockLimits as any);

      const result = await service.canExport('user-1', 'csv');

      expect(result).toBe(false);
    });

    it('should allow JSON export when enabled', async () => {
      const mockLimits = {
        ...DEFAULT_PLAN_LIMITS,
        allow_json_export: true,
      };

      jest.spyOn(service, 'getUserPlanLimits').mockResolvedValue(mockLimits as any);

      const result = await service.canExport('user-1', 'json');

      expect(result).toBe(true);
    });
  });
});
