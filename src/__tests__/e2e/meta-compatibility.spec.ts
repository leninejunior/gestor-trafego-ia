/**
 * Meta Ads Compatibility E2E Tests
 * 
 * Tests that Meta Ads functionality remains unaffected by Google Ads integration
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration
const TEST_CONFIG = {
  baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000',
  timeout: 30000,
  testUser: {
    email: 'test@example.com',
    password: 'testpassword123',
  },
  mockMetaCampaigns: [
    {
      id: 'meta-campaign-123',
      name: 'Meta Test Campaign 1',
      status: 'ACTIVE',
      budget: 150.00,
      impressions: 20000,
      clicks: 800,
      conversions: 40,
      spend: 100.00,
    },
    {
      id: 'meta-campaign-456',
      name: 'Meta Test Campaign 2',
      status: 'PAUSED',
      budget: 250.00,
      impressions: 30000,
      clicks: 1200,
      conversions: 60,
      spend: 180.00,
    },
  ],
};

test.describe('Meta Ads Compatibility E2E', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    
    // Mock Meta Ads API responses (existing functionality)
    await page.route('**/api/meta/campaigns**', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          campaigns: TEST_CONFIG.mockMetaCampaigns,
          pagination: {
            total: TEST_CONFIG.mockMetaCampaigns.length,
            page: 1,
            limit: 20,
            totalPages: 1,
          },
          lastSync: new Date().toISOString(),
        }),
      });
    });

    await page.route('**/api/meta/insights**', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          insights: TEST_CONFIG.mockMetaCampaigns.map(campaign => ({
            campaignId: campaign.id,
            impressions: campaign.impressions,
            clicks: campaign.clicks,
            conversions: campaign.conversions,
            spend: campaign.spend,
            ctr: (campaign.clicks / campaign.impressions * 100).toFixed(2),
            cpc: (campaign.spend / campaign.clicks).toFixed(2),
            cpa: (campaign.spend / campaign.conversions).toFixed(2),
          })),
          summary: {
            totalImpressions: 50000,
            totalClicks: 2000,
            totalConversions: 100,
            totalSpend: 280.00,
          },
        }),
      });
    });

    await page.route('**/api/meta/auth**', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          authUrl: 'https://www.facebook.com/v18.0/dialog/oauth?test=true',
          state: 'meta-state-123',
        }),
      });
    });

    await page.route('**/api/meta/sync**', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          success: true,
          syncId: 'meta-sync-123',
          campaignsSynced: 2,
          metricsUpdated: 14,
        }),
      });
    });

    // Mock Google Ads APIs to ensure they don't interfere
    await page.route('**/api/google/**', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true }),
      });
    });

    // Login and setup Meta connection only
    await loginAsTestUser(page);
    await setupConnectedMetaAds(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test.describe('Meta Dashboard Functionality', () => {
    test('should display Meta dashboard without Google interference', async () => {
      await page.goto('/dashboard/meta');
      
      // Should show Meta dashboard title
      await expect(page.getByText('Meta Ads')).toBeVisible();
      
      // Should show Meta-specific KPIs
      await expect(page.getByTestId('meta-kpi-impressions')).toBeVisible();
      await expect(page.getByTestId('meta-kpi-clicks')).toBeVisible();
      await expect(page.getByTestId('meta-kpi-conversions')).toBeVisible();
      await expect(page.getByTestId('meta-kpi-spend')).toBeVisible();
      
      // Verify Meta KPI values
      await expect(page.getByTestId('meta-kpi-impressions')).toContainText('50,000');
      await expect(page.getByTestId('meta-kpi-clicks')).toContainText('2,000');
      await expect(page.getByTestId('meta-kpi-conversions')).toContainText('100');
      await expect(page.getByTestId('meta-kpi-spend')).toContainText('$280.00');
      
      // Should not show Google Ads elements
      await expect(page.getByText('Google Ads')).not.toBeVisible();
      await expect(page.getByTestId('google-kpi-impressions')).not.toBeVisible();
    });

    test('should show Meta campaigns list correctly', async () => {
      await page.goto('/dashboard/meta');
      
      // Should show Meta campaigns table
      await expect(page.getByTestId('meta-campaigns-table')).toBeVisible();
      
      // Should show Meta campaign data
      await expect(page.getByText('Meta Test Campaign 1')).toBeVisible();
      await expect(page.getByText('Meta Test Campaign 2')).toBeVisible();
      
      // Should show Meta-specific status badges
      await expect(page.getByTestId('meta-status-badge-ACTIVE')).toBeVisible();
      await expect(page.getByTestId('meta-status-badge-PAUSED')).toBeVisible();
      
      // Should not show Google campaigns
      await expect(page.getByText('Google Campaign')).not.toBeVisible();
    });

    test('should maintain Meta sync functionality', async () => {
      await page.goto('/dashboard/meta');
      
      // Should show Meta sync button
      await expect(page.getByTestId('meta-sync-button')).toBeVisible();
      
      // Click Meta sync
      await page.click('[data-testid="meta-sync-button"]');
      
      // Should show Meta sync in progress
      await expect(page.getByText('Sincronizando Meta Ads')).toBeVisible();
      await expect(page.getByTestId('meta-sync-progress')).toBeVisible();
      
      // Wait for sync completion
      await page.waitForTimeout(2000);
      
      // Should show Meta sync completed
      await expect(page.getByText('Meta Ads sincronizado')).toBeVisible();
      await expect(page.getByText('2 campanhas sincronizadas')).toBeVisible();
    });

    test('should preserve Meta filtering and search', async () => {
      await page.goto('/dashboard/meta');
      
      // Test Meta campaign search
      await page.fill('[data-testid="meta-campaign-search"]', 'Campaign 1');
      await page.press('[data-testid="meta-campaign-search"]', 'Enter');
      
      // Should show only matching Meta campaign
      await expect(page.getByText('Meta Test Campaign 1')).toBeVisible();
      await expect(page.getByText('Meta Test Campaign 2')).not.toBeVisible();
      
      // Test Meta status filter
      await page.fill('[data-testid="meta-campaign-search"]', '');
      await page.press('[data-testid="meta-campaign-search"]', 'Enter');
      
      await page.click('[data-testid="meta-status-filter"]');
      await page.click('[data-testid="meta-filter-status-ACTIVE"]');
      
      // Should show only active Meta campaigns
      await expect(page.getByText('Meta Test Campaign 1')).toBeVisible();
      await expect(page.getByText('Meta Test Campaign 2')).not.toBeVisible();
    });
  });

  test.describe('Meta Connection Management', () => {
    test('should maintain Meta OAuth flow', async () => {
      // Disconnect Meta first
      await page.goto('/dashboard/meta');
      await page.click('[data-testid="meta-connection-settings"]');
      await page.click('[data-testid="disconnect-meta"]');
      await page.click('[data-testid="confirm-disconnect"]');
      
      // Should show Meta connection prompt
      await expect(page.getByTestId('connect-meta-ads')).toBeVisible();
      
      // Click connect Meta
      await page.click('[data-testid="connect-meta-ads"]');
      
      // Should redirect to Meta OAuth (mocked)
      await page.waitForURL(/.*facebook\.com.*/);
      await expect(page.getByText('Facebook OAuth')).toBeVisible();
      
      // Complete OAuth flow
      await page.goBack();
      await page.goto('/dashboard/meta?code=meta-auth-code&state=meta-state-123');
      
      // Should show Meta connection success
      await expect(page.getByText('Meta Ads conectado com sucesso')).toBeVisible();
    });

    test('should show Meta connection status independently', async () => {
      await page.goto('/dashboard/meta');
      
      // Should show Meta connection status
      await expect(page.getByTestId('meta-connection-status')).toBeVisible();
      await expect(page.getByText('Meta Ads Conectado')).toBeVisible();
      
      // Should show Meta account details
      await expect(page.getByTestId('meta-account-info')).toBeVisible();
      await expect(page.getByText('Test Meta Account')).toBeVisible();
      
      // Should not show Google connection info
      await expect(page.getByText('Google Ads Conectado')).not.toBeVisible();
    });

    test('should handle Meta token refresh independently', async () => {
      // Mock Meta token expired
      await page.route('**/api/meta/campaigns**', route => {
        route.fulfill({
          status: 401,
          body: JSON.stringify({
            error: 'Meta token expired',
            code: 'AUTHENTICATION_ERROR',
          }),
        });
      });

      await page.goto('/dashboard/meta');
      
      // Should show Meta token expired warning
      await expect(page.getByText('Token Meta expirado')).toBeVisible();
      await expect(page.getByTestId('meta-reconnect-button')).toBeVisible();
      
      // Should not affect Google connection status
      await expect(page.getByText('Google token')).not.toBeVisible();
    });
  });

  test.describe('Meta Analytics and Insights', () => {
    test('should display Meta analytics without Google data', async () => {
      await page.goto('/dashboard/analytics');
      
      // Should show Meta analytics section
      await expect(page.getByTestId('meta-analytics-section')).toBeVisible();
      
      // Should show Meta performance charts
      await expect(page.getByTestId('meta-performance-chart')).toBeVisible();
      
      // Should show Meta insights
      await expect(page.getByTestId('meta-insights')).toBeVisible();
      await expect(page.getByText('Meta Ads Performance')).toBeVisible();
      
      // Should not show Google analytics when not connected
      await expect(page.getByTestId('google-analytics-section')).not.toBeVisible();
    });

    test('should maintain Meta campaign details functionality', async () => {
      await page.goto('/dashboard/meta');
      
      // Click on Meta campaign
      await page.click('[data-testid="meta-campaign-link-meta-campaign-123"]');
      
      // Should navigate to Meta campaign details
      await expect(page).toHaveURL(/.*meta\/campaigns\/meta-campaign-123.*/);
      
      // Should show Meta campaign details
      await expect(page.getByText('Meta Test Campaign 1')).toBeVisible();
      await expect(page.getByTestId('meta-campaign-status')).toContainText('ACTIVE');
      
      // Should show Meta-specific metrics
      await expect(page.getByTestId('meta-detailed-metrics')).toBeVisible();
      await expect(page.getByTestId('meta-metric-ctr')).toBeVisible();
      await expect(page.getByTestId('meta-metric-cpc')).toBeVisible();
      
      // Should not show Google metrics
      await expect(page.getByTestId('google-detailed-metrics')).not.toBeVisible();
    });

    test('should preserve Meta export functionality', async () => {
      await page.goto('/dashboard/meta');
      
      // Click Meta export
      await page.click('[data-testid="export-meta-data"]');
      await expect(page.getByTestId('meta-export-modal')).toBeVisible();
      
      // Should show Meta export options
      await expect(page.getByText('Exportar Dados Meta Ads')).toBeVisible();
      await expect(page.getByTestId('meta-export-format')).toBeVisible();
      
      // Configure Meta export
      await page.click('[data-testid="meta-export-format-csv"]');
      await page.check('[data-testid="meta-export-impressions"]');
      await page.check('[data-testid="meta-export-clicks"]');
      
      // Start Meta export
      const downloadPromise = page.waitForEvent('download');
      await page.click('[data-testid="start-meta-export"]');
      
      // Should download Meta data only
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/meta-ads.*\.csv$/);
    });
  });

  test.describe('Navigation and Menu Integrity', () => {
    test('should preserve existing Meta menu items', async () => {
      await page.goto('/dashboard');
      
      // Should show existing Meta menu items
      await expect(page.getByTestId('sidebar-campanhas')).toBeVisible(); // Original Meta menu
      await expect(page.getByText('Campanhas')).toBeVisible();
      
      // Should show Meta insights menu
      await expect(page.getByTestId('sidebar-insights')).toBeVisible();
      await expect(page.getByText('Insights')).toBeVisible();
      
      // Click on Campanhas (Meta)
      await page.click('[data-testid="sidebar-campanhas"]');
      
      // Should navigate to Meta dashboard
      await expect(page).toHaveURL(/.*dashboard\/meta.*/);
      await expect(page.getByText('Meta Ads')).toBeVisible();
    });

    test('should maintain Meta breadcrumb navigation', async () => {
      await page.goto('/dashboard/meta');
      
      // Should show Meta breadcrumbs
      await expect(page.getByTestId('breadcrumb')).toBeVisible();
      await expect(page.getByText('Dashboard')).toBeVisible();
      await expect(page.getByText('Meta Ads')).toBeVisible();
      
      // Navigate to Meta campaign details
      await page.click('[data-testid="meta-campaign-link-meta-campaign-123"]');
      
      // Should show updated breadcrumbs
      await expect(page.getByText('Meta Test Campaign 1')).toBeVisible();
      
      // Click breadcrumb to go back
      await page.click('[data-testid="breadcrumb-meta-ads"]');
      
      // Should return to Meta dashboard
      await expect(page).toHaveURL(/.*dashboard\/meta.*/);
    });

    test('should preserve Meta sidebar state', async () => {
      await page.goto('/dashboard/meta');
      
      // Meta menu item should be active
      await expect(page.getByTestId('sidebar-campanhas')).toHaveClass(/.*active.*/);
      
      // Google menu items should not be active
      await expect(page.getByTestId('sidebar-google-ads')).not.toHaveClass(/.*active.*/);
      
      // Navigate to Meta insights
      await page.click('[data-testid="sidebar-insights"]');
      
      // Meta insights should be active
      await expect(page.getByTestId('sidebar-insights')).toHaveClass(/.*active.*/);
    });
  });

  test.describe('Data Isolation Verification', () => {
    test('should not mix Meta and Google data', async () => {
      await page.goto('/dashboard/meta');
      
      // Verify only Meta data is shown
      const campaignNames = await page.getByTestId('campaign-name').allTextContents();
      campaignNames.forEach(name => {
        expect(name).toContain('Meta');
        expect(name).not.toContain('Google');
      });
      
      // Verify Meta metrics are isolated
      const metricsCards = await page.getByTestId('metrics-card').all();
      for (const card of metricsCards) {
        const cardText = await card.textContent();
        expect(cardText).not.toContain('Google');
      }
    });

    test('should maintain Meta API endpoints isolation', async () => {
      let metaApiCalled = false;
      let googleApiCalled = false;
      
      // Monitor API calls
      page.on('request', request => {
        if (request.url().includes('/api/meta/')) {
          metaApiCalled = true;
        }
        if (request.url().includes('/api/google/')) {
          googleApiCalled = true;
        }
      });
      
      await page.goto('/dashboard/meta');
      
      // Wait for page to load
      await page.waitForTimeout(1000);
      
      // Should call Meta APIs only
      expect(metaApiCalled).toBe(true);
      expect(googleApiCalled).toBe(false);
    });

    test('should preserve Meta database queries', async () => {
      // Mock database query verification
      await page.route('**/api/meta/campaigns**', route => {
        const url = new URL(route.request().url());
        
        // Verify Meta-specific parameters
        expect(url.searchParams.get('platform')).toBe('meta');
        
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            campaigns: TEST_CONFIG.mockMetaCampaigns,
            platform: 'meta',
          }),
        });
      });
      
      await page.goto('/dashboard/meta');
      
      // Should load Meta campaigns with correct platform filter
      await expect(page.getByText('Meta Test Campaign 1')).toBeVisible();
    });
  });

  test.describe('Performance and Stability', () => {
    test('should maintain Meta dashboard performance', async () => {
      const startTime = Date.now();
      
      await page.goto('/dashboard/meta');
      
      // Wait for all Meta content to load
      await expect(page.getByTestId('meta-campaigns-table')).toBeVisible();
      await expect(page.getByTestId('meta-kpi-impressions')).toBeVisible();
      
      const loadTime = Date.now() - startTime;
      
      // Should load within reasonable time (5 seconds)
      expect(loadTime).toBeLessThan(5000);
    });

    test('should handle Meta errors independently', async () => {
      // Mock Meta API error
      await page.route('**/api/meta/campaigns**', route => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({
            error: 'Meta API error',
          }),
        });
      });
      
      await page.goto('/dashboard/meta');
      
      // Should show Meta-specific error
      await expect(page.getByText('Erro ao carregar campanhas Meta')).toBeVisible();
      
      // Should show Meta retry option
      await expect(page.getByTestId('retry-meta-campaigns')).toBeVisible();
      
      // Should not affect other parts of the system
      await expect(page.getByTestId('sidebar')).toBeVisible();
      await expect(page.getByTestId('header')).toBeVisible();
    });

    test('should maintain Meta real-time updates', async () => {
      await page.goto('/dashboard/meta');
      
      // Should show Meta auto-refresh indicator
      await expect(page.getByTestId('meta-auto-refresh')).toBeVisible();
      
      // Mock updated Meta data
      await page.route('**/api/meta/campaigns**', route => {
        const updatedCampaigns = TEST_CONFIG.mockMetaCampaigns.map(campaign => ({
          ...campaign,
          impressions: campaign.impressions + 1000, // Updated values
        }));
        
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            campaigns: updatedCampaigns,
          }),
        });
      });
      
      // Wait for auto-refresh
      await page.waitForTimeout(3000);
      
      // Should show updated Meta values
      await expect(page.getByTestId('meta-kpi-impressions')).toContainText('52,000');
    });
  });

  test.describe('Backward Compatibility', () => {
    test('should support existing Meta URLs', async () => {
      // Test legacy Meta URLs still work
      await page.goto('/dashboard/campanhas'); // Legacy Meta URL
      
      // Should redirect or show Meta content
      await expect(page.getByText('Meta Ads')).toBeVisible();
      await expect(page.getByTestId('meta-campaigns-table')).toBeVisible();
    });

    test('should maintain Meta API response format', async () => {
      let apiResponse: any;
      
      page.on('response', async response => {
        if (response.url().includes('/api/meta/campaigns')) {
          apiResponse = await response.json();
        }
      });
      
      await page.goto('/dashboard/meta');
      
      // Wait for API call
      await page.waitForTimeout(1000);
      
      // Verify Meta API response structure is unchanged
      expect(apiResponse).toHaveProperty('campaigns');
      expect(apiResponse).toHaveProperty('pagination');
      expect(apiResponse.campaigns[0]).toHaveProperty('id');
      expect(apiResponse.campaigns[0]).toHaveProperty('name');
      expect(apiResponse.campaigns[0]).toHaveProperty('status');
    });

    test('should preserve Meta component props and interfaces', async () => {
      await page.goto('/dashboard/meta');
      
      // Verify Meta components render correctly
      await expect(page.getByTestId('meta-campaigns-table')).toBeVisible();
      await expect(page.getByTestId('meta-kpi-cards')).toBeVisible();
      
      // Verify Meta component functionality
      await page.click('[data-testid="meta-campaign-row-0"]');
      await expect(page.getByTestId('meta-campaign-details')).toBeVisible();
    });
  });
});

// Helper functions
async function loginAsTestUser(page: Page) {
  await page.goto('/auth/login');
  await page.fill('[data-testid="email-input"]', TEST_CONFIG.testUser.email);
  await page.fill('[data-testid="password-input"]', TEST_CONFIG.testUser.password);
  await page.click('[data-testid="login-button"]');
  await page.waitForURL('/dashboard');
}

async function setupConnectedMetaAds(page: Page) {
  // Mock Meta connected state
  await page.evaluate(() => {
    localStorage.setItem('meta-ads-connected', 'true');
    localStorage.setItem('meta-ads-account-id', '9876543210');
    localStorage.setItem('meta-ads-account-name', 'Test Meta Account');
  });
  
  // Mock Meta connection status API
  await page.route('**/api/meta/connections**', route => {
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        connections: [
          {
            id: 'meta-connection-123',
            accountId: '9876543210',
            accountName: 'Test Meta Account',
            status: 'active',
            lastSyncAt: new Date().toISOString(),
          },
        ],
      }),
    });
  });
}