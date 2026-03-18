/**
 * Sync Service Tests
 * 
 * Tests for Google Ads Sync Service core functionality
 * Requirements: 3.1, 3.2, 3.3
 */

import { GoogleSyncService } from '../sync-service';
import { GoogleAdsClient } from '../client';

// Mock dependencies
jest.mock('../token-manager');
jest.mock('@/lib/repositories/google-ads-repository');
jest.mock('../client');

describe('GoogleSyncService', () => {
  let syncService: GoogleSyncService;

  beforeEach(() => {
    syncService = new GoogleSyncService();
    jest.clearAllMocks();
  });

  describe('Error Handling', () => {
    it('should identify retryable rate limit errors', () => {
      const isRetryable = (syncService as any).isRetryableError.bind(syncService);

      const rateLimitError = {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Rate limit exceeded',
      };

      expect(isRetryable(rateLimitError)).toBe(true);
    });

    it('should identify retryable network errors', () => {
      const isRetryable = (syncService as any).isRetryableError.bind(syncService);

      const networkError = {
        code: 'ETIMEDOUT',
        message: 'Network timeout',
      };

      expect(isRetryable(networkError)).toBe(true);
    });

    it('should identify retryable server errors', () => {
      const isRetryable = (syncService as any).isRetryableError.bind(syncService);

      const serverError = {
        status: 503,
        message: 'Service unavailable',
      };

      expect(isRetryable(serverError)).toBe(true);
    });

    it('should not retry authentication errors', () => {
      const isRetryable = (syncService as any).isRetryableError.bind(syncService);

      const authError = {
        code: 'AUTHENTICATION_ERROR',
        message: 'Invalid credentials',
      };

      expect(isRetryable(authError)).toBe(false);
    });

    it('should not retry client errors', () => {
      const isRetryable = (syncService as any).isRetryableError.bind(syncService);

      const clientError = {
        status: 400,
        message: 'Bad request',
      };

      expect(isRetryable(clientError)).toBe(false);
    });
  });

  describe('Date Formatting', () => {
    it('should format dates correctly', () => {
      const formatDate = (syncService as any).formatDate.bind(syncService);

      const date = new Date('2024-01-15T10:30:00Z');
      const formatted = formatDate(date);

      expect(formatted).toBe('2024-01-15');
    });

    it('should generate default date range', () => {
      const getDefaultDateRange = (syncService as any).getDefaultDateRange.bind(syncService);

      const range = getDefaultDateRange();

      expect(range).toHaveProperty('startDate');
      expect(range).toHaveProperty('endDate');
      expect(range.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(range.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('Sync Result Structure', () => {
    it('should return proper sync result structure on success', async () => {
      // Mock successful sync
      const mockRepository = require('@/lib/repositories/google-ads-repository').GoogleAdsRepository;
      mockRepository.prototype.getConnection = jest.fn().mockResolvedValue({
        id: 'conn-123',
        customer_id: 'cust-456',
      });
      mockRepository.prototype.createSyncLog = jest.fn().mockResolvedValue('log-123');
      mockRepository.prototype.saveCampaigns = jest.fn().mockResolvedValue(5);
      mockRepository.prototype.updateLastSync = jest.fn().mockResolvedValue(undefined);
      mockRepository.prototype.updateSyncLog = jest.fn().mockResolvedValue(undefined);

      const mockTokenManager = require('../token-manager').getGoogleTokenManager;
      mockTokenManager.mockReturnValue({
        ensureValidToken: jest.fn().mockResolvedValue('access-token-123'),
      });

      const mockClient = GoogleAdsClient as jest.MockedClass<typeof GoogleAdsClient>;
      mockClient.prototype.getCampaigns = jest.fn().mockResolvedValue([
        {
          id: '1',
          name: 'Campaign 1',
          status: 'ENABLED',
          budget: 100,
          metrics: {
            impressions: 1000,
            clicks: 50,
            conversions: 5,
            cost: 25,
            ctr: 5,
            conversionRate: 10,
          },
        },
      ]);

      const result = await syncService.syncCampaigns({
        clientId: 'client-123',
        fullSync: false,
        syncMetrics: false,
      });

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('campaignsSynced');
      expect(result).toHaveProperty('metricsUpdated');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('timestamp');
      expect(result.errors).toBeInstanceOf(Array);
    });
  });

  describe('Delay Helper', () => {
    it('should delay execution', async () => {
      const delay = (syncService as any).delay.bind(syncService);
      const startTime = Date.now();

      await delay(100);

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      expect(elapsed).toBeGreaterThanOrEqual(90); // Allow some margin
      expect(elapsed).toBeLessThan(200);
    });
  });
});
