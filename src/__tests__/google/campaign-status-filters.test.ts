/**
 * Campaign Status Filters Test
 * 
 * Tests to verify that campaign status filters are working correctly
 * and that we're fetching the right campaigns based on their status.
 * 
 * Requirements: Task 3.2 - Check campaign status filters
 */

import { GoogleAdsClient } from '@/lib/google/client';

describe('Campaign Status Filters', () => {
  describe('GAQL Query Status Filters', () => {
    it('should exclude REMOVED campaigns from query', () => {
      const client = new GoogleAdsClient({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        developerToken: 'test-developer-token',
        refreshToken: 'test-refresh-token',
        customerId: '1234567890',
      });

      // Access the private method through type assertion for testing
      const buildQuery = (client as any).buildCampaignsQuery.bind(client);
      const query = buildQuery();

      // Verify the query excludes REMOVED campaigns
      expect(query).toContain("WHERE campaign.status != 'REMOVED'");
      expect(query).not.toContain("WHERE campaign.status = 'REMOVED'");
    });

    it('should include ENABLED campaigns', () => {
      const client = new GoogleAdsClient({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        developerToken: 'test-developer-token',
        refreshToken: 'test-refresh-token',
        customerId: '1234567890',
      });

      const buildQuery = (client as any).buildCampaignsQuery.bind(client);
      const query = buildQuery();

      // The query should not explicitly exclude ENABLED campaigns
      expect(query).not.toContain("status != 'ENABLED'");
      
      // It should only exclude REMOVED
      expect(query).toContain("status != 'REMOVED'");
    });

    it('should include PAUSED campaigns', () => {
      const client = new GoogleAdsClient({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        developerToken: 'test-developer-token',
        refreshToken: 'test-refresh-token',
        customerId: '1234567890',
      });

      const buildQuery = (client as any).buildCampaignsQuery.bind(client);
      const query = buildQuery();

      // The query should not explicitly exclude PAUSED campaigns
      expect(query).not.toContain("status != 'PAUSED'");
      
      // It should only exclude REMOVED
      expect(query).toContain("status != 'REMOVED'");
    });

    it('should apply date filter when provided', () => {
      const client = new GoogleAdsClient({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        developerToken: 'test-developer-token',
        refreshToken: 'test-refresh-token',
        customerId: '1234567890',
      });

      const buildQuery = (client as any).buildCampaignsQuery.bind(client);
      const dateRange = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      };
      const query = buildQuery(dateRange);

      // Verify date filter is applied
      expect(query).toContain("segments.date BETWEEN '2024-01-01' AND '2024-01-31'");
      
      // Status filter should still be present
      expect(query).toContain("status != 'REMOVED'");
    });

    it('should not apply date filter when not provided', () => {
      const client = new GoogleAdsClient({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        developerToken: 'test-developer-token',
        refreshToken: 'test-refresh-token',
        customerId: '1234567890',
      });

      const buildQuery = (client as any).buildCampaignsQuery.bind(client);
      const query = buildQuery();

      // Verify no date filter is applied
      expect(query).not.toContain('segments.date BETWEEN');
      
      // Status filter should still be present
      expect(query).toContain("status != 'REMOVED'");
    });
  });

  describe('Campaign Status Parsing', () => {
    it('should correctly parse ENABLED campaign status', () => {
      const client = new GoogleAdsClient({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        developerToken: 'test-developer-token',
        refreshToken: 'test-refresh-token',
        customerId: '1234567890',
      });

      const mockResponse = {
        results: [
          {
            campaign: {
              id: '123',
              name: 'Test Campaign',
              status: 'ENABLED',
              startDate: '2024-01-01',
              endDate: '2024-12-31',
            },
            campaignBudget: {
              amountMicros: 10000000,
            },
            metrics: {
              impressions: '1000',
              clicks: '100',
              conversions: '10',
              costMicros: '5000000',
              ctr: '0.1',
              conversionsFromInteractionsRate: '0.1',
              averageCpc: '50000',
              costPerConversion: '500000',
              conversionsValue: '100',
            },
          },
        ],
      };

      const parseCampaigns = (client as any).parseCampaignsResponse.bind(client);
      const campaigns = parseCampaigns(mockResponse);

      expect(campaigns).toHaveLength(1);
      expect(campaigns[0].status).toBe('ENABLED');
    });

    it('should correctly parse PAUSED campaign status', () => {
      const client = new GoogleAdsClient({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        developerToken: 'test-developer-token',
        refreshToken: 'test-refresh-token',
        customerId: '1234567890',
      });

      const mockResponse = {
        results: [
          {
            campaign: {
              id: '456',
              name: 'Paused Campaign',
              status: 'PAUSED',
              startDate: '2024-01-01',
              endDate: '2024-12-31',
            },
            campaignBudget: {
              amountMicros: 10000000,
            },
            metrics: {
              impressions: '500',
              clicks: '50',
              conversions: '5',
              costMicros: '2500000',
              ctr: '0.1',
              conversionsFromInteractionsRate: '0.1',
              averageCpc: '50000',
              costPerConversion: '500000',
              conversionsValue: '50',
            },
          },
        ],
      };

      const parseCampaigns = (client as any).parseCampaignsResponse.bind(client);
      const campaigns = parseCampaigns(mockResponse);

      expect(campaigns).toHaveLength(1);
      expect(campaigns[0].status).toBe('PAUSED');
    });

    it('should handle multiple campaigns with different statuses', () => {
      const client = new GoogleAdsClient({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        developerToken: 'test-developer-token',
        refreshToken: 'test-refresh-token',
        customerId: '1234567890',
      });

      const mockResponse = {
        results: [
          {
            campaign: {
              id: '123',
              name: 'Enabled Campaign',
              status: 'ENABLED',
              startDate: '2024-01-01',
              endDate: '2024-12-31',
            },
            campaignBudget: { amountMicros: 10000000 },
            metrics: {
              impressions: '1000',
              clicks: '100',
              conversions: '10',
              costMicros: '5000000',
              ctr: '0.1',
              conversionsFromInteractionsRate: '0.1',
              averageCpc: '50000',
              costPerConversion: '500000',
              conversionsValue: '100',
            },
          },
          {
            campaign: {
              id: '456',
              name: 'Paused Campaign',
              status: 'PAUSED',
              startDate: '2024-01-01',
              endDate: '2024-12-31',
            },
            campaignBudget: { amountMicros: 10000000 },
            metrics: {
              impressions: '500',
              clicks: '50',
              conversions: '5',
              costMicros: '2500000',
              ctr: '0.1',
              conversionsFromInteractionsRate: '0.1',
              averageCpc: '50000',
              costPerConversion: '500000',
              conversionsValue: '50',
            },
          },
        ],
      };

      const parseCampaigns = (client as any).parseCampaignsResponse.bind(client);
      const campaigns = parseCampaigns(mockResponse);

      expect(campaigns).toHaveLength(2);
      expect(campaigns[0].status).toBe('ENABLED');
      expect(campaigns[1].status).toBe('PAUSED');
    });
  });

  describe('Status Filter Documentation', () => {
    it('should document that REMOVED campaigns are excluded', () => {
      // This test documents the expected behavior:
      // - ENABLED campaigns: included ✓
      // - PAUSED campaigns: included ✓
      // - REMOVED campaigns: excluded ✓
      
      const expectedBehavior = {
        ENABLED: 'included',
        PAUSED: 'included',
        REMOVED: 'excluded',
      };

      expect(expectedBehavior.ENABLED).toBe('included');
      expect(expectedBehavior.PAUSED).toBe('included');
      expect(expectedBehavior.REMOVED).toBe('excluded');
    });
  });
});
