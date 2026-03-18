/**
 * Tests for timezone handling in FeatureGateService
 * Validates that usage tracking works correctly across timezone boundaries
 */

import { FeatureGateService } from '@/lib/services/feature-gate';
import { createClient } from '@/lib/supabase/server';

// Mock Supabase client
jest.mock('@/lib/supabase/server');
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

describe('FeatureGateService - Timezone Handling', () => {
  let service: FeatureGateService;
  let mockSupabase: any;

  beforeEach(() => {
    service = new FeatureGateService();
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      rpc: jest.fn(),
      update: jest.fn().mockReturnThis()
    };
    mockCreateClient.mockResolvedValue(mockSupabase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getCurrentUsage', () => {
    it('should use server-side current_date for timezone consistency', async () => {
      // Arrange
      mockSupabase.single.mockResolvedValue({
        data: { usage_count: 5 },
        error: null
      });

      // Act
      await service.getCurrentUsage('org-123', 'maxClients');

      // Assert
      expect(mockSupabase.from).toHaveBeenCalledWith('feature_usage');
      expect(mockSupabase.eq).toHaveBeenCalledWith('usage_date', 'current_date');
    });

    it('should handle timezone boundaries correctly at midnight UTC', async () => {
      // Arrange - simulate midnight UTC transition
      const originalDate = Date;
      const mockDate = new Date('2024-01-01T23:59:59.999Z');
      global.Date = jest.fn(() => mockDate) as any;
      global.Date.UTC = originalDate.UTC;
      global.Date.parse = originalDate.parse;
      global.Date.now = originalDate.now;

      mockSupabase.single.mockResolvedValue({
        data: { usage_count: 3 },
        error: null
      });

      // Act
      const usage = await service.getCurrentUsage('org-123', 'maxClients');

      // Assert
      expect(usage).toBe(3);
      expect(mockSupabase.eq).toHaveBeenCalledWith('usage_date', 'current_date');

      // Restore
      global.Date = originalDate;
    });
  });

  describe('resetUsage', () => {
    it('should use server-side current_date when no date provided', async () => {
      // Arrange
      mockSupabase.update.mockResolvedValue({ error: null });

      // Act
      await service.resetUsage('org-123', 'maxClients');

      // Assert
      expect(mockSupabase.eq).toHaveBeenCalledWith('usage_date', 'current_date');
    });

    it('should convert provided date to UTC for consistency', async () => {
      // Arrange
      const testDate = new Date('2024-01-15T10:30:00-05:00'); // EST timezone
      mockSupabase.update.mockResolvedValue({ error: null });

      // Act
      await service.resetUsage('org-123', 'maxClients', testDate);

      // Assert
      // Should convert to UTC date string
      expect(mockSupabase.eq).toHaveBeenCalledWith('usage_date', '2024-01-15');
    });

    it('should handle timezone offset correctly', async () => {
      // Arrange - test with different timezone
      const testDate = new Date('2024-01-15T02:30:00+09:00'); // JST timezone
      mockSupabase.update.mockResolvedValue({ error: null });

      // Act
      await service.resetUsage('org-123', 'maxClients', testDate);

      // Assert
      // Should convert JST to UTC (subtract 9 hours) -> 2024-01-14
      expect(mockSupabase.eq).toHaveBeenCalledWith('usage_date', '2024-01-14');
    });
  });

  describe('incrementUsage', () => {
    it('should use atomic database function with UTC date handling', async () => {
      // Arrange
      mockSupabase.rpc.mockResolvedValue({
        data: { success: true },
        error: null
      });

      // Act
      const result = await service.incrementUsage('org-123', 'maxClients');

      // Assert
      expect(result).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('check_and_increment_feature_usage', {
        org_id: 'org-123',
        feature_name: 'maxClients'
      });
    });
  });
});