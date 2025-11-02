/**
 * Platform Isolation E2E Tests
 * 
 * Tests system behavior with different platform connection combinations
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
  mockData: {
    meta: {
      campaigns: [
        {
          id: 'meta-campaign-1',
          name: 'Meta Campaign 1',
          status: 'ACTIVE',
          impressions: 15000,
          clicks: 750,
          conversions: 37,
          spend: 125.00,
        },
      ],
    },
    google: {
      campaigns: [
        {
          id: 'google-campaign-1',
          campaignId: '12345',
          name: 'Google Campaign 1',
          status: 'ENABLED',
          impressions: 12000,
          clicks: 600,
          conversions: 30,
          cost: 90.00,
        },
      ],
    },
  },
};

test.describe('Platform Isolation E2E', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    
    // Login
    await loginAsTestUser(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test.describe('Meta Only Connection', () => {
    test.beforeEach(async () => {
      await setupMetaOnlyConnection(page);
    });

    test('should show Meta dashboard with connection prompt for Google', async () => {
      await page.goto('/dashboard');
      
      // Should show unified dashboard with Meta data only
      await expect(page.getByTestId('unified-dashboard')).toBeVisible();
      
      // Should show Meta platform card with data
      await expect(page.getByTestId('meta-platform-card')).toBeVisible();
      await expect(page.getByTestId('meta-connection-status')).toContainText('Conectado');
      await expect(page.getByTestId('meta-campaigns-count')).toContainText('1 campanha');
      
      // Should show Google platform card with connection prompt
      await expect(page.getByTestId('google-platform-card')).toBeVisible();
      await expect(page.getByTestId('google-connection-status')).toContainText('Não conectado');
      await expect(page.getByTestId('connect-google-prompt')).toBeVisible();
      
      // Unified metrics should show Meta data only
      await expect(page.getByTestId('unified-kpi-impressions')).toContainText('15,000');
      await expect(page.getByTestId('unified-kpi-clicks')).toContainText('750');
    });

    test('should allow Meta operations without Google connection', async () => {
      await page.goto('/dashboard/meta');
      
      // Should show Meta dashboard fully functional
      await expect(page.getByText('Meta Ads')).toBeVisible();
      await expect(page.getByTestId('meta-campaigns-table')).toBeVisible();
      await expect(page.getByText('Meta Campaign 1')).toBeVisible();
      
      // Should allow Meta sync
      await page.click('[data-testid="meta-sync-button"]');
      await expect(page.getByText('Sincronização iniciada')).toBeVisible();
      
      // Should allow Meta export
      await page.click('[data-testid="export-meta-data"]');
      await expect(page.getByTestId('meta-export-modal')).toBeVisible();
    });

    test('should show Google connection prompt in Google dashboard', async () => {
      await page.goto('/dashboard/google');
      
      // Should show Google connection prompt
      await expect(page.getByTestId('google-connection-prompt')).toBeVisible();
      await expect(page.getByText('Conectar Google Ads')).toBeVisible();
      await expect(page.getByTestId('connect-google-ads')).toBeVisible();
      
      // Should not show any Google campaigns or data
      await expect(page.getByTestId('google-campaigns-table')).not.toBeVisible();
      await expect(page.getByTestId('google-kpi-cards')).not.toBeVisible();
      
      // Should show benefits of connecting Google Ads
      await expect(page.getByTestId('google-benefits')).toBeVisible();
    });

    test('should handle analytics with Meta data only', async () => {
      await page.goto('/dashboard/analytics');
      
      // Should show analytics with Meta data
      await expect(page.getByTestId('analytics-dashboard')).toBeVisible();
      await expect(page.getByTestId('meta-analytics-section')).toBeVisible();
      
      // Should show prompt to connect Google for comparison
      await expect(page.getByTestId('google-analytics-prompt')).toBeVisible();
      await expect(page.getByText('Conecte Google Ads para comparação')).toBeVisible();
      
      // Should not show unified comparison charts
      await expect(page.getByTestId('platform-comparison-chart')).not.toBeVisible();
    });
  });

  test.describe('Google Only Connection', () => {
    test.beforeEach(async () => {
      await setupGoogleOnlyConnection(page);
    });

    test('should show Google dashboard with connection prompt for Meta', async () => {
      await page.goto('/dashboard');
      
      // Should show unified dashboard with Google data only
      await expect(page.getByTestId('unified-dashboard')).toBeVisible();
      
      // Should show Google platform card with data
      await expect(page.getByTestId('google-platform-card')).toBeVisible();
      await expect(page.getByTestId('google-connection-status')).toContainText('Conectado');
      await expect(page.getByTestId('google-campaigns-count')).toContainText('1 campanha');
      
      // Should show Meta platform card with connection prompt
      await expect(page.getByTestId('meta-platform-card')).toBeVisible();
      await expect(page.getByTestId('meta-connection-status')).toContainText('Não conectado');
      await expect(page.getByTestId('connect-meta-prompt')).toBeVisible();
      
      // Unified metrics should show Google data only
      await expect(page.getByTestId('unified-kpi-impressions')).toContainText('12,000');
      await expect(page.getByTestId('unified-kpi-clicks')).toContainText('600');
    });

    test('should allow Google operations without Meta connection', async () => {
      await page.goto('/dashboard/google');
      
      // Should show Google dashboard fully functional
      await expect(page.getByText('Google Ads')).toBeVisible();
      await expect(page.getByTestId('google-campaigns-table')).toBeVisible();
      await expect(page.getByText('Google Campaign 1')).toBeVisible();
      
      // Should allow Google sync
      await page.click('[data-testid="google-sync-button"]');
      await expect(page.getByText('Sincronização iniciada')).toBeVisible();
      
      // Should allow Google export
      await page.click('[data-testid="export-google-data"]');
      await expect(page.getByTestId('google-export-modal')).toBeVisible();
    });

    test('should show Meta connection prompt in Meta dashboard', async () => {
      await page.goto('/dashboard/meta');
      
      // Should show Meta connection prompt
      await expect(page.getByTestId('meta-connection-prompt')).toBeVisible();
      await expect(page.getByText('Conectar Meta Ads')).toBeVisible();
      await expect(page.getByTestId('connect-meta-ads')).toBeVisible();
      
      // Should not show any Meta campaigns or data
      await expect(page.getByTestId('meta-campaigns-table')).not.toBeVisible();
      await expect(page.getByTestId('meta-kpi-cards')).not.toBeVisible();
    });

    test('should handle unified export with Google data only', async () => {
      await page.goto('/dashboard');
      
      // Click unified export
      await page.click('[data-testid="export-unified-data"]');
      await expect(page.getByTestId('unified-export-modal')).toBeVisible();
      
      // Should show Google as only available platform
      await expect(page.getByTestId('available-platforms')).toContainText('Google Ads');
      await expect(page.getByTestId('google-platform-option')).toBeEnabled();
      await expect(page.getByTestId('meta-platform-option')).toBeDisabled();
      
      // Should show single platform warning
      await expect(page.getByTestId('single-platform-warning')).toBeVisible();
      await expect(page.getByText('Apenas Google Ads será exportado')).toBeVisible();
    });
  });

  test.describe('Both Platforms Connected', () => {
    test.beforeEach(async () => {
      await setupBothPlatformsConnected(page);
    });

    test('should show unified dashboard with both platforms', async () => {
      await page.goto('/dashboard');
      
      // Should show unified dashboard with aggregated data
      await expect(page.getByTestId('unified-dashboard')).toBeVisible();
      
      // Both platform cards should show connected status
      await expect(page.getByTestId('meta-connection-status')).toContainText('Conectado');
      await expect(page.getByTestId('google-connection-status')).toContainText('Conectado');
      
      // Should show aggregated metrics
      await expect(page.getByTestId('unified-kpi-impressions')).toContainText('27,000'); // 15k + 12k
      await expect(page.getByTestId('unified-kpi-clicks')).toContainText('1,350'); // 750 + 600
      
      // Should show platform comparison
      await expect(page.getByTestId('platform-comparison-chart')).toBeVisible();
      await expect(page.getByTestId('platform-winner')).toBeVisible();
    });

    test('should allow independent platform operations', async () => {
      // Test Meta operations
      await page.goto('/dashboard/meta');
      await expect(page.getByText('Meta Campaign 1')).toBeVisible();
      await expect(page.getByText('Google Campaign 1')).not.toBeVisible();
      
      // Test Google operations
      await page.goto('/dashboard/google');
      await expect(page.getByText('Google Campaign 1')).toBeVisible();
      await expect(page.getByText('Meta Campaign 1')).not.toBeVisible();
    });

    test('should show comprehensive analytics with both platforms', async () => {
      await page.goto('/dashboard/analytics');
      
      // Should show both platform sections
      await expect(page.getByTestId('meta-analytics-section')).toBeVisible();
      await expect(page.getByTestId('google-analytics-section')).toBeVisible();
      
      // Should show platform comparison
      await expect(page.getByTestId('platform-comparison-section')).toBeVisible();
      await expect(page.getByTestId('unified-insights')).toBeVisible();
      
      // Should show cross-platform recommendations
      await expect(page.getByTestId('cross-platform-recommendations')).toBeVisible();
    });

    test('should handle unified export with both platforms', async () => {
      await page.goto('/dashboard');
      
      // Click unified export
      await page.click('[data-testid="export-unified-data"]');
      
      // Should show both platforms available
      await expect(page.getByTestId('google-platform-option')).toBeEnabled();
      await expect(page.getByTestId('meta-platform-option')).toBeEnabled();
      
      // Select both platforms
      await page.check('[data-testid="include-google"]');
      await page.check('[data-testid="include-meta"]');
      
      // Should show unified export preview
      await expect(page.getByTestId('unified-preview')).toContainText('2 plataformas');
      await expect(page.getByTestId('estimated-records')).toContainText('2 campanhas');
      
      // Start export
      await page.click('[data-testid="start-unified-export"]');
      
      // Should process both platforms
      await expect(page.getByText('Processando Google Ads')).toBeVisible();
      await expect(page.getByText('Processando Meta Ads')).toBeVisible();
    });

    test('should sync both platforms independently', async () => {
      await page.goto('/dashboard');
      
      // Should show sync all button
      await expect(page.getByTestId('sync-all-platforms')).toBeVisible();
      
      // Click sync all
      await page.click('[data-testid="sync-all-platforms"]');
      
      // Should show progress for both platforms
      await expect(page.getByTestId('meta-sync-progress')).toBeVisible();
      await expect(page.getByTestId('google-sync-progress')).toBeVisible();
      
      // Wait for completion
      await page.waitForTimeout(3000);
      
      // Should show completion for both
      await expect(page.getByText('Meta Ads sincronizado')).toBeVisible();
      await expect(page.getByText('Google Ads sincronizado')).toBeVisible();
    });
  });

  test.describe('No Platforms Connected', () => {
    test.beforeEach(async () => {
      await setupNoPlatformsConnected(page);
    });

    test('should show onboarding experience', async () => {
      await page.goto('/dashboard');
      
      // Should show onboarding dashboard
      await expect(page.getByTestId('onboarding-dashboard')).toBeVisible();
      await expect(page.getByText('Conecte suas plataformas de anúncios')).toBeVisible();
      
      // Should show both connection options
      await expect(page.getByTestId('connect-meta-card')).toBeVisible();
      await expect(page.getByTestId('connect-google-card')).toBeVisible();
      
      // Should show benefits of each platform
      await expect(page.getByTestId('meta-benefits')).toBeVisible();
      await expect(page.getByTestId('google-benefits')).toBeVisible();
      
      // Should not show any metrics or data
      await expect(page.getByTestId('unified-kpi-cards')).not.toBeVisible();
    });

    test('should guide user through first connection', async () => {
      await page.goto('/dashboard');
      
      // Click connect Meta
      await page.click('[data-testid="connect-meta-card"]');
      
      // Should navigate to Meta connection flow
      await expect(page).toHaveURL(/.*dashboard\/meta.*/);
      await expect(page.getByTestId('meta-connection-guide')).toBeVisible();
      
      // Should show step-by-step instructions
      await expect(page.getByTestId('connection-steps')).toBeVisible();
      await expect(page.getByText('Passo 1: Autorizar aplicativo')).toBeVisible();
    });

    test('should show empty state in platform dashboards', async () => {
      // Test Meta dashboard
      await page.goto('/dashboard/meta');
      await expect(page.getByTestId('meta-empty-state')).toBeVisible();
      await expect(page.getByText('Nenhuma campanha encontrada')).toBeVisible();
      
      // Test Google dashboard
      await page.goto('/dashboard/google');
      await expect(page.getByTestId('google-empty-state')).toBeVisible();
      await expect(page.getByText('Conecte sua conta Google Ads')).toBeVisible();
    });
  });

  test.describe('Platform Switching and Navigation', () => {
    test.beforeEach(async () => {
      await setupBothPlatformsConnected(page);
    });

    test('should maintain context when switching between platforms', async () => {
      // Start on Meta dashboard
      await page.goto('/dashboard/meta');
      await expect(page.getByTestId('sidebar-campanhas')).toHaveClass(/.*active.*/);
      
      // Switch to Google dashboard
      await page.click('[data-testid="sidebar-google-ads"]');
      await expect(page).toHaveURL(/.*dashboard\/google.*/);
      await expect(page.getByTestId('sidebar-google-ads')).toHaveClass(/.*active.*/);
      
      // Switch back to Meta
      await page.click('[data-testid="sidebar-campanhas"]');
      await expect(page).toHaveURL(/.*dashboard\/meta.*/);
      await expect(page.getByTestId('sidebar-campanhas')).toHaveClass(/.*active.*/);
    });

    test('should preserve filters when switching platforms', async () => {
      // Set filter on Meta dashboard
      await page.goto('/dashboard/meta');
      await page.fill('[data-testid="meta-campaign-search"]', 'Campaign 1');
      await page.press('[data-testid="meta-campaign-search"]', 'Enter');
      
      // Switch to Google dashboard
      await page.goto('/dashboard/google');
      await page.fill('[data-testid="google-campaign-search"]', 'Google');
      await page.press('[data-testid="google-campaign-search"]', 'Enter');
      
      // Return to Meta dashboard
      await page.goto('/dashboard/meta');
      
      // Meta filter should be preserved
      await expect(page.getByTestId('meta-campaign-search')).toHaveValue('Campaign 1');
    });

    test('should handle deep links to platform-specific pages', async () => {
      // Direct link to Meta campaign
      await page.goto('/dashboard/meta/campaigns/meta-campaign-1');
      await expect(page.getByText('Meta Campaign 1')).toBeVisible();
      await expect(page.getByTestId('meta-campaign-details')).toBeVisible();
      
      // Direct link to Google campaign
      await page.goto('/dashboard/google/campaigns/google-campaign-1');
      await expect(page.getByText('Google Campaign 1')).toBeVisible();
      await expect(page.getByTestId('google-campaign-details')).toBeVisible();
    });
  });

  test.describe('Error Handling and Resilience', () => {
    test('should handle partial platform failures gracefully', async () => {
      await setupBothPlatformsConnected(page);
      
      // Mock Meta API failure
      await page.route('**/api/meta/**', route => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Meta API unavailable' }),
        });
      });
      
      await page.goto('/dashboard');
      
      // Should show Google data and Meta error
      await expect(page.getByTestId('google-platform-card')).toBeVisible();
      await expect(page.getByTestId('google-connection-status')).toContainText('Conectado');
      
      await expect(page.getByTestId('meta-platform-error')).toBeVisible();
      await expect(page.getByText('Meta API unavailable')).toBeVisible();
      
      // Should show partial unified metrics (Google only)
      await expect(page.getByTestId('unified-kpi-impressions')).toContainText('12,000');
      
      // Should show data availability warning
      await expect(page.getByTestId('partial-data-warning')).toBeVisible();
    });

    test('should recover from temporary connection issues', async () => {
      await setupBothPlatformsConnected(page);
      
      // Mock temporary network failure
      await page.route('**/api/google/**', route => {
        route.abort('failed');
      });
      
      await page.goto('/dashboard/google');
      
      // Should show connection error
      await expect(page.getByText('Erro de conexão')).toBeVisible();
      await expect(page.getByTestId('retry-connection')).toBeVisible();
      
      // Restore connection
      await page.unroute('**/api/google/**');
      await setupGoogleApiMocks(page);
      
      // Click retry
      await page.click('[data-testid="retry-connection"]');
      
      // Should recover and show data
      await expect(page.getByText('Google Campaign 1')).toBeVisible();
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
  
  // Mock Google as not connected
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
  
  // Mock Meta as not connected
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
}

async function setupNoPlatformsConnected(page: Page) {
  await page.evaluate(() => {
    localStorage.removeItem('meta-ads-connected');
    localStorage.removeItem('google-ads-connected');
  });
  
  // Mock both platforms as not connected
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
      }),
    });
  });
  
  await page.route('**/api/meta/connections**', route => {
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        connections: [
          {
            id: 'meta-connection-123',
            accountId: '9876543210',
            status: 'active',
            lastSyncAt: new Date().toISOString(),
          },
        ],
      }),
    });
  });
  
  await page.route('**/api/meta/sync**', route => {
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        success: true,
        campaignsSynced: 1,
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
      }),
    });
  });
  
  await page.route('**/api/google/connections**', route => {
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        connections: [
          {
            id: 'google-connection-123',
            customerId: '1234567890',
            status: 'active',
            lastSyncAt: new Date().toISOString(),
          },
        ],
      }),
    });
  });
  
  await page.route('**/api/google/sync**', route => {
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        success: true,
        campaignsSynced: 1,
      }),
    });
  });
}