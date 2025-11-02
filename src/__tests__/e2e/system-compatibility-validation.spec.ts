/**
 * System Compatibility Validation E2E Tests
 * 
 * End-to-end tests to validate system compatibility across different scenarios
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration
const TEST_CONFIG = {
  baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000',
  timeout: 30000,
  testUser: {
    email: 'compatibility-test@example.com',
    password: 'testpassword123',
  },
  mockData: {
    meta: {
      campaigns: [
        {
          id: 'meta-campaign-1',
          campaign_id: 'meta-123',
          name: 'Meta Test Campaign',
          status: 'ACTIVE',
          objective: 'CONVERSIONS',
          impressions: 15000,
          clicks: 750,
          conversions: 37,
          spend: 125.00,
          reach: 12000,
          frequency: 1.25,
        },
      ],
      connection: {
        accountId: '9876543210',
        accountName: 'Test Meta Account',
        status: 'active',
      },
    },
    google: {
      campaigns: [
        {
          id: 'google-campaign-1',
          campaignId: '12345',
          campaignName: 'Google Test Campaign',
          status: 'ENABLED',
          advertisingChannelType: 'SEARCH',
          impressions: 12000,
          clicks: 600,
          conversions: 30,
          cost: 90.00,
          searchImpressionShare: 85.5,
          qualityScore: 7.2,
        },
      ],
      connection: {
        customerId: '1234567890',
        accountName: 'Test Google Account',
        status: 'active',
      },
    },
  },
};

test.describe('System Compatibility Validation E2E', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await loginAsTestUser(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test.describe('Meta Functionality Preservation', () => {
    test.beforeEach(async () => {
      await setupMetaOnlyConnection(page);
    });

    test('should preserve Meta dashboard functionality', async () => {
      await page.goto('/dashboard/meta');
      
      // Verify Meta dashboard loads correctly
      await expect(page.getByTestId('meta-dashboard')).toBeVisible();
      await expect(page.getByText('Meta Ads')).toBeVisible();
      
      // Verify Meta-specific KPIs are displayed
      await expect(page.getByTestId('meta-kpi-impressions')).toContainText('15,000');
      await expect(page.getByTestId('meta-kpi-clicks')).toContainText('750');
      await expect(page.getByTestId('meta-kpi-conversions')).toContainText('37');
      await expect(page.getByTestId('meta-kpi-spend')).toContainText('$125.00');
      
      // Verify Meta-specific metrics (reach, frequency)
      await expect(page.getByTestId('meta-kpi-reach')).toContainText('12,000');
      await expect(page.getByTestId('meta-kpi-frequency')).toContainText('1.25');
      
      // Verify campaigns table shows Meta data
      await expect(page.getByTestId('meta-campaigns-table')).toBeVisible();
      await expect(page.getByText('Meta Test Campaign')).toBeVisible();
      await expect(page.getByTestId('meta-status-ACTIVE')).toBeVisible();
      await expect(page.getByTestId('meta-objective-CONVERSIONS')).toBeVisible();
    });

    test('should maintain Meta sync functionality', async () => {
      await page.goto('/dashboard/meta');
      
      // Verify Meta sync button is available
      await expect(page.getByTestId('meta-sync-button')).toBeVisible();
      
      // Click Meta sync
      await page.click('[data-testid="meta-sync-button"]');
      
      // Verify sync modal appears
      await expect(page.getByTestId('meta-sync-modal')).toBeVisible();
      await expect(page.getByText('Sincronizar Meta Ads')).toBeVisible();
      
      // Start sync
      await page.click('[data-testid="start-meta-sync"]');
      
      // Verify sync progress
      await expect(page.getByTestId('meta-sync-progress')).toBeVisible();
      await expect(page.getByText('Sincronizando campanhas Meta')).toBeVisible();
      
      // Wait for sync completion
      await page.waitForTimeout(3000);
      
      // Verify sync success
      await expect(page.getByText('Meta Ads sincronizado com sucesso')).toBeVisible();
      await expect(page.getByText('1 campanha sincronizada')).toBeVisible();
    });

    test('should preserve Meta export functionality', async () => {
      await page.goto('/dashboard/meta');
      
      // Click Meta export button
      await page.click('[data-testid="export-meta-data"]');
      
      // Verify Meta export modal
      await expect(page.getByTestId('meta-export-modal')).toBeVisible();
      await expect(page.getByText('Exportar Dados Meta Ads')).toBeVisible();
      
      // Verify Meta-specific export options
      await expect(page.getByTestId('meta-export-reach')).toBeVisible();
      await expect(page.getByTestId('meta-export-frequency')).toBeVisible();
      await expect(page.getByTestId('meta-export-objective')).toBeVisible();
      
      // Configure export
      await page.check('[data-testid="meta-export-reach"]');
      await page.check('[data-testid="meta-export-frequency"]');
      await page.selectOption('[data-testid="meta-export-format"]', 'csv');
      
      // Start export
      const downloadPromise = page.waitForEvent('download');
      await page.click('[data-testid="start-meta-export"]');
      
      // Verify download
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/meta-ads.*\.csv$/);
    });

    test('should handle Meta campaign details correctly', async () => {
      await page.goto('/dashboard/meta');
      
      // Click on Meta campaign
      await page.click('[data-testid="meta-campaign-link-meta-123"]');
      
      // Verify navigation to Meta campaign details
      await expect(page).toHaveURL(/.*meta\/campaigns\/meta-123.*/);
      
      // Verify Meta campaign details page
      await expect(page.getByTestId('meta-campaign-details')).toBeVisible();
      await expect(page.getByText('Meta Test Campaign')).toBeVisible();
      
      // Verify Meta-specific fields
      await expect(page.getByTestId('meta-campaign-objective')).toContainText('CONVERSIONS');
      await expect(page.getByTestId('meta-campaign-reach')).toContainText('12,000');
      await expect(page.getByTestId('meta-campaign-frequency')).toContainText('1.25');
      
      // Verify Meta performance chart
      await expect(page.getByTestId('meta-performance-chart')).toBeVisible();
      
      // Verify no Google data is shown
      await expect(page.getByTestId('google-campaign-details')).not.toBeVisible();
      await expect(page.getByText('Search Impression Share')).not.toBeVisible();
    });

    test('should preserve Meta navigation and breadcrumbs', async () => {
      await page.goto('/dashboard/meta');
      
      // Verify Meta breadcrumbs
      await expect(page.getByTestId('breadcrumb')).toBeVisible();
      await expect(page.getByTestId('breadcrumb-dashboard')).toBeVisible();
      await expect(page.getByTestId('breadcrumb-meta-ads')).toBeVisible();
      
      // Verify Meta sidebar item is active
      await expect(page.getByTestId('sidebar-campanhas')).toHaveClass(/.*active.*/);
      
      // Navigate to Meta insights
      await page.click('[data-testid="sidebar-insights"]');
      
      // Verify navigation to Meta insights
      await expect(page).toHaveURL(/.*dashboard\/analytics.*/);
      await expect(page.getByTestId('meta-analytics-section')).toBeVisible();
      
      // Verify Meta insights sidebar is active
      await expect(page.getByTestId('sidebar-insights')).toHaveClass(/.*active.*/);
    });
  });

  test.describe('System Behavior with Different Connection States', () => {
    test('should handle Meta-only connection appropriately', async () => {
      await setupMetaOnlyConnection(page);
      await page.goto('/dashboard');
      
      // Verify unified dashboard shows Meta data
      await expect(page.getByTestId('unified-dashboard')).toBeVisible();
      
      // Verify Meta platform card shows connected status
      await expect(page.getByTestId('meta-platform-card')).toBeVisible();
      await expect(page.getByTestId('meta-connection-status')).toContainText('Conectado');
      await expect(page.getByTestId('meta-campaigns-count')).toContainText('1 campanha');
      
      // Verify Google platform card shows connection prompt
      await expect(page.getByTestId('google-platform-card')).toBeVisible();
      await expect(page.getByTestId('google-connection-status')).toContainText('Não conectado');
      await expect(page.getByTestId('connect-google-prompt')).toBeVisible();
      
      // Verify unified metrics show Meta data only
      await expect(page.getByTestId('unified-kpi-impressions')).toContainText('15,000');
      await expect(page.getByTestId('unified-kpi-clicks')).toContainText('750');
      
      // Verify partial data warning
      await expect(page.getByTestId('partial-data-warning')).toBeVisible();
      await expect(page.getByText('Dados apenas do Meta Ads')).toBeVisible();
    });

    test('should handle Google-only connection appropriately', async () => {
      await setupGoogleOnlyConnection(page);
      await page.goto('/dashboard');
      
      // Verify unified dashboard shows Google data
      await expect(page.getByTestId('unified-dashboard')).toBeVisible();
      
      // Verify Google platform card shows connected status
      await expect(page.getByTestId('google-platform-card')).toBeVisible();
      await expect(page.getByTestId('google-connection-status')).toContainText('Conectado');
      await expect(page.getByTestId('google-campaigns-count')).toContainText('1 campanha');
      
      // Verify Meta platform card shows connection prompt
      await expect(page.getByTestId('meta-platform-card')).toBeVisible();
      await expect(page.getByTestId('meta-connection-status')).toContainText('Não conectado');
      await expect(page.getByTestId('connect-meta-prompt')).toBeVisible();
      
      // Verify unified metrics show Google data only
      await expect(page.getByTestId('unified-kpi-impressions')).toContainText('12,000');
      await expect(page.getByTestId('unified-kpi-clicks')).toContainText('600');
      
      // Verify partial data warning
      await expect(page.getByTestId('partial-data-warning')).toBeVisible();
      await expect(page.getByText('Dados apenas do Google Ads')).toBeVisible();
    });

    test('should handle both platforms connected correctly', async () => {
      await setupBothPlatformsConnected(page);
      await page.goto('/dashboard');
      
      // Verify unified dashboard shows aggregated data
      await expect(page.getByTestId('unified-dashboard')).toBeVisible();
      
      // Verify both platform cards show connected status
      await expect(page.getByTestId('meta-connection-status')).toContainText('Conectado');
      await expect(page.getByTestId('google-connection-status')).toContainText('Conectado');
      
      // Verify aggregated metrics
      await expect(page.getByTestId('unified-kpi-impressions')).toContainText('27,000'); // 15k + 12k
      await expect(page.getByTestId('unified-kpi-clicks')).toContainText('1,350'); // 750 + 600
      await expect(page.getByTestId('unified-kpi-conversions')).toContainText('67'); // 37 + 30
      
      // Verify platform comparison is available
      await expect(page.getByTestId('platform-comparison-chart')).toBeVisible();
      await expect(page.getByTestId('platform-winner-badge')).toBeVisible();
      
      // Verify no partial data warning
      await expect(page.getByTestId('partial-data-warning')).not.toBeVisible();
      
      // Verify unified export is available
      await expect(page.getByTestId('export-unified-data')).toBeVisible();
    });

    test('should handle no platforms connected with onboarding', async () => {
      await setupNoPlatformsConnected(page);
      await page.goto('/dashboard');
      
      // Verify onboarding dashboard is shown
      await expect(page.getByTestId('onboarding-dashboard')).toBeVisible();
      await expect(page.getByText('Conecte suas plataformas de anúncios')).toBeVisible();
      
      // Verify both connection cards are shown
      await expect(page.getByTestId('connect-meta-card')).toBeVisible();
      await expect(page.getByTestId('connect-google-card')).toBeVisible();
      
      // Verify platform benefits are displayed
      await expect(page.getByTestId('meta-benefits')).toBeVisible();
      await expect(page.getByTestId('google-benefits')).toBeVisible();
      
      // Verify no metrics are shown
      await expect(page.getByTestId('unified-kpi-cards')).not.toBeVisible();
      
      // Verify onboarding steps
      await expect(page.getByTestId('onboarding-steps')).toBeVisible();
      await expect(page.getByText('Passo 1: Escolha sua plataforma')).toBeVisible();
    });
  });

  test.describe('Error Handling and Resilience', () => {
    test('should handle Meta API errors without affecting Google', async () => {
      await setupBothPlatformsConnected(page);
      
      // Mock Meta API error
      await page.route('**/api/meta/**', route => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({
            error: 'Meta API temporarily unavailable',
            code: 'API_ERROR',
          }),
        });
      });
      
      await page.goto('/dashboard');
      
      // Verify Google data is still available
      await expect(page.getByTestId('google-platform-card')).toBeVisible();
      await expect(page.getByTestId('google-connection-status')).toContainText('Conectado');
      
      // Verify Meta shows error state
      await expect(page.getByTestId('meta-platform-error')).toBeVisible();
      await expect(page.getByText('Meta API temporarily unavailable')).toBeVisible();
      
      // Verify unified dashboard shows partial data
      await expect(page.getByTestId('partial-data-warning')).toBeVisible();
      await expect(page.getByText('Meta Ads indisponível')).toBeVisible();
      
      // Verify Google dashboard still works
      await page.goto('/dashboard/google');
      await expect(page.getByText('Google Test Campaign')).toBeVisible();
      await expect(page.getByTestId('google-campaigns-table')).toBeVisible();
    });

    test('should handle Google API errors without affecting Meta', async () => {
      await setupBothPlatformsConnected(page);
      
      // Mock Google API error
      await page.route('**/api/google/**', route => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({
            error: 'Google Ads API temporarily unavailable',
            code: 'API_ERROR',
          }),
        });
      });
      
      await page.goto('/dashboard');
      
      // Verify Meta data is still available
      await expect(page.getByTestId('meta-platform-card')).toBeVisible();
      await expect(page.getByTestId('meta-connection-status')).toContainText('Conectado');
      
      // Verify Google shows error state
      await expect(page.getByTestId('google-platform-error')).toBeVisible();
      await expect(page.getByText('Google Ads API temporarily unavailable')).toBeVisible();
      
      // Verify unified dashboard shows partial data
      await expect(page.getByTestId('partial-data-warning')).toBeVisible();
      await expect(page.getByText('Google Ads indisponível')).toBeVisible();
      
      // Verify Meta dashboard still works
      await page.goto('/dashboard/meta');
      await expect(page.getByText('Meta Test Campaign')).toBeVisible();
      await expect(page.getByTestId('meta-campaigns-table')).toBeVisible();
    });

    test('should recover from temporary connection issues', async () => {
      await setupBothPlatformsConnected(page);
      
      // Mock temporary network failure
      await page.route('**/api/google/**', route => {
        route.abort('failed');
      });
      
      await page.goto('/dashboard/google');
      
      // Verify error state is shown
      await expect(page.getByText('Erro de conexão')).toBeVisible();
      await expect(page.getByTestId('retry-connection')).toBeVisible();
      
      // Restore connection
      await page.unroute('**/api/google/**');
      await setupGoogleApiMocks(page);
      
      // Click retry
      await page.click('[data-testid="retry-connection"]');
      
      // Verify recovery
      await expect(page.getByText('Google Test Campaign')).toBeVisible();
      await expect(page.getByTestId('google-campaigns-table')).toBeVisible();
      
      // Verify connection status is restored
      await page.goto('/dashboard');
      await expect(page.getByTestId('google-connection-status')).toContainText('Conectado');
    });
  });

  test.describe('Data Isolation and Security', () => {
    test('should maintain data isolation between platforms', async () => {
      await setupBothPlatformsConnected(page);
      
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
      
      // Visit Meta dashboard
      await page.goto('/dashboard/meta');
      await page.waitForTimeout(1000);
      
      // Reset flags
      metaApiCalled = false;
      googleApiCalled = false;
      
      // Trigger Meta sync
      await page.click('[data-testid="meta-sync-button"]');
      await page.click('[data-testid="start-meta-sync"]');
      await page.waitForTimeout(1000);
      
      // Verify only Meta APIs were called
      expect(metaApiCalled).toBe(true);
      expect(googleApiCalled).toBe(false);
      
      // Reset flags and test Google
      metaApiCalled = false;
      googleApiCalled = false;
      
      await page.goto('/dashboard/google');
      await page.waitForTimeout(1000);
      
      // Trigger Google sync
      await page.click('[data-testid="google-sync-button"]');
      await page.click('[data-testid="start-google-sync"]');
      await page.waitForTimeout(1000);
      
      // Verify only Google APIs were called
      expect(googleApiCalled).toBe(true);
      expect(metaApiCalled).toBe(false);
    });

    test('should prevent cross-platform data contamination', async () => {
      await setupBothPlatformsConnected(page);
      
      // Visit Meta dashboard
      await page.goto('/dashboard/meta');
      
      // Verify only Meta data is shown
      const campaignNames = await page.getByTestId('campaign-name').allTextContents();
      campaignNames.forEach(name => {
        expect(name).toContain('Meta');
        expect(name).not.toContain('Google');
      });
      
      // Verify Meta-specific metrics are shown
      await expect(page.getByTestId('meta-kpi-reach')).toBeVisible();
      await expect(page.getByTestId('meta-kpi-frequency')).toBeVisible();
      
      // Verify Google-specific metrics are not shown
      await expect(page.getByTestId('google-kpi-search-impression-share')).not.toBeVisible();
      await expect(page.getByTestId('google-kpi-quality-score')).not.toBeVisible();
      
      // Visit Google dashboard
      await page.goto('/dashboard/google');
      
      // Verify only Google data is shown
      const googleCampaignNames = await page.getByTestId('campaign-name').allTextContents();
      googleCampaignNames.forEach(name => {
        expect(name).toContain('Google');
        expect(name).not.toContain('Meta');
      });
      
      // Verify Google-specific metrics are shown
      await expect(page.getByTestId('google-kpi-search-impression-share')).toBeVisible();
      await expect(page.getByTestId('google-kpi-quality-score')).toBeVisible();
      
      // Verify Meta-specific metrics are not shown
      await expect(page.getByTestId('meta-kpi-reach')).not.toBeVisible();
      await expect(page.getByTestId('meta-kpi-frequency')).not.toBeVisible();
    });
  });

  test.describe('Performance and User Experience', () => {
    test('should maintain acceptable performance with both platforms', async () => {
      await setupBothPlatformsConnected(page);
      
      const startTime = Date.now();
      
      // Load unified dashboard
      await page.goto('/dashboard');
      
      // Wait for all content to load
      await expect(page.getByTestId('unified-dashboard')).toBeVisible();
      await expect(page.getByTestId('meta-platform-card')).toBeVisible();
      await expect(page.getByTestId('google-platform-card')).toBeVisible();
      await expect(page.getByTestId('platform-comparison-chart')).toBeVisible();
      
      const loadTime = Date.now() - startTime;
      
      // Should load within reasonable time (10 seconds for unified dashboard)
      expect(loadTime).toBeLessThan(10000);
    });

    test('should provide smooth navigation between platforms', async () => {
      await setupBothPlatformsConnected(page);
      
      // Start on unified dashboard
      await page.goto('/dashboard');
      await expect(page.getByTestId('unified-dashboard')).toBeVisible();
      
      // Navigate to Meta dashboard
      const metaNavStart = Date.now();
      await page.click('[data-testid="sidebar-campanhas"]');
      await expect(page.getByTestId('meta-dashboard')).toBeVisible();
      const metaNavTime = Date.now() - metaNavStart;
      
      // Navigate to Google dashboard
      const googleNavStart = Date.now();
      await page.click('[data-testid="sidebar-google-ads"]');
      await expect(page.getByTestId('google-dashboard')).toBeVisible();
      const googleNavTime = Date.now() - googleNavStart;
      
      // Navigate back to unified dashboard
      const unifiedNavStart = Date.now();
      await page.click('[data-testid="sidebar-dashboard"]');
      await expect(page.getByTestId('unified-dashboard')).toBeVisible();
      const unifiedNavTime = Date.now() - unifiedNavStart;
      
      // All navigations should be fast (under 3 seconds)
      expect(metaNavTime).toBeLessThan(3000);
      expect(googleNavTime).toBeLessThan(3000);
      expect(unifiedNavTime).toBeLessThan(3000);
    });

    test('should handle large datasets efficiently', async () => {
      // Mock large dataset
      await setupLargeDatasetMocks(page);
      await setupBothPlatformsConnected(page);
      
      const startTime = Date.now();
      
      // Load dashboard with large dataset
      await page.goto('/dashboard');
      
      // Wait for content to load
      await expect(page.getByTestId('unified-dashboard')).toBeVisible();
      await expect(page.getByTestId('unified-kpi-impressions')).toBeVisible();
      
      const loadTime = Date.now() - startTime;
      
      // Should handle large datasets within reasonable time
      expect(loadTime).toBeLessThan(15000);
      
      // Verify pagination works
      await page.goto('/dashboard/meta');
      await expect(page.getByTestId('campaigns-pagination')).toBeVisible();
      await expect(page.getByText('Mostrando 1-20 de 100')).toBeVisible();
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

async function setupMetaOnlyConnection(page: Page) {
  await page.evaluate(() => {
    localStorage.setItem('meta-ads-connected', 'true');
    localStorage.removeItem('google-ads-connected');
  });
  
  await setupMetaApiMocks(page);
  
  await page.route('**/api/google/connections**', route => {
    route.fulfill({
      status: 200,
      body: JSON.stringify({ connections: [] }),
    });
  });
}

async function setupGoogleOnlyConnection(page: Page) {
  await page.evaluate(() => {
    localStorage.setItem('google-ads-connected', 'true');
    localStorage.removeItem('meta-ads-connected');
  });
  
  await setupGoogleApiMocks(page);
  
  await page.route('**/api/meta/connections**', route => {
    route.fulfill({
      status: 200,
      body: JSON.stringify({ connections: [] }),
    });
  });
}

async function setupBothPlatformsConnected(page: Page) {
  await page.evaluate(() => {
    localStorage.setItem('meta-ads-connected', 'true');
    localStorage.setItem('google-ads-connected', 'true');
  });
  
  await setupMetaApiMocks(page);
  await setupGoogleApiMocks(page);
  
  // Mock unified API
  await page.route('**/api/unified/metrics**', route => {
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        aggregated: {
          total: {
            impressions: 27000,
            clicks: 1350,
            conversions: 67,
            spend: 215.00,
          },
        },
        byPlatform: [
          {
            platform: 'meta',
            impressions: 15000,
            clicks: 750,
            conversions: 37,
            spend: 125.00,
          },
          {
            platform: 'google',
            impressions: 12000,
            clicks: 600,
            conversions: 30,
            spend: 90.00,
          },
        ],
      }),
    });
  });
}

async function setupNoPlatformsConnected(page: Page) {
  await page.evaluate(() => {
    localStorage.removeItem('meta-ads-connected');
    localStorage.removeItem('google-ads-connected');
  });
  
  await page.route('**/api/meta/connections**', route => {
    route.fulfill({
      status: 200,
      body: JSON.stringify({ connections: [] }),
    });
  });
  
  await page.route('**/api/google/connections**', route => {
    route.fulfill({
      status: 200,
      body: JSON.stringify({ connections: [] }),
    });
  });
}

async function setupMetaApiMocks(page: Page) {
  await page.route('**/api/meta/campaigns**', route => {
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        campaigns: TEST_CONFIG.mockData.meta.campaigns,
        pagination: { total: 1, page: 1, limit: 20 },
        lastSync: new Date().toISOString(),
      }),
    });
  });
  
  await page.route('**/api/meta/connections**', route => {
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        connections: [TEST_CONFIG.mockData.meta.connection],
      }),
    });
  });
  
  await page.route('**/api/meta/sync**', route => {
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        success: true,
        campaignsSynced: 1,
        metricsUpdated: 7,
      }),
    });
  });
}

async function setupGoogleApiMocks(page: Page) {
  await page.route('**/api/google/campaigns**', route => {
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        campaigns: TEST_CONFIG.mockData.google.campaigns,
        pagination: { total: 1, page: 1, limit: 20 },
        lastSync: new Date().toISOString(),
      }),
    });
  });
  
  await page.route('**/api/google/connections**', route => {
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        connections: [TEST_CONFIG.mockData.google.connection],
      }),
    });
  });
  
  await page.route('**/api/google/sync**', route => {
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        success: true,
        campaignsSynced: 1,
        metricsUpdated: 7,
      }),
    });
  });
}

async function setupLargeDatasetMocks(page: Page) {
  // Mock large Meta dataset
  const largeMeta = Array.from({ length: 100 }, (_, i) => ({
    id: `meta-campaign-${i + 1}`,
    campaign_id: `meta-${i + 1}`,
    name: `Meta Campaign ${i + 1}`,
    status: i % 3 === 0 ? 'ACTIVE' : i % 3 === 1 ? 'PAUSED' : 'DELETED',
    impressions: Math.floor(Math.random() * 50000) + 1000,
    clicks: Math.floor(Math.random() * 2000) + 50,
    conversions: Math.floor(Math.random() * 100) + 1,
    spend: Math.floor(Math.random() * 500) + 10,
  }));
  
  // Mock large Google dataset
  const largeGoogle = Array.from({ length: 75 }, (_, i) => ({
    id: `google-campaign-${i + 1}`,
    campaignId: `${i + 1}`,
    campaignName: `Google Campaign ${i + 1}`,
    status: i % 3 === 0 ? 'ENABLED' : i % 3 === 1 ? 'PAUSED' : 'REMOVED',
    impressions: Math.floor(Math.random() * 40000) + 800,
    clicks: Math.floor(Math.random() * 1500) + 40,
    conversions: Math.floor(Math.random() * 80) + 1,
    cost: Math.floor(Math.random() * 400) + 8,
  }));
  
  await page.route('**/api/meta/campaigns**', route => {
    const url = new URL(route.request().url());
    const page_num = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const start = (page_num - 1) * limit;
    const end = start + limit;
    
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        campaigns: largeMeta.slice(start, end),
        pagination: {
          total: largeMeta.length,
          page: page_num,
          limit: limit,
          totalPages: Math.ceil(largeMeta.length / limit),
        },
      }),
    });
  });
  
  await page.route('**/api/google/campaigns**', route => {
    const url = new URL(route.request().url());
    const page_num = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const start = (page_num - 1) * limit;
    const end = start + limit;
    
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        campaigns: largeGoogle.slice(start, end),
        pagination: {
          total: largeGoogle.length,
          page: page_num,
          limit: limit,
          totalPages: Math.ceil(largeGoogle.length / limit),
        },
      }),
    });
  });
}