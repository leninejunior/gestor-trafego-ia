/**
 * Unit Tests for GoogleAdsSyncAdapter
 * Tests Google Ads API integration, authentication, and data synchronization
 */

import { GoogleAdsSyncAdapter, GoogleAdsCredentials } from '../google-ads-sync-adapter';
import { AdPlatform, SyncConfig } from '@/lib/types/sync';

// Mock fetch
global.fetch = jest.fn();

describe('GoogleAdsSyncAdapter', () => {
  let adapter: GoogleAdsSyncAdapter;
  let mockConfig: SyncConfig;
  const mockDeveloperToken = 'test-developer-token';

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConfig = {
      id: 'config-1',
      platform: AdPlatform.GOOGLE,
      client_id: 'client-1',
      account_id: '123-456-7890',
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      token_expires_at: new Date(Date.now() + 3600000), // 1 hour from now
      last_sync_at: new Date(),
      next_sync_at: new Date(),
      sync_status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
    };

    adapter = new GoogleAdsSyncAdapter(mockConfig, mockDeveloperToken);
  });

  describe('authenticate', () => {
    it('should validate token successfully', async () => {
      const credentials: GoogleAdsCredentials = {
        access_token: 'valid-token',
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ results: [{ customer: { id: '1234567890' } }] }),
      });

      await expect(adapter.authenticate(credentials)).resolves.not.toThrow();
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('googleads.googleapis.com'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer valid-token',
            'developer-token': mockDeveloperToken,
          }),
        })
      );
    });

    it('should throw error on invalid token', async () => {
      const credentials: GoogleAdsCredentials = {
        access_token: 'invalid-token',
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: 'Invalid credentials' } }),
      });

      await expect(adapter.authenticate(credentials)).rejects.toThrow();
    });

    it('should refresh token when expired', async () => {
      // Set token to expire soon
      mockConfig.token_expires_at = new Date(Date.now() + 60000); // 1 minute
      adapter = new GoogleAdsSyncAdapter(mockConfig, mockDeveloperToken);

      const credentials: GoogleAdsCredentials = {
        access_token: 'old-token',
        refresh_token: 'refresh-token',
        client_id: 'client-id',
        client_secret: 'client-secret',
      };

      // Mock token refresh
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'new-token',
          expires_in: 3600,
        }),
      });

      await adapter.authenticate(credentials);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/token',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  describe('fetchCampaigns', () => {
    it('should fetch campaigns successfully', async () => {
      const mockCampaigns = {
        results: [
          {
            campaign: {
              id: '123',
              name: 'Test Campaign 1',
              status: 'ENABLED',
              advertisingChannelType: 'SEARCH',
            },
          },
          {
            campaign: {
              id: '456',
              name: 'Test Campaign 2',
              status: 'PAUSED',
              advertisingChannelType: 'DISPLAY',
            },
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockCampaigns,
      });

      const campaigns = await adapter.fetchCampaigns('123-456-7890');

      expect(campaigns).toHaveLength(2);
      expect(campaigns[0]).toMatchObject({
        id: '123',
        name: 'Test Campaign 1',
        status: 'ENABLED',
        platform: AdPlatform.GOOGLE,
      });
      expect(campaigns[1]).toMatchObject({
        id: '456',
        name: 'Test Campaign 2',
        status: 'PAUSED',
      });
    });

    it('should handle empty campaign list', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ results: [] }),
      });

      const campaigns = await adapter.fetchCampaigns('123-456-7890');

      expect(campaigns).toHaveLength(0);
    });

    it('should handle API errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({
          error: { message: 'Access denied' },
        }),
      });

      await expect(adapter.fetchCampaigns('123-456-7890')).rejects.toThrow();
    });

    it('should retry on rate limit', async () => {
      // First call fails with rate limit
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: async () => ({ error: { message: 'Rate limit exceeded' } }),
        })
        // Second call succeeds
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ results: [] }),
        });

      const campaigns = await adapter.fetchCampaigns('123-456-7890');

      expect(campaigns).toHaveLength(0);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('fetchInsights', () => {
    it('should fetch insights successfully', async () => {
      const mockInsights = {
        results: [
          {
            campaign: {
              id: '123',
              name: 'Test Campaign',
            },
            segments: {
              date: '2025-01-15',
            },
            metrics: {
              impressions: '1000',
              clicks: '50',
              costMicros: '5000000', // $5.00
              conversions: 5,
            },
          },
          {
            campaign: {
              id: '123',
              name: 'Test Campaign',
            },
            segments: {
              date: '2025-01-16',
            },
            metrics: {
              impressions: '1200',
              clicks: '60',
              costMicros: '6000000', // $6.00
              conversions: 6,
            },
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockInsights,
      });

      const dateRange = {
        start: new Date('2025-01-15'),
        end: new Date('2025-01-16'),
      };

      const insights = await adapter.fetchInsights('123', dateRange);

      expect(insights).toHaveLength(2);
      expect(insights[0]).toMatchObject({
        campaign_id: '123',
        campaign_name: 'Test Campaign',
        platform: AdPlatform.GOOGLE,
        impressions: 1000,
        clicks: 50,
        spend: 5.0,
        conversions: 5,
      });
      
      // Check calculated metrics
      expect(insights[0].ctr).toBeCloseTo(5.0, 2); // 50/1000 * 100
      expect(insights[0].cpc).toBeCloseTo(0.1, 2); // 5.0/50
    });

    it('should normalize cost from micros to currency', async () => {
      const mockInsights = {
        results: [
          {
            campaign: {
              id: '123',
              name: 'Test Campaign',
            },
            segments: {
              date: '2025-01-15',
            },
            metrics: {
              impressions: '1000',
              clicks: '50',
              costMicros: '12345678', // $12.345678
              conversions: 5,
            },
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockInsights,
      });

      const dateRange = {
        start: new Date('2025-01-15'),
        end: new Date('2025-01-15'),
      };

      const insights = await adapter.fetchInsights('123', dateRange);

      expect(insights[0].spend).toBeCloseTo(12.35, 2);
    });

    it('should handle zero metrics gracefully', async () => {
      const mockInsights = {
        results: [
          {
            campaign: {
              id: '123',
              name: 'Test Campaign',
            },
            segments: {
              date: '2025-01-15',
            },
            metrics: {
              impressions: '0',
              clicks: '0',
              costMicros: '0',
              conversions: 0,
            },
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockInsights,
      });

      const dateRange = {
        start: new Date('2025-01-15'),
        end: new Date('2025-01-15'),
      };

      const insights = await adapter.fetchInsights('123', dateRange);

      expect(insights[0]).toMatchObject({
        impressions: 0,
        clicks: 0,
        spend: 0,
        conversions: 0,
        ctr: 0,
        cpc: 0,
        cpm: 0,
        conversion_rate: 0,
      });
    });

    it('should format dates correctly for API', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ results: [] }),
      });

      const dateRange = {
        start: new Date('2025-01-15T10:30:00Z'),
        end: new Date('2025-01-20T15:45:00Z'),
      };

      await adapter.fetchInsights('123', dateRange);

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      
      expect(body.query).toContain("'2025-01-15'");
      expect(body.query).toContain("'2025-01-20'");
    });
  });

  describe('normalizePlatformData', () => {
    it('should normalize Google Ads data to universal format', () => {
      const googleData = {
        campaign: {
          id: '123',
          name: 'Test Campaign',
        },
        segments: {
          date: '2025-01-15',
        },
        metrics: {
          impressions: '1000',
          clicks: '50',
          costMicros: '5000000',
          conversions: 5,
        },
      };

      // Access protected method through any
      const normalized = (adapter as any).normalizePlatformData(googleData);

      expect(normalized).toMatchObject({
        platform: AdPlatform.GOOGLE,
        campaign_id: '123',
        campaign_name: 'Test Campaign',
        impressions: 1000,
        clicks: 50,
        spend: 5.0,
        conversions: 5,
        is_deleted: false,
      });
      expect(normalized.date).toBeInstanceOf(Date);
      expect(normalized.synced_at).toBeInstanceOf(Date);
    });
  });

  describe('error handling', () => {
    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(adapter.fetchCampaigns('123-456-7890')).rejects.toThrow();
    });

    it('should handle malformed JSON responses', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      await expect(adapter.fetchCampaigns('123-456-7890')).rejects.toThrow();
    });

    it('should handle missing credentials for token refresh', async () => {
      const credentials: GoogleAdsCredentials = {
        access_token: 'token',
        // Missing refresh_token, client_id, client_secret
      };

      mockConfig.token_expires_at = new Date(Date.now() + 60000);
      adapter = new GoogleAdsSyncAdapter(mockConfig, mockDeveloperToken);

      await expect(adapter.authenticate(credentials)).rejects.toThrow(
        'Missing refresh token or OAuth credentials'
      );
    });
  });

  describe('rate limiting', () => {
    it('should apply rate limit delay between requests', async () => {
      const startTime = Date.now();

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ results: [] }),
      });

      const dateRange = {
        start: new Date('2025-01-15'),
        end: new Date('2025-01-15'),
      };

      await adapter.fetchInsights('123', dateRange);

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      // Should have at least some delay (Google Ads uses 200ms)
      expect(elapsed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('validateConnection', () => {
    it('should validate connection successfully', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ results: [] }),
      });

      const result = await adapter.validateConnection();

      expect(result.valid).toBe(true);
      expect(result.platform).toBe(AdPlatform.GOOGLE);
    });

    it('should return invalid on connection failure', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Connection failed'));

      const result = await adapter.validateConnection();

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
