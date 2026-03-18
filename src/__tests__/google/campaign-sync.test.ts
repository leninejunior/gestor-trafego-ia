/**
 * Campaign Sync Test
 * 
 * Tests to verify that campaign synchronization works correctly
 * from Google Ads API to the database.
 * 
 * Requirements: Task 5.2 - Test campaign sync
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { GoogleSyncService, SyncOptions, SyncResult } from '@/lib/google/sync-service';
import { GoogleAdsClient, GoogleAdsCampaign } from '@/lib/google/client';
import { GoogleAdsRepository } from '@/lib/repositories/google-ads-repository';

// Mock dependencies
jest.mock('@/lib/google/token-manager', () => ({
  getGoogleTokenManager: jest.fn(() => ({
    ensureValidToken: jest.fn().mockResolvedValue('mock-access-token'),
  })),
}));
jest.mock('@/lib/repositories/google-ads-repository');
jest.mock('@/lib/google/client');
jest.mock('@/lib/google/error-handler');
jest.mock('@/lib/google/notification-service', () => ({
  googleAdsNotificationService: {
    notifySyncCompletion: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('@/lib/google/logger', () => ({
  googleAdsLogger: {
    syncStart: jest.fn().mockReturnValue('mock-request-id'),
    syncComplete: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));
jest.mock('@/lib/google/performance-monitor', () => ({
  googleAdsPerformanceMonitor: {
    startOperation: jest.fn().mockReturnValue('mock-operation-id'),
    updateOperation: jest.fn(),
    finishOperation: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('@/lib/google/cache-service', () => ({
  googleAdsCache: {
    invalidateAfterSync: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('Campaign Sync Tests', () => {
  let syncService: GoogleSyncService;
  let mockRepository: jest.Mocked<GoogleAdsRepository>;
  let mockClient: jest.Mocked<GoogleAdsClient>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock repository
    mockRepository = {
      getConnection: jest.fn(),
      getConnectionById: jest.fn(),
      createSyncLog: jest.fn(),
      updateSyncLog: jest.fn(),
      saveCampaigns: jest.fn(),
      updateLastSync: jest.fn(),
      getLastSuccessfulSync: jest.fn(),
      getCampaignById: jest.fn(),
      getCampaignByGoogleId: jest.fn(),
      saveMetrics: jest.fn(),
    } as any;

    // Create mock client
    mockClient = {
      getCampaigns: jest.fn(),
      getCampaignMetrics: jest.fn(),
    } as any;

    // Mock GoogleAdsClient constructor
    (GoogleAdsClient as jest.MockedClass<typeof GoogleAdsClient>).mockImplementation(() => mockClient);

    // Mock repository constructor
    (GoogleAdsRepository as jest.MockedClass<typeof GoogleAdsRepository>).mockImplementation(() => mockRepository);

    // Create sync service instance
    syncService = new GoogleSyncService();
  });

  describe('Basic Campaign Sync', () => {
    it('should successfully sync campaigns when API returns data', async () => {
      // Arrange
      const mockCampaigns: GoogleAdsCampaign[] = [
        {
          id: '123456789',
          name: 'Test Campaign 1',
          status: 'ENABLED',
          budget: 1000,
          metrics: {
            impressions: 1000,
            clicks: 50,
            cost: 100,
            conversions: 5,
          },
        },
        {
          id: '987654321',
          name: 'Test Campaign 2',
          status: 'PAUSED',
          budget: 2000,
          metrics: {
            impressions: 2000,
            clicks: 100,
            cost: 200,
            conversions: 10,
          },
        },
      ];

      const mockConnection = {
        id: 'conn-123',
        customer_id: '1234567890',
        client_id: 'client-123',
        status: 'active',
        last_sync_at: null,
      };

      mockRepository.getConnection.mockResolvedValue(mockConnection as any);
      mockRepository.getConnectionById.mockResolvedValue(mockConnection as any);
      mockRepository.createSyncLog.mockResolvedValue('sync-log-123');
      mockRepository.saveCampaigns.mockResolvedValue(2);
      mockClient.getCampaigns.mockResolvedValue(mockCampaigns);

      const options: SyncOptions = {
        clientId: 'client-123',
        fullSync: true,
        syncMetrics: false,
      };

      // Act
      const result: SyncResult = await syncService.syncCampaigns(options);

      // Assert
      expect(result.success).toBe(true);
      expect(result.campaignsSynced).toBe(2);
      expect(result.errors).toHaveLength(0);
      expect(mockClient.getCampaigns).toHaveBeenCalledTimes(1);
      expect(mockRepository.saveCampaigns).toHaveBeenCalledWith(
        mockCampaigns,
        mockConnection.id,
        options.clientId
      );
    });

    it('should return 0 campaigns when API returns empty array', async () => {
      // Arrange
      const mockConnection = {
        id: 'conn-123',
        customer_id: '1234567890',
        client_id: 'client-123',
        status: 'active',
        last_sync_at: null,
      };

      mockRepository.getConnection.mockResolvedValue(mockConnection as any);
      mockRepository.getConnectionById.mockResolvedValue(mockConnection as any);
      mockRepository.createSyncLog.mockResolvedValue('sync-log-123');
      mockClient.getCampaigns.mockResolvedValue([]);

      const options: SyncOptions = {
        clientId: 'client-123',
        fullSync: true,
        syncMetrics: false,
      };

      // Act
      const result: SyncResult = await syncService.syncCampaigns(options);

      // Assert
      expect(result.success).toBe(true);
      expect(result.campaignsSynced).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(mockClient.getCampaigns).toHaveBeenCalledTimes(1);
      expect(mockRepository.saveCampaigns).not.toHaveBeenCalled();
    });

    it('should handle single campaign sync', async () => {
      // Arrange
      const mockCampaigns: GoogleAdsCampaign[] = [
        {
          id: '123456789',
          name: 'Single Campaign',
          status: 'ENABLED',
          budget: 500,
          metrics: {
            impressions: 500,
            clicks: 25,
            cost: 50,
            conversions: 2,
          },
        },
      ];

      const mockConnection = {
        id: 'conn-123',
        customer_id: '1234567890',
        client_id: 'client-123',
        status: 'active',
        last_sync_at: null,
      };

      mockRepository.getConnection.mockResolvedValue(mockConnection as any);
      mockRepository.getConnectionById.mockResolvedValue(mockConnection as any);
      mockRepository.createSyncLog.mockResolvedValue('sync-log-123');
      mockRepository.saveCampaigns.mockResolvedValue(1);
      mockClient.getCampaigns.mockResolvedValue(mockCampaigns);

      const options: SyncOptions = {
        clientId: 'client-123',
        fullSync: false,
        syncMetrics: false,
      };

      // Act
      const result: SyncResult = await syncService.syncCampaigns(options);

      // Assert
      expect(result.success).toBe(true);
      expect(result.campaignsSynced).toBe(1);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Campaign Sync with Different Statuses', () => {
    it('should sync campaigns with ENABLED status', async () => {
      // Arrange
      const mockCampaigns: GoogleAdsCampaign[] = [
        {
          id: '123',
          name: 'Enabled Campaign',
          status: 'ENABLED',
          budget: 1000,
          metrics: { impressions: 1000, clicks: 50, cost: 100, conversions: 5 },
        },
      ];

      const mockConnection = {
        id: 'conn-123',
        customer_id: '1234567890',
        client_id: 'client-123',
        status: 'active',
      };

      mockRepository.getConnection.mockResolvedValue(mockConnection as any);
      mockRepository.getConnectionById.mockResolvedValue(mockConnection as any);
      mockRepository.createSyncLog.mockResolvedValue('sync-log-123');
      mockRepository.saveCampaigns.mockResolvedValue(1);
      mockClient.getCampaigns.mockResolvedValue(mockCampaigns);

      // Act
      const result = await syncService.syncCampaigns({ clientId: 'client-123' });

      // Assert
      expect(result.success).toBe(true);
      expect(result.campaignsSynced).toBe(1);
    });

    it('should sync campaigns with PAUSED status', async () => {
      // Arrange
      const mockCampaigns: GoogleAdsCampaign[] = [
        {
          id: '456',
          name: 'Paused Campaign',
          status: 'PAUSED',
          budget: 2000,
          metrics: { impressions: 0, clicks: 0, cost: 0, conversions: 0 },
        },
      ];

      const mockConnection = {
        id: 'conn-123',
        customer_id: '1234567890',
        client_id: 'client-123',
        status: 'active',
      };

      mockRepository.getConnection.mockResolvedValue(mockConnection as any);
      mockRepository.getConnectionById.mockResolvedValue(mockConnection as any);
      mockRepository.createSyncLog.mockResolvedValue('sync-log-123');
      mockRepository.saveCampaigns.mockResolvedValue(1);
      mockClient.getCampaigns.mockResolvedValue(mockCampaigns);

      // Act
      const result = await syncService.syncCampaigns({ clientId: 'client-123' });

      // Assert
      expect(result.success).toBe(true);
      expect(result.campaignsSynced).toBe(1);
    });

    it('should sync campaigns with mixed statuses', async () => {
      // Arrange
      const mockCampaigns: GoogleAdsCampaign[] = [
        {
          id: '123',
          name: 'Enabled Campaign',
          status: 'ENABLED',
          budget: 1000,
          metrics: { impressions: 1000, clicks: 50, cost: 100, conversions: 5 },
        },
        {
          id: '456',
          name: 'Paused Campaign',
          status: 'PAUSED',
          budget: 2000,
          metrics: { impressions: 0, clicks: 0, cost: 0, conversions: 0 },
        },
        {
          id: '789',
          name: 'Ended Campaign',
          status: 'ENDED',
          budget: 1500,
          metrics: { impressions: 500, clicks: 25, cost: 50, conversions: 2 },
        },
      ];

      const mockConnection = {
        id: 'conn-123',
        customer_id: '1234567890',
        client_id: 'client-123',
        status: 'active',
      };

      mockRepository.getConnection.mockResolvedValue(mockConnection as any);
      mockRepository.getConnectionById.mockResolvedValue(mockConnection as any);
      mockRepository.createSyncLog.mockResolvedValue('sync-log-123');
      mockRepository.saveCampaigns.mockResolvedValue(3);
      mockClient.getCampaigns.mockResolvedValue(mockCampaigns);

      // Act
      const result = await syncService.syncCampaigns({ clientId: 'client-123' });

      // Assert
      expect(result.success).toBe(true);
      expect(result.campaignsSynced).toBe(3);
    });
  });

  describe('Campaign Sync Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      // Arrange
      const mockConnection = {
        id: 'conn-123',
        customer_id: '1234567890',
        client_id: 'client-123',
        status: 'active',
      };

      mockRepository.getConnection.mockResolvedValue(mockConnection as any);
      mockRepository.getConnectionById.mockResolvedValue(mockConnection as any);
      mockRepository.createSyncLog.mockResolvedValue('sync-log-123');
      mockClient.getCampaigns.mockRejectedValue(new Error('API Error: Rate limit exceeded'));

      // Act
      const result = await syncService.syncCampaigns({ clientId: 'client-123' });

      // Assert
      expect(result.success).toBe(false);
      expect(result.campaignsSynced).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('API Error');
    });

    it('should handle connection not found error', async () => {
      // Arrange
      mockRepository.getConnection.mockResolvedValue(null);

      // Act
      const result = await syncService.syncCampaigns({ clientId: 'non-existent-client' });

      // Assert
      expect(result.success).toBe(false);
      expect(result.campaignsSynced).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('No active Google Ads connection found for client');
    });

    it('should handle database save errors', async () => {
      // Arrange
      const mockCampaigns: GoogleAdsCampaign[] = [
        {
          id: '123',
          name: 'Test Campaign',
          status: 'ENABLED',
          budget: 1000,
          metrics: { impressions: 1000, clicks: 50, cost: 100, conversions: 5 },
        },
      ];

      const mockConnection = {
        id: 'conn-123',
        customer_id: '1234567890',
        client_id: 'client-123',
        status: 'active',
      };

      mockRepository.getConnection.mockResolvedValue(mockConnection as any);
      mockRepository.getConnectionById.mockResolvedValue(mockConnection as any);
      mockRepository.createSyncLog.mockResolvedValue('sync-log-123');
      mockClient.getCampaigns.mockResolvedValue(mockCampaigns);
      mockRepository.saveCampaigns.mockRejectedValue(new Error('Database error'));

      // Act
      const result = await syncService.syncCampaigns({ clientId: 'client-123' });

      // Assert
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Database error');
    });
  });

  describe('Campaign Sync with Date Ranges', () => {
    it('should sync campaigns with specific date range', async () => {
      // Arrange
      const mockCampaigns: GoogleAdsCampaign[] = [
        {
          id: '123',
          name: 'Campaign with Date Range',
          status: 'ENABLED',
          budget: 1000,
          metrics: { impressions: 1000, clicks: 50, cost: 100, conversions: 5 },
        },
      ];

      const mockConnection = {
        id: 'conn-123',
        customer_id: '1234567890',
        client_id: 'client-123',
        status: 'active',
      };

      const dateRange = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      };

      mockRepository.getConnection.mockResolvedValue(mockConnection as any);
      mockRepository.getConnectionById.mockResolvedValue(mockConnection as any);
      mockRepository.createSyncLog.mockResolvedValue('sync-log-123');
      mockRepository.saveCampaigns.mockResolvedValue(1);
      mockClient.getCampaigns.mockResolvedValue(mockCampaigns);

      // Act
      const result = await syncService.syncCampaigns({
        clientId: 'client-123',
        dateRange,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.campaignsSynced).toBe(1);
      expect(mockClient.getCampaigns).toHaveBeenCalledWith(dateRange);
    });

    it('should sync campaigns without date range (all-time)', async () => {
      // Arrange
      const mockCampaigns: GoogleAdsCampaign[] = [
        {
          id: '123',
          name: 'All-time Campaign',
          status: 'ENABLED',
          budget: 1000,
          metrics: { impressions: 5000, clicks: 250, cost: 500, conversions: 25 },
        },
      ];

      const mockConnection = {
        id: 'conn-123',
        customer_id: '1234567890',
        client_id: 'client-123',
        status: 'active',
      };

      mockRepository.getConnection.mockResolvedValue(mockConnection as any);
      mockRepository.getConnectionById.mockResolvedValue(mockConnection as any);
      mockRepository.createSyncLog.mockResolvedValue('sync-log-123');
      mockRepository.saveCampaigns.mockResolvedValue(1);
      mockClient.getCampaigns.mockResolvedValue(mockCampaigns);

      // Act
      const result = await syncService.syncCampaigns({
        clientId: 'client-123',
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.campaignsSynced).toBe(1);
      expect(mockClient.getCampaigns).toHaveBeenCalledWith(undefined);
    });
  });

  describe('Campaign Sync Logging', () => {
    it('should create sync log before starting sync', async () => {
      // Arrange
      const mockCampaigns: GoogleAdsCampaign[] = [
        {
          id: '123',
          name: 'Test Campaign',
          status: 'ENABLED',
          budget: 1000,
          metrics: { impressions: 1000, clicks: 50, cost: 100, conversions: 5 },
        },
      ];

      const mockConnection = {
        id: 'conn-123',
        customer_id: '1234567890',
        client_id: 'client-123',
        status: 'active',
      };

      mockRepository.getConnection.mockResolvedValue(mockConnection as any);
      mockRepository.getConnectionById.mockResolvedValue(mockConnection as any);
      mockRepository.createSyncLog.mockResolvedValue('sync-log-123');
      mockRepository.saveCampaigns.mockResolvedValue(1);
      mockClient.getCampaigns.mockResolvedValue(mockCampaigns);

      // Act
      await syncService.syncCampaigns({ clientId: 'client-123' });

      // Assert
      expect(mockRepository.createSyncLog).toHaveBeenCalledWith(
        expect.objectContaining({
          connection_id: mockConnection.id,
          sync_type: expect.any(String),
          status: 'success',
          campaigns_synced: 0,
          metrics_updated: 0,
        })
      );
    });

    it('should update sync log after successful sync', async () => {
      // Arrange
      const mockCampaigns: GoogleAdsCampaign[] = [
        {
          id: '123',
          name: 'Test Campaign',
          status: 'ENABLED',
          budget: 1000,
          metrics: { impressions: 1000, clicks: 50, cost: 100, conversions: 5 },
        },
      ];

      const mockConnection = {
        id: 'conn-123',
        customer_id: '1234567890',
        client_id: 'client-123',
        status: 'active',
      };

      mockRepository.getConnection.mockResolvedValue(mockConnection as any);
      mockRepository.getConnectionById.mockResolvedValue(mockConnection as any);
      mockRepository.createSyncLog.mockResolvedValue('sync-log-123');
      mockRepository.saveCampaigns.mockResolvedValue(1);
      mockClient.getCampaigns.mockResolvedValue(mockCampaigns);

      // Act
      await syncService.syncCampaigns({ clientId: 'client-123' });

      // Assert
      expect(mockRepository.updateSyncLog).toHaveBeenCalledWith(
        'sync-log-123',
        expect.objectContaining({
          status: 'success',
          campaigns_synced: 1,
          completed_at: expect.any(Date),
        })
      );
    });

    it('should update sync log with error on failure', async () => {
      // Arrange
      const mockConnection = {
        id: 'conn-123',
        customer_id: '1234567890',
        client_id: 'client-123',
        status: 'active',
      };

      mockRepository.getConnection.mockResolvedValue(mockConnection as any);
      mockRepository.getConnectionById.mockResolvedValue(mockConnection as any);
      mockRepository.createSyncLog.mockResolvedValue('sync-log-123');
      mockClient.getCampaigns.mockRejectedValue(new Error('Sync failed'));

      // Act
      await syncService.syncCampaigns({ clientId: 'client-123' });

      // Assert
      expect(mockRepository.updateSyncLog).toHaveBeenCalledWith(
        'sync-log-123',
        expect.objectContaining({
          status: 'failed',
          error_message: 'Sync failed',
          completed_at: expect.any(Date),
        })
      );
    });
  });

  describe('Campaign Sync Performance', () => {
    it('should handle large number of campaigns efficiently', async () => {
      // Arrange
      const mockCampaigns: GoogleAdsCampaign[] = Array.from({ length: 100 }, (_, i) => ({
        id: `campaign-${i}`,
        name: `Campaign ${i}`,
        status: 'ENABLED',
        budget: 1000 + i,
        metrics: {
          impressions: 1000 * (i + 1),
          clicks: 50 * (i + 1),
          cost: 100 * (i + 1),
          conversions: 5 * (i + 1),
        },
      }));

      const mockConnection = {
        id: 'conn-123',
        customer_id: '1234567890',
        client_id: 'client-123',
        status: 'active',
      };

      mockRepository.getConnection.mockResolvedValue(mockConnection as any);
      mockRepository.getConnectionById.mockResolvedValue(mockConnection as any);
      mockRepository.createSyncLog.mockResolvedValue('sync-log-123');
      mockRepository.saveCampaigns.mockResolvedValue(100);
      mockClient.getCampaigns.mockResolvedValue(mockCampaigns);

      const startTime = Date.now();

      // Act
      const result = await syncService.syncCampaigns({ clientId: 'client-123' });

      const duration = Date.now() - startTime;

      // Assert
      expect(result.success).toBe(true);
      expect(result.campaignsSynced).toBe(100);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Campaign Sync with Metrics', () => {
    it('should sync campaigns with metrics when requested', async () => {
      // Arrange
      const mockCampaigns: GoogleAdsCampaign[] = [
        {
          id: '123',
          name: 'Campaign with Metrics',
          status: 'ENABLED',
          budget: 1000,
          metrics: { impressions: 1000, clicks: 50, cost: 100, conversions: 5 },
        },
      ];

      const mockConnection = {
        id: 'conn-123',
        customer_id: '1234567890',
        client_id: 'client-123',
        status: 'active',
      };

      const mockCampaignRecord = {
        id: 'db-campaign-123',
        campaign_id: '123',
        name: 'Campaign with Metrics',
      };

      mockRepository.getConnection.mockResolvedValue(mockConnection as any);
      mockRepository.getConnectionById.mockResolvedValue(mockConnection as any);
      mockRepository.createSyncLog.mockResolvedValue('sync-log-123');
      mockRepository.saveCampaigns.mockResolvedValue(1);
      mockRepository.getCampaignByGoogleId.mockResolvedValue(mockCampaignRecord as any);
      mockClient.getCampaigns.mockResolvedValue(mockCampaigns);
      mockClient.getCampaignMetrics.mockResolvedValue(mockCampaigns[0].metrics);

      // Act
      const result = await syncService.syncCampaigns({
        clientId: 'client-123',
        syncMetrics: true,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.campaignsSynced).toBe(1);
      expect(result.metricsUpdated).toBeGreaterThan(0);
    });
  });
});
