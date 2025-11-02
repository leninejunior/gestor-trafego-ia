/**
 * Google Ads Campaigns Dashboard E2E Tests
 * 
 * Tests campaign visualization and management functionality
 * Requirements: 4.1, 7.1, 7.2, 7.3
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
  mockCampaigns: [
    {
      id: 'campaign-123',
      campaignId: '12345',
      name: 'Test Campaign 1',
      status: 'ENABLED',
      budget: 100.00,
      impressions: 10000,
      clicks: 500,
      conversions: 25,
      cost: 75.00,
    },
    {
      id: 'campaign-456',
      campaignId: '67890',
      name: 'Test Campaign 2',
      status: 'PAUSED',
      budget: 200.00,
      impressions: 15000,
      clicks: 600,
      conversions: 30,
      cost: 120.00,
    },
  ],
};

test.describe('Google Ads Campaigns Dashboard E2E', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    
    // Mock Google Ads API responses
    await page.route('**/api/google/campaigns**', route => {
      const url = new URL(route.request().url());
      const status = url.searchParams.get('status');
      
      let filteredCampaigns = TEST_CONFIG.mockCampaigns;
      if (status && status !== 'all') {
        filteredCampaigns = TEST_CONFIG.mockCampaigns.filter(c => c.status === status);
      }
      
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          campaigns: filteredCampaigns,
          pagination: {
            total: filteredCampaigns.length,
            page: 1,
            limit: 20,
            totalPages: 1,
          },
          lastSync: new Date().toISOString(),
        }),
      });
    });

    await page.route('**/api/google/campaigns/*/route', route => {
      const campaignId = route.request().url().split('/').slice(-2, -1)[0];
      const campaign = TEST_CONFIG.mockCampaigns.find(c => c.id === campaignId);
      
      if (campaign) {
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            campaign,
            metrics: {
              impressions: campaign.impressions,
              clicks: campaign.clicks,
              conversions: campaign.conversions,
              cost: campaign.cost,
              ctr: (campaign.clicks / campaign.impressions * 100).toFixed(2),
              conversionRate: (campaign.conversions / campaign.clicks * 100).toFixed(2),
              cpc: (campaign.cost / campaign.clicks).toFixed(2),
              cpa: (campaign.cost / campaign.conversions).toFixed(2),
            },
            historicalData: generateHistoricalData(campaign),
          }),
        });
      } else {
        route.fulfill({ status: 404 });
      }
    });

    await page.route('**/api/google/sync**', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          success: true,
          syncId: 'sync-123',
          status: 'completed',
          campaignsSynced: 2,
          metricsUpdated: 14,
        }),
      });
    });

    // Login and setup connected account
    await loginAsTestUser(page);
    await setupConnectedGoogleAds(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test.describe('Dashboard Overview', () => {
    test('should display Google Ads dashboard with KPIs', async () => {
      await page.goto('/dashboard/google');
      
      // Should show dashboard title
      await expect(page.getByText('Google Ads')).toBeVisible();
      
      // Should show KPI cards
      await expect(page.getByTestId('kpi-impressions')).toBeVisible();
      await expect(page.getByTestId('kpi-clicks')).toBeVisible();
      await expect(page.getByTestId('kpi-conversions')).toBeVisible();
      await expect(page.getByTestId('kpi-cost')).toBeVisible();
      
      // Verify KPI values
      await expect(page.getByTestId('kpi-impressions')).toContainText('25,000');
      await expect(page.getByTestId('kpi-clicks')).toContainText('1,100');
      await expect(page.getByTestId('kpi-conversions')).toContainText('55');
      await expect(page.getByTestId('kpi-cost')).toContainText('$195.00');
      
      // Should show sync status
      await expect(page.getByTestId('sync-status')).toBeVisible();
      await expect(page.getByTestId('last-sync-time')).toBeVisible();
    });

    test('should show campaigns list', async () => {
      await page.goto('/dashboard/google');
      
      // Should show campaigns table
      await expect(page.getByTestId('campaigns-table')).toBeVisible();
      
      // Should show campaign headers
      await expect(page.getByText('Nome da Campanha')).toBeVisible();
      await expect(page.getByText('Status')).toBeVisible();
      await expect(page.getByText('Orçamento')).toBeVisible();
      await expect(page.getByText('Impressões')).toBeVisible();
      await expect(page.getByText('Cliques')).toBeVisible();
      await expect(page.getByText('Conversões')).toBeVisible();
      
      // Should show campaign data
      await expect(page.getByText('Test Campaign 1')).toBeVisible();
      await expect(page.getByText('Test Campaign 2')).toBeVisible();
      
      // Should show status badges
      await expect(page.getByTestId('status-badge-ENABLED')).toBeVisible();
      await expect(page.getByTestId('status-badge-PAUSED')).toBeVisible();
    });

    test('should display performance charts', async () => {
      await page.goto('/dashboard/google');
      
      // Should show performance chart
      await expect(page.getByTestId('performance-chart')).toBeVisible();
      
      // Should show chart legend
      await expect(page.getByText('Impressões')).toBeVisible();
      await expect(page.getByText('Cliques')).toBeVisible();
      await expect(page.getByText('Conversões')).toBeVisible();
      
      // Should show date range selector
      await expect(page.getByTestId('date-range-selector')).toBeVisible();
    });
  });

  test.describe('Campaign Filtering and Search', () => {
    test('should filter campaigns by status', async () => {
      await page.goto('/dashboard/google');
      
      // Open status filter
      await page.click('[data-testid="status-filter"]');
      await expect(page.getByTestId('status-filter-menu')).toBeVisible();
      
      // Select "ENABLED" status
      await page.click('[data-testid="filter-status-ENABLED"]');
      
      // Should show only enabled campaigns
      await expect(page.getByText('Test Campaign 1')).toBeVisible();
      await expect(page.getByText('Test Campaign 2')).not.toBeVisible();
      
      // Should show filter indicator
      await expect(page.getByTestId('active-filters')).toContainText('Status: ENABLED');
      
      // Clear filter
      await page.click('[data-testid="clear-filters"]');
      
      // Should show all campaigns again
      await expect(page.getByText('Test Campaign 1')).toBeVisible();
      await expect(page.getByText('Test Campaign 2')).toBeVisible();
    });

    test('should search campaigns by name', async () => {
      await page.goto('/dashboard/google');
      
      // Enter search term
      await page.fill('[data-testid="campaign-search"]', 'Campaign 1');
      await page.press('[data-testid="campaign-search"]', 'Enter');
      
      // Should show matching campaign
      await expect(page.getByText('Test Campaign 1')).toBeVisible();
      await expect(page.getByText('Test Campaign 2')).not.toBeVisible();
      
      // Should show search indicator
      await expect(page.getByTestId('search-indicator')).toContainText('Busca: Campaign 1');
      
      // Clear search
      await page.fill('[data-testid="campaign-search"]', '');
      await page.press('[data-testid="campaign-search"]', 'Enter');
      
      // Should show all campaigns
      await expect(page.getByText('Test Campaign 1')).toBeVisible();
      await expect(page.getByText('Test Campaign 2')).toBeVisible();
    });

    test('should filter by performance metrics', async () => {
      await page.goto('/dashboard/google');
      
      // Open advanced filters
      await page.click('[data-testid="advanced-filters"]');
      await expect(page.getByTestId('advanced-filters-panel')).toBeVisible();
      
      // Set minimum clicks filter
      await page.fill('[data-testid="filter-min-clicks"]', '550');
      await page.click('[data-testid="apply-filters"]');
      
      // Should show only campaigns with >= 550 clicks
      await expect(page.getByText('Test Campaign 1')).not.toBeVisible(); // 500 clicks
      await expect(page.getByText('Test Campaign 2')).toBeVisible(); // 600 clicks
      
      // Should show filter summary
      await expect(page.getByTestId('filter-summary')).toContainText('Cliques ≥ 550');
    });

    test('should sort campaigns by different metrics', async () => {
      await page.goto('/dashboard/google');
      
      // Sort by clicks (descending)
      await page.click('[data-testid="sort-clicks"]');
      
      // Should show campaigns in order of clicks
      const campaignRows = page.getByTestId('campaign-row');
      await expect(campaignRows.first()).toContainText('Test Campaign 2'); // 600 clicks
      await expect(campaignRows.nth(1)).toContainText('Test Campaign 1'); // 500 clicks
      
      // Sort by clicks (ascending)
      await page.click('[data-testid="sort-clicks"]');
      
      // Should reverse order
      await expect(campaignRows.first()).toContainText('Test Campaign 1');
      await expect(campaignRows.nth(1)).toContainText('Test Campaign 2');
    });
  });

  test.describe('Campaign Details', () => {
    test('should navigate to campaign details', async () => {
      await page.goto('/dashboard/google');
      
      // Click on campaign name
      await page.click('[data-testid="campaign-link-campaign-123"]');
      
      // Should navigate to campaign details
      await expect(page).toHaveURL(/.*campaigns\/campaign-123.*/);
      
      // Should show campaign details
      await expect(page.getByText('Test Campaign 1')).toBeVisible();
      await expect(page.getByTestId('campaign-status')).toContainText('ENABLED');
      
      // Should show detailed metrics
      await expect(page.getByTestId('detailed-metrics')).toBeVisible();
      await expect(page.getByTestId('metric-ctr')).toContainText('5.00%');
      await expect(page.getByTestId('metric-conversion-rate')).toContainText('5.00%');
      await expect(page.getByTestId('metric-cpc')).toContainText('$0.15');
      await expect(page.getByTestId('metric-cpa')).toContainText('$3.00');
    });

    test('should display historical performance chart', async () => {
      await page.goto('/dashboard/google/campaigns/campaign-123');
      
      // Should show performance chart
      await expect(page.getByTestId('historical-chart')).toBeVisible();
      
      // Should show chart controls
      await expect(page.getByTestId('chart-metric-selector')).toBeVisible();
      await expect(page.getByTestId('chart-date-range')).toBeVisible();
      
      // Change chart metric
      await page.click('[data-testid="chart-metric-selector"]');
      await page.click('[data-testid="metric-conversions"]');
      
      // Chart should update
      await expect(page.getByTestId('chart-title')).toContainText('Conversões');
    });

    test('should compare with previous period', async () => {
      await page.goto('/dashboard/google/campaigns/campaign-123');
      
      // Enable comparison
      await page.check('[data-testid="compare-previous-period"]');
      
      // Should show comparison data
      await expect(page.getByTestId('comparison-chart')).toBeVisible();
      await expect(page.getByText('vs. período anterior')).toBeVisible();
      
      // Should show percentage changes
      await expect(page.getByTestId('change-impressions')).toBeVisible();
      await expect(page.getByTestId('change-clicks')).toBeVisible();
      await expect(page.getByTestId('change-conversions')).toBeVisible();
      
      // Should show trend indicators
      await expect(page.getByTestId('trend-indicator')).toBeVisible();
    });

    test('should change date range for analysis', async () => {
      await page.goto('/dashboard/google/campaigns/campaign-123');
      
      // Open date range picker
      await page.click('[data-testid="date-range-picker"]');
      await expect(page.getByTestId('date-picker-modal')).toBeVisible();
      
      // Select last 7 days
      await page.click('[data-testid="preset-7-days"]');
      
      // Should update metrics and chart
      await expect(page.getByTestId('date-range-display')).toContainText('Últimos 7 dias');
      await expect(page.getByTestId('metrics-loading')).toBeVisible();
      await expect(page.getByTestId('metrics-loading')).not.toBeVisible();
      
      // Custom date range
      await page.click('[data-testid="date-range-picker"]');
      await page.click('[data-testid="custom-range"]');
      
      await page.fill('[data-testid="start-date"]', '2024-01-01');
      await page.fill('[data-testid="end-date"]', '2024-01-31');
      await page.click('[data-testid="apply-date-range"]');
      
      // Should update with custom range
      await expect(page.getByTestId('date-range-display')).toContainText('01/01/2024 - 31/01/2024');
    });
  });

  test.describe('Sync Functionality', () => {
    test('should trigger manual sync', async () => {
      await page.goto('/dashboard/google');
      
      // Click sync button
      await page.click('[data-testid="manual-sync"]');
      
      // Should show sync in progress
      await expect(page.getByText('Sincronização iniciada')).toBeVisible();
      await expect(page.getByTestId('sync-progress')).toBeVisible();
      
      // Should show progress indicator
      await expect(page.getByTestId('sync-spinner')).toBeVisible();
      
      // Wait for sync to complete
      await page.waitForTimeout(2000);
      
      // Should show sync completed
      await expect(page.getByText('Sincronização concluída')).toBeVisible();
      await expect(page.getByTestId('sync-success-message')).toContainText('2 campanhas sincronizadas');
      
      // Sync button should be enabled again
      await expect(page.getByTestId('manual-sync')).not.toBeDisabled();
    });

    test('should show sync status and history', async () => {
      await page.goto('/dashboard/google');
      
      // Should show last sync time
      await expect(page.getByTestId('last-sync-time')).toBeVisible();
      
      // Open sync history
      await page.click('[data-testid="sync-history"]');
      await expect(page.getByTestId('sync-history-modal')).toBeVisible();
      
      // Should show sync logs
      await expect(page.getByTestId('sync-log-entry')).toBeVisible();
      await expect(page.getByText('Sincronização completa')).toBeVisible();
      await expect(page.getByText('2 campanhas')).toBeVisible();
      
      // Should show sync details
      await page.click('[data-testid="sync-details-toggle"]');
      await expect(page.getByTestId('sync-details')).toBeVisible();
    });

    test('should handle sync errors', async () => {
      // Mock sync error
      await page.route('**/api/google/sync**', route => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            success: false,
            error: 'API rate limit exceeded',
            retryAfter: 300,
          }),
        });
      });

      await page.goto('/dashboard/google');
      
      // Trigger sync
      await page.click('[data-testid="manual-sync"]');
      
      // Should show error message
      await expect(page.getByText('Erro na sincronização')).toBeVisible();
      await expect(page.getByText('API rate limit exceeded')).toBeVisible();
      
      // Should show retry information
      await expect(page.getByText('Tente novamente em 5 minutos')).toBeVisible();
      
      // Sync button should show retry state
      await expect(page.getByTestId('manual-sync')).toContainText('Tentar novamente');
    });
  });

  test.describe('Export Functionality', () => {
    test('should export campaign data', async () => {
      await page.goto('/dashboard/google');
      
      // Click export button
      await page.click('[data-testid="export-data"]');
      await expect(page.getByTestId('export-modal')).toBeVisible();
      
      // Select export format
      await page.click('[data-testid="export-format-csv"]');
      
      // Select date range
      await page.click('[data-testid="export-date-range"]');
      await page.click('[data-testid="preset-last-30-days"]');
      
      // Select metrics to export
      await page.check('[data-testid="export-metric-impressions"]');
      await page.check('[data-testid="export-metric-clicks"]');
      await page.check('[data-testid="export-metric-conversions"]');
      
      // Start export
      const downloadPromise = page.waitForEvent('download');
      await page.click('[data-testid="start-export"]');
      
      // Should trigger download
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/google-ads-campaigns.*\.csv$/);
      
      // Should show export success
      await expect(page.getByText('Exportação concluída')).toBeVisible();
    });

    test('should handle large export with progress', async () => {
      // Mock large export response
      await page.route('**/api/exports/google**', route => {
        route.fulfill({
          status: 202,
          body: JSON.stringify({
            exportId: 'export-123',
            status: 'processing',
            estimatedTime: 60,
          }),
        });
      });

      await page.goto('/dashboard/google');
      
      // Start large export
      await page.click('[data-testid="export-data"]');
      await page.click('[data-testid="export-format-csv"]');
      await page.click('[data-testid="start-export"]');
      
      // Should show processing state
      await expect(page.getByText('Processando exportação')).toBeVisible();
      await expect(page.getByTestId('export-progress')).toBeVisible();
      
      // Should show estimated time
      await expect(page.getByText('Tempo estimado: 1 minuto')).toBeVisible();
      
      // Should show notification when ready
      await expect(page.getByText('Exportação pronta para download')).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('should work on tablet devices', async () => {
      await page.setViewportSize({ width: 768, height: 1024 }); // iPad
      
      await page.goto('/dashboard/google');
      
      // Should show tablet-optimized layout
      await expect(page.getByTestId('sidebar')).toBeVisible();
      
      // KPI cards should adapt to tablet width
      const kpiCards = page.getByTestId('kpi-card');
      const firstCard = kpiCards.first();
      const secondCard = kpiCards.nth(1);
      
      const firstCardBox = await firstCard.boundingBox();
      const secondCardBox = await secondCard.boundingBox();
      
      // Cards should be in a 2x2 grid on tablet
      expect(firstCardBox!.width).toBeLessThan(400);
      expect(secondCardBox!.y).toBeCloseTo(firstCardBox!.y, 50); // Same row
    });

    test('should work on mobile devices', async () => {
      await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
      
      await page.goto('/dashboard/google');
      
      // Should show mobile menu
      await expect(page.getByTestId('mobile-menu-toggle')).toBeVisible();
      
      // KPI cards should stack vertically
      const kpiCards = page.getByTestId('kpi-card');
      const firstCard = kpiCards.first();
      const secondCard = kpiCards.nth(1);
      
      const firstCardBox = await firstCard.boundingBox();
      const secondCardBox = await secondCard.boundingBox();
      
      // Second card should be below first card
      expect(secondCardBox!.y).toBeGreaterThan(firstCardBox!.y + firstCardBox!.height);
      
      // Campaigns table should be horizontally scrollable
      await expect(page.getByTestId('campaigns-table-container')).toHaveCSS('overflow-x', 'auto');
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

async function setupConnectedGoogleAds(page: Page) {
  // Mock connected state
  await page.evaluate(() => {
    localStorage.setItem('google-ads-connected', 'true');
    localStorage.setItem('google-ads-customer-id', '1234567890');
  });
  
  // Mock connection status API
  await page.route('**/api/google/connections**', route => {
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        connections: [
          {
            id: 'connection-123',
            customerId: '1234567890',
            descriptiveName: 'Test Account',
            status: 'active',
            lastSyncAt: new Date().toISOString(),
          },
        ],
      }),
    });
  });
}

function generateHistoricalData(campaign: any) {
  const data = [];
  const baseDate = new Date();
  
  for (let i = 29; i >= 0; i--) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() - i);
    
    data.push({
      date: date.toISOString().split('T')[0],
      impressions: Math.floor(campaign.impressions / 30 * (0.8 + Math.random() * 0.4)),
      clicks: Math.floor(campaign.clicks / 30 * (0.8 + Math.random() * 0.4)),
      conversions: Math.floor(campaign.conversions / 30 * (0.8 + Math.random() * 0.4)),
      cost: parseFloat((campaign.cost / 30 * (0.8 + Math.random() * 0.4)).toFixed(2)),
    });
  }
  
  return data;
}