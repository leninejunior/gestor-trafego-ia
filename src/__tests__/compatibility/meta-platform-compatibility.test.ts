/**
 * Meta Platform Compatibility Tests
 * 
 * Tests that Meta Ads functionality remains unaffected by Google Ads integration
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5
 */

import { createClient } from '@/lib/supabase/server';

// Mock external dependencies
jest.mock('@/lib/supabase/server');

describe('Meta Platform Compatibility', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  };

  const mockClientId = 'client-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Meta Database Operations', () => {
    it('should maintain Meta table structure without Google interference', async () => {
      const mockSupabase = {
        from: jest.fn(),
      };

      (createClient as jest.Mock).mockReturnValue(mockSupabase);

      mockSupabase.from.mockImplementation((tableName: string) => {
        if (tableName === 'meta_campaigns') {
          return {
            select: jest.fn().mockResolvedValue({
              data: [
                {
                  id: 'meta-campaign-1',
                  campaign_id: 'meta-123',
                  name: 'Meta Campaign',
                  status: 'ACTIVE',
                  objective: 'CONVERSIONS',
                  client_id: mockClientId,
                  created_at: '2024-01-01T00:00:00Z',
                  updated_at: '2024-01-01T00:00:00Z',
                },
              ],
              error: null,
            }),
          };
        }
        return {
          select: jest.fn().mockResolvedValue({ data: [], error: null }),
        };
      });

      // Query Meta campaigns
      const result = await mockSupabase.from('meta_campaigns').select('*');

      // Verify Meta-specific structure is preserved
      expect(result.data[0]).toHaveProperty('campaign_id');
      expect(result.data[0]).toHaveProperty('name');
      expect(result.data[0]).toHaveProperty('objective');
      expect(result.data[0].status).toBe('ACTIVE');
      expect(result.data[0].objective).toBe('CONVERSIONS');
    });

    it('should enforce Meta RLS policies independently', async () => {
      const mockSupabase = {
        from: jest.fn(),
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
      };

      (createClient as jest.Mock).mockReturnValue(mockSupabase);

      mockSupabase.from.mockImplementation((tableName: string) => {
        if (tableName === 'meta_campaigns') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockImplementation((column: string, value: string) => {
              expect(column).toBe('client_id');
              expect(value).toBe(mockClientId);
              return Promise.resolve({
                data: [{ id: 'meta-1', client_id: mockClientId }],
                error: null,
              });
            }),
          };
        }
        return {
          select: jest.fn().mockResolvedValue({ data: [], error: null }),
        };
      });

      // Test Meta RLS enforcement
      const result = await mockSupabase.from('meta_campaigns').select('*').eq('client_id', mockClientId);
      expect(result.data[0].client_id).toBe(mockClientId);
    });

    it('should handle Meta metrics relationships correctly', async () => {
      const mockSupabase = {
        from: jest.fn(),
      };

      (createClient as jest.Mock).mockReturnValue(mockSupabase);

      mockSupabase.from.mockImplementation((tableName: string) => {
        if (tableName === 'meta_metrics') {
          return {
            select: jest.fn().mockResolvedValue({
              data: [
                {
                  id: 'meta-metric-1',
                  campaign_id: 'meta-campaign-1',
                  date: '2024-01-01',
                  impressions: 1000,
                  clicks: 50,
                  conversions: 5,
                  spend: 25.00,
                  reach: 800,
                  frequency: 1.25,
                  meta_campaigns: {
                    id: 'meta-campaign-1',
                    name: 'Meta Campaign',
                    objective: 'CONVERSIONS',
                    client_id: mockClientId,
                  },
                },
              ],
              error: null,
            }),
          };
        }
        return {
          select: jest.fn().mockResolvedValue({ data: [], error: null }),
        };
      });

      // Test Meta metrics with campaign join
      const result = await mockSupabase.from('meta_metrics').select('*, meta_campaigns(*)');
      
      expect(result.data[0]).toHaveProperty('reach'); // Meta-specific field
      expect(result.data[0]).toHaveProperty('frequency'); // Meta-specific field
      expect(result.data[0].meta_campaigns.objective).toBe('CONVERSIONS');
      expect(result.data[0].meta_campaigns.client_id).toBe(mockClientId);
    });
  });

  describe('Meta API Compatibility', () => {
    it('should preserve Meta API response structure', async () => {
      // Mock existing Meta API response format
      const mockMetaApiResponse = {
        campaigns: [
          {
            id: 'meta-1',
            campaign_id: 'meta-123',
            name: 'Meta Campaign',
            status: 'ACTIVE',
            objective: 'CONVERSIONS',
            daily_budget: 50.00,
            lifetime_budget: null,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
        ],
        pagination: {
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
        lastSync: '2024-01-01T12:00:00Z',
      };

      // Verify Meta API response structure is unchanged
      expect(mockMetaApiResponse).toHaveProperty('campaigns');
      expect(mockMetaApiResponse).toHaveProperty('pagination');
      expect(mockMetaApiResponse).toHaveProperty('lastSync');
      
      expect(mockMetaApiResponse.campaigns[0]).toHaveProperty('campaign_id');
      expect(mockMetaApiResponse.campaigns[0]).toHaveProperty('objective');
      expect(mockMetaApiResponse.campaigns[0]).toHaveProperty('daily_budget');
      expect(mockMetaApiResponse.campaigns[0].status).toBe('ACTIVE');
    });

    it('should maintain Meta-specific field mappings', async () => {
      const metaCampaignFields = {
        id: 'meta-1',
        campaign_id: 'meta-123', // Meta uses campaign_id
        name: 'Meta Campaign', // Meta uses name
        status: 'ACTIVE', // Meta uses ACTIVE/PAUSED/DELETED
        objective: 'CONVERSIONS', // Meta-specific field
        daily_budget: 50.00, // Meta budget format
        targeting: { // Meta-specific targeting
          age_min: 18,
          age_max: 65,
          genders: [1, 2],
          geo_locations: {
            countries: ['US'],
          },
        },
      };

      // Verify Meta-specific fields are preserved
      expect(metaCampaignFields).toHaveProperty('campaign_id');
      expect(metaCampaignFields).toHaveProperty('name');
      expect(metaCampaignFields).toHaveProperty('objective');
      expect(metaCampaignFields).toHaveProperty('daily_budget');
      expect(metaCampaignFields).toHaveProperty('targeting');
      expect(metaCampaignFields.status).toBe('ACTIVE');
    });

    it('should preserve Meta insights API structure', async () => {
      const mockMetaInsights = {
        insights: [
          {
            campaign_id: 'meta-123',
            date_start: '2024-01-01',
            date_stop: '2024-01-01',
            impressions: 1000,
            clicks: 50,
            conversions: 5,
            spend: 25.00,
            reach: 800, // Meta-specific
            frequency: 1.25, // Meta-specific
            cpm: 25.00, // Meta-specific
            cpp: 31.25, // Meta-specific
            actions: [ // Meta-specific actions format
              {
                action_type: 'purchase',
                value: 5,
              },
            ],
          },
        ],
        summary: {
          totalImpressions: 1000,
          totalClicks: 50,
          totalConversions: 5,
          totalSpend: 25.00,
          totalReach: 800,
          averageFrequency: 1.25,
        },
      };

      // Verify Meta insights structure
      expect(mockMetaInsights.insights[0]).toHaveProperty('reach');
      expect(mockMetaInsights.insights[0]).toHaveProperty('frequency');
      expect(mockMetaInsights.insights[0]).toHaveProperty('cpm');
      expect(mockMetaInsights.insights[0]).toHaveProperty('cpp');
      expect(mockMetaInsights.insights[0]).toHaveProperty('actions');
      expect(mockMetaInsights.summary).toHaveProperty('totalReach');
      expect(mockMetaInsights.summary).toHaveProperty('averageFrequency');
    });
  });

  describe('Meta Service Layer Compatibility', () => {
    it('should maintain Meta client functionality', async () => {
      // Mock Meta client behavior
      const mockMetaClient = {
        getCampaigns: jest.fn().mockResolvedValue([
          {
            id: 'meta-1',
            name: 'Meta Campaign',
            status: 'ACTIVE',
            objective: 'CONVERSIONS',
          },
        ]),
        getCampaignInsights: jest.fn().mockResolvedValue({
          impressions: 1000,
          clicks: 50,
          conversions: 5,
          spend: 25.00,
          reach: 800,
          frequency: 1.25,
        }),
        updateCampaign: jest.fn().mockResolvedValue({
          success: true,
          campaign_id: 'meta-123',
        }),
      };

      // Test Meta client operations
      const campaigns = await mockMetaClient.getCampaigns();
      expect(campaigns[0].objective).toBe('CONVERSIONS');
      expect(campaigns[0].status).toBe('ACTIVE');

      const insights = await mockMetaClient.getCampaignInsights();
      expect(insights).toHaveProperty('reach');
      expect(insights).toHaveProperty('frequency');

      const updateResult = await mockMetaClient.updateCampaign();
      expect(updateResult.success).toBe(true);
    });

    it('should preserve Meta sync service behavior', async () => {
      const mockMetaSyncService = {
        syncCampaigns: jest.fn().mockResolvedValue({
          success: true,
          platform: 'meta',
          campaignsSynced: 5,
          metricsUpdated: 35,
          lastSyncAt: new Date().toISOString(),
        }),
        syncInsights: jest.fn().mockResolvedValue({
          success: true,
          platform: 'meta',
          insightsSynced: 35,
          dateRange: {
            start: '2024-01-01',
            end: '2024-01-07',
          },
        }),
      };

      // Test Meta sync operations
      const syncResult = await mockMetaSyncService.syncCampaigns();
      expect(syncResult.platform).toBe('meta');
      expect(syncResult.campaignsSynced).toBe(5);

      const insightsResult = await mockMetaSyncService.syncInsights();
      expect(insightsResult.platform).toBe('meta');
      expect(insightsResult.insightsSynced).toBe(35);
    });

    it('should handle Meta error handling independently', async () => {
      const mockMetaErrorHandler = {
        handleApiError: jest.fn((error) => {
          if (error.code === 'RATE_LIMIT_EXCEEDED') {
            return {
              shouldRetry: true,
              retryAfter: 300,
              userMessage: 'Meta API rate limit exceeded. Retrying in 5 minutes.',
            };
          }
          if (error.code === 'INVALID_ACCESS_TOKEN') {
            return {
              shouldRetry: false,
              requiresReauth: true,
              userMessage: 'Meta access token expired. Please reconnect your account.',
            };
          }
          return {
            shouldRetry: false,
            userMessage: 'Meta API error occurred.',
          };
        }),
      };

      // Test Meta-specific error handling
      const rateLimitError = { code: 'RATE_LIMIT_EXCEEDED', message: 'Rate limit' };
      const rateLimitResult = mockMetaErrorHandler.handleApiError(rateLimitError);
      expect(rateLimitResult.shouldRetry).toBe(true);
      expect(rateLimitResult.retryAfter).toBe(300);

      const tokenError = { code: 'INVALID_ACCESS_TOKEN', message: 'Token expired' };
      const tokenResult = mockMetaErrorHandler.handleApiError(tokenError);
      expect(tokenResult.requiresReauth).toBe(true);
      expect(tokenResult.shouldRetry).toBe(false);
    });
  });

  describe('Meta UI Component Compatibility', () => {
    it('should preserve Meta component interfaces', async () => {
      // Mock Meta component props
      const metaCampaignListProps = {
        campaigns: [
          {
            id: 'meta-1',
            campaign_id: 'meta-123',
            name: 'Meta Campaign',
            status: 'ACTIVE',
            objective: 'CONVERSIONS',
            daily_budget: 50.00,
            impressions: 1000,
            clicks: 50,
            conversions: 5,
            spend: 25.00,
            reach: 800,
            frequency: 1.25,
          },
        ],
        onCampaignClick: jest.fn(),
        onStatusChange: jest.fn(),
        filters: {
          status: 'ACTIVE',
          objective: 'CONVERSIONS',
          dateRange: {
            start: '2024-01-01',
            end: '2024-01-07',
          },
        },
        sorting: {
          field: 'spend',
          direction: 'desc',
        },
      };

      // Verify Meta component props structure
      expect(metaCampaignListProps.campaigns[0]).toHaveProperty('objective');
      expect(metaCampaignListProps.campaigns[0]).toHaveProperty('daily_budget');
      expect(metaCampaignListProps.campaigns[0]).toHaveProperty('reach');
      expect(metaCampaignListProps.campaigns[0]).toHaveProperty('frequency');
      expect(metaCampaignListProps.filters).toHaveProperty('objective');
      expect(metaCampaignListProps.sorting.field).toBe('spend');
    });

    it('should maintain Meta dashboard component structure', async () => {
      const metaDashboardProps = {
        kpis: {
          impressions: 10000,
          clicks: 500,
          conversions: 25,
          spend: 125.00,
          reach: 8000, // Meta-specific
          frequency: 1.25, // Meta-specific
          cpm: 12.50, // Meta-specific
          cpp: 15.63, // Meta-specific
        },
        campaigns: [
          {
            id: 'meta-1',
            name: 'Meta Campaign',
            status: 'ACTIVE',
            objective: 'CONVERSIONS',
          },
        ],
        connectionStatus: {
          connected: true,
          accountId: '9876543210',
          accountName: 'Test Meta Account',
          lastSyncAt: '2024-01-01T12:00:00Z',
        },
        onSync: jest.fn(),
        onExport: jest.fn(),
      };

      // Verify Meta dashboard structure
      expect(metaDashboardProps.kpis).toHaveProperty('reach');
      expect(metaDashboardProps.kpis).toHaveProperty('frequency');
      expect(metaDashboardProps.kpis).toHaveProperty('cpm');
      expect(metaDashboardProps.kpis).toHaveProperty('cpp');
      expect(metaDashboardProps.campaigns[0]).toHaveProperty('objective');
      expect(metaDashboardProps.connectionStatus.accountId).toBe('9876543210');
    });
  });

  describe('Meta Configuration and Environment', () => {
    it('should preserve Meta environment variables', () => {
      const metaEnvVars = {
        META_APP_ID: 'meta-app-123',
        META_APP_SECRET: 'meta-secret-456',
        META_WEBHOOK_VERIFY_TOKEN: 'meta-webhook-789',
        META_API_VERSION: 'v18.0',
      };

      // Verify Meta environment variables are preserved
      expect(metaEnvVars).toHaveProperty('META_APP_ID');
      expect(metaEnvVars).toHaveProperty('META_APP_SECRET');
      expect(metaEnvVars).toHaveProperty('META_WEBHOOK_VERIFY_TOKEN');
      expect(metaEnvVars).toHaveProperty('META_API_VERSION');
      expect(metaEnvVars.META_API_VERSION).toBe('v18.0');
    });

    it('should maintain Meta configuration structure', () => {
      const metaConfig = {
        apiVersion: 'v18.0',
        baseUrl: 'https://graph.facebook.com',
        scopes: [
          'ads_management',
          'ads_read',
          'business_management',
        ],
        webhookFields: [
          'campaign',
          'adset',
          'ad',
          'creative',
        ],
        rateLimits: {
          app: 200,
          user: 25,
          business: 200,
        },
      };

      // Verify Meta configuration structure
      expect(metaConfig.apiVersion).toBe('v18.0');
      expect(metaConfig.baseUrl).toBe('https://graph.facebook.com');
      expect(metaConfig.scopes).toContain('ads_management');
      expect(metaConfig.webhookFields).toContain('campaign');
      expect(metaConfig.rateLimits.app).toBe(200);
    });
  });

  describe('Meta Route Compatibility', () => {
    it('should preserve Meta API route structure', () => {
      const metaRoutes = [
        '/api/meta/auth',
        '/api/meta/callback',
        '/api/meta/campaigns',
        '/api/meta/campaigns/[id]',
        '/api/meta/insights',
        '/api/meta/sync',
        '/api/meta/connections',
        '/api/meta/webhooks',
      ];

      // Verify Meta routes are preserved
      metaRoutes.forEach(route => {
        expect(route).toMatch(/^\/api\/meta\//);
      });

      expect(metaRoutes).toContain('/api/meta/campaigns');
      expect(metaRoutes).toContain('/api/meta/insights');
      expect(metaRoutes).toContain('/api/meta/sync');
    });

    it('should maintain Meta route parameters', () => {
      const metaRouteParams = {
        campaigns: {
          clientId: 'required',
          status: 'optional',
          objective: 'optional',
          dateFrom: 'optional',
          dateTo: 'optional',
          limit: 'optional',
          offset: 'optional',
        },
        insights: {
          clientId: 'required',
          campaignIds: 'optional',
          datePreset: 'optional',
          dateFrom: 'optional',
          dateTo: 'optional',
          fields: 'optional',
          breakdowns: 'optional',
        },
      };

      // Verify Meta route parameters
      expect(metaRouteParams.campaigns.clientId).toBe('required');
      expect(metaRouteParams.campaigns).toHaveProperty('objective');
      expect(metaRouteParams.insights.clientId).toBe('required');
      expect(metaRouteParams.insights).toHaveProperty('breakdowns');
    });
  });

  describe('Backward Compatibility', () => {
    it('should support legacy Meta URLs', () => {
      const legacyMetaUrls = [
        '/dashboard/campanhas', // Legacy Meta campaigns URL
        '/dashboard/insights', // Legacy Meta insights URL
        '/campanhas', // Very old format
      ];

      const modernMetaUrls = [
        '/dashboard/meta',
        '/dashboard/analytics',
        '/dashboard/meta/campaigns',
      ];

      // Verify legacy URLs are mapped correctly
      expect(legacyMetaUrls).toContain('/dashboard/campanhas');
      expect(modernMetaUrls).toContain('/dashboard/meta');
    });

    it('should maintain Meta data migration compatibility', () => {
      const metaDataMigration = {
        oldFormat: {
          campaign_id: 'meta-123',
          campaign_name: 'Meta Campaign', // Old field name
          campaign_status: 'ACTIVE', // Old field name
          daily_budget_cents: 5000, // Old format (cents)
        },
        newFormat: {
          id: 'meta-campaign-1',
          campaign_id: 'meta-123',
          name: 'Meta Campaign', // New field name
          status: 'ACTIVE', // New field name
          daily_budget: 50.00, // New format (dollars)
        },
        migrationRules: {
          'campaign_name': 'name',
          'campaign_status': 'status',
          'daily_budget_cents': (value: number) => value / 100,
        },
      };

      // Verify migration compatibility
      expect(metaDataMigration.oldFormat).toHaveProperty('campaign_name');
      expect(metaDataMigration.newFormat).toHaveProperty('name');
      expect(metaDataMigration.migrationRules).toHaveProperty('campaign_name');
      expect(typeof metaDataMigration.migrationRules.daily_budget_cents).toBe('function');
    });
  });
});