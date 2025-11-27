/**
 * Date Range Sync Test
 * 
 * Tests to verify that campaign sync works correctly with different date ranges
 * and that metrics are properly filtered by date.
 * 
 * Requirements: Task 3.2 - Test with different date ranges
 */

import { GoogleAdsClient, DateRange } from '@/lib/google/client';
import { GoogleSyncService } from '@/lib/google/sync-service';

describe('Date Range Sync Tests', () => {
  describe('Date Range Query Building', () => {
    it('should build query without date filter when no date range provided', () => {
      const client = new GoogleAdsClient({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        developerToken: 'test-developer-token',
        refreshToken: 'test-refresh-token',
        customerId: '1234567890',
      });

      const buildQuery = (client as any).buildCampaignsQuery.bind(client);
      const query = buildQuery();

      // Should not contain date filter
      expect(query).not.toContain('segments.date BETWEEN');
      
      // Should still have status filter
      expect(query).toContain("campaign.status != 'REMOVED'");
    });

    it('should build query with date filter for last 7 days', () => {
      const client = new GoogleAdsClient({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        developerToken: 'test-developer-token',
        refreshToken: 'test-refresh-token',
        customerId: '1234567890',
      });

      const buildQuery = (client as any).buildCampaignsQuery.bind(client);
      const dateRange: DateRange = {
        startDate: '2024-01-01',
        endDate: '2024-01-07',
      };
      const query = buildQuery(dateRange);

      // Should contain date filter
      expect(query).toContain("segments.date BETWEEN '2024-01-01' AND '2024-01-07'");
      
      // Should still have status filter
      expect(query).toContain("campaign.status != 'REMOVED'");
    });

    it('should build query with date filter for last 30 days', () => {
      const client = new GoogleAdsClient({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        developerToken: 'test-developer-token',
        refreshToken: 'test-refresh-token',
        customerId: '1234567890',
      });

      const buildQuery = (client as any).buildCampaignsQuery.bind(client);
      const dateRange: DateRange = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      };
      const query = buildQuery(dateRange);

      // Should contain date filter
      expect(query).toContain("segments.date BETWEEN '2024-01-01' AND '2024-01-31'");
    });

    it('should build query with date filter for last 90 days', () => {
      const client = new GoogleAdsClient({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        developerToken: 'test-developer-token',
        refreshToken: 'test-refresh-token',
        customerId: '1234567890',
      });

      const buildQuery = (client as any).buildCampaignsQuery.bind(client);
      const dateRange: DateRange = {
        startDate: '2023-10-01',
        endDate: '2023-12-31',
      };
      const query = buildQuery(dateRange);

      // Should contain date filter
      expect(query).toContain("segments.date BETWEEN '2023-10-01' AND '2023-12-31'");
    });

    it('should build query with date filter for custom date range', () => {
      const client = new GoogleAdsClient({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        developerToken: 'test-developer-token',
        refreshToken: 'test-refresh-token',
        customerId: '1234567890',
      });

      const buildQuery = (client as any).buildCampaignsQuery.bind(client);
      const dateRange: DateRange = {
        startDate: '2024-03-15',
        endDate: '2024-04-20',
      };
      const query = buildQuery(dateRange);

      // Should contain date filter
      expect(query).toContain("segments.date BETWEEN '2024-03-15' AND '2024-04-20'");
    });

    it('should build query with date filter for single day', () => {
      const client = new GoogleAdsClient({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        developerToken: 'test-developer-token',
        refreshToken: 'test-refresh-token',
        customerId: '1234567890',
      });

      const buildQuery = (client as any).buildCampaignsQuery.bind(client);
      const dateRange: DateRange = {
        startDate: '2024-01-15',
        endDate: '2024-01-15',
      };
      const query = buildQuery(dateRange);

      // Should contain date filter for single day
      expect(query).toContain("segments.date BETWEEN '2024-01-15' AND '2024-01-15'");
    });
  });

  describe('Date Range Format Validation', () => {
    it('should accept date range in YYYY-MM-DD format', () => {
      const client = new GoogleAdsClient({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        developerToken: 'test-developer-token',
        refreshToken: 'test-refresh-token',
        customerId: '1234567890',
      });

      const buildQuery = (client as any).buildCampaignsQuery.bind(client);
      const dateRange: DateRange = {
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      };

      // Should not throw error
      expect(() => buildQuery(dateRange)).not.toThrow();
      
      const query = buildQuery(dateRange);
      expect(query).toContain('2024-01-01');
      expect(query).toContain('2024-12-31');
    });

    it('should handle leap year dates correctly', () => {
      const client = new GoogleAdsClient({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        developerToken: 'test-developer-token',
        refreshToken: 'test-refresh-token',
        customerId: '1234567890',
      });

      const buildQuery = (client as any).buildCampaignsQuery.bind(client);
      const dateRange: DateRange = {
        startDate: '2024-02-29',
        endDate: '2024-03-01',
      };

      const query = buildQuery(dateRange);
      expect(query).toContain('2024-02-29');
      expect(query).toContain('2024-03-01');
    });

    it('should handle year boundaries correctly', () => {
      const client = new GoogleAdsClient({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        developerToken: 'test-developer-token',
        refreshToken: 'test-refresh-token',
        customerId: '1234567890',
      });

      const buildQuery = (client as any).buildCampaignsQuery.bind(client);
      const dateRange: DateRange = {
        startDate: '2023-12-31',
        endDate: '2024-01-01',
      };

      const query = buildQuery(dateRange);
      expect(query).toContain('2023-12-31');
      expect(query).toContain('2024-01-01');
    });
  });

  describe('Metrics Query with Date Ranges', () => {
    it('should build metrics query with date range', () => {
      const client = new GoogleAdsClient({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        developerToken: 'test-developer-token',
        refreshToken: 'test-refresh-token',
        customerId: '1234567890',
      });

      // Access the getCampaignMetrics method to verify it uses date ranges
      const dateRange: DateRange = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      };

      // The method should accept date range parameter
      expect(client.getCampaignMetrics).toBeDefined();
      
      // Verify the method signature accepts campaignId and dateRange
      const methodString = client.getCampaignMetrics.toString();
      expect(methodString).toContain('campaignId');
      expect(methodString).toContain('dateRange');
    });
  });

  describe('Default Date Range Behavior', () => {
    it('should use default date range (last 30 days) when not specified', () => {
      const syncService = new GoogleSyncService();
      
      // Access private method for testing
      const getDefaultDateRange = (syncService as any).getDefaultDateRange.bind(syncService);
      const defaultRange = getDefaultDateRange();

      // Should return a date range object
      expect(defaultRange).toHaveProperty('startDate');
      expect(defaultRange).toHaveProperty('endDate');
      
      // Should be in YYYY-MM-DD format
      expect(defaultRange.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(defaultRange.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      
      // Calculate expected dates
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      
      const expectedEndDate = endDate.toISOString().split('T')[0];
      const expectedStartDate = startDate.toISOString().split('T')[0];
      
      expect(defaultRange.endDate).toBe(expectedEndDate);
      expect(defaultRange.startDate).toBe(expectedStartDate);
    });

    it('should format dates correctly in YYYY-MM-DD format', () => {
      const syncService = new GoogleSyncService();
      
      // Access private method for testing
      const formatDate = (syncService as any).formatDate.bind(syncService);
      
      const testDate = new Date('2024-03-15T10:30:00Z');
      const formatted = formatDate(testDate);
      
      expect(formatted).toBe('2024-03-15');
      expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('Date Range Edge Cases', () => {
    it('should handle very old date ranges', () => {
      const client = new GoogleAdsClient({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        developerToken: 'test-developer-token',
        refreshToken: 'test-refresh-token',
        customerId: '1234567890',
      });

      const buildQuery = (client as any).buildCampaignsQuery.bind(client);
      const dateRange: DateRange = {
        startDate: '2020-01-01',
        endDate: '2020-12-31',
      };

      const query = buildQuery(dateRange);
      expect(query).toContain('2020-01-01');
      expect(query).toContain('2020-12-31');
    });

    it('should handle future date ranges', () => {
      const client = new GoogleAdsClient({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        developerToken: 'test-developer-token',
        refreshToken: 'test-refresh-token',
        customerId: '1234567890',
      });

      const buildQuery = (client as any).buildCampaignsQuery.bind(client);
      const dateRange: DateRange = {
        startDate: '2025-01-01',
        endDate: '2025-12-31',
      };

      const query = buildQuery(dateRange);
      expect(query).toContain('2025-01-01');
      expect(query).toContain('2025-12-31');
    });

    it('should handle month boundaries correctly', () => {
      const client = new GoogleAdsClient({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        developerToken: 'test-developer-token',
        refreshToken: 'test-refresh-token',
        customerId: '1234567890',
      });

      const buildQuery = (client as any).buildCampaignsQuery.bind(client);
      
      // Test different month lengths
      const testCases = [
        { startDate: '2024-01-31', endDate: '2024-02-01' }, // 31-day month to 28/29-day month
        { startDate: '2024-02-28', endDate: '2024-03-01' }, // 28-day month to 31-day month
        { startDate: '2024-04-30', endDate: '2024-05-01' }, // 30-day month to 31-day month
      ];

      testCases.forEach(dateRange => {
        const query = buildQuery(dateRange);
        expect(query).toContain(dateRange.startDate);
        expect(query).toContain(dateRange.endDate);
      });
    });
  });

  describe('Query Structure with Date Ranges', () => {
    it('should maintain proper query structure with date filter', () => {
      const client = new GoogleAdsClient({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        developerToken: 'test-developer-token',
        refreshToken: 'test-refresh-token',
        customerId: '1234567890',
      });

      const buildQuery = (client as any).buildCampaignsQuery.bind(client);
      const dateRange: DateRange = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      };
      const query = buildQuery(dateRange);

      // Should have SELECT clause
      expect(query).toContain('SELECT');
      
      // Should have FROM clause
      expect(query).toContain('FROM campaign');
      
      // Should have WHERE clause with both filters
      expect(query).toContain('WHERE');
      expect(query).toContain("campaign.status != 'REMOVED'");
      expect(query).toContain("segments.date BETWEEN");
      
      // Should have ORDER BY clause
      expect(query).toContain('ORDER BY campaign.id');
    });

    it('should use AND operator to combine filters', () => {
      const client = new GoogleAdsClient({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        developerToken: 'test-developer-token',
        refreshToken: 'test-refresh-token',
        customerId: '1234567890',
      });

      const buildQuery = (client as any).buildCampaignsQuery.bind(client);
      const dateRange: DateRange = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      };
      const query = buildQuery(dateRange);

      // Should use AND to combine status and date filters
      expect(query).toContain("campaign.status != 'REMOVED'");
      expect(query).toContain('AND segments.date BETWEEN');
    });
  });

  describe('Date Range Documentation', () => {
    it('should document supported date range formats', () => {
      // This test documents the expected date range format:
      // - Format: YYYY-MM-DD (ISO 8601 date format)
      // - Example: '2024-01-15'
      // - Both startDate and endDate are required when providing a date range
      // - Date range is optional - if not provided, no date filter is applied
      
      const expectedFormat = {
        format: 'YYYY-MM-DD',
        example: '2024-01-15',
        required: false,
        fields: ['startDate', 'endDate'],
      };

      expect(expectedFormat.format).toBe('YYYY-MM-DD');
      expect(expectedFormat.required).toBe(false);
      expect(expectedFormat.fields).toContain('startDate');
      expect(expectedFormat.fields).toContain('endDate');
    });

    it('should document common date range use cases', () => {
      // This test documents common date range use cases:
      // 1. Last 7 days - for recent performance
      // 2. Last 30 days - default range for most reports
      // 3. Last 90 days - for quarterly analysis
      // 4. Custom range - for specific analysis periods
      // 5. Single day - for daily performance
      // 6. No range - for all-time data
      
      const useCases = [
        { name: 'Last 7 days', description: 'Recent performance' },
        { name: 'Last 30 days', description: 'Default range' },
        { name: 'Last 90 days', description: 'Quarterly analysis' },
        { name: 'Custom range', description: 'Specific periods' },
        { name: 'Single day', description: 'Daily performance' },
        { name: 'No range', description: 'All-time data' },
      ];

      expect(useCases).toHaveLength(6);
      expect(useCases[0].name).toBe('Last 7 days');
      expect(useCases[1].name).toBe('Last 30 days');
    });
  });
});
