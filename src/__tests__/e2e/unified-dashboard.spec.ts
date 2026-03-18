/**
 * Unified Dashboard E2E Tests
 * 
 * Tests unified dashboard showing aggregated data from both platforms
 * Requirements: 5.1, 5.2, 5.3, 5.4
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
    google: {
      impressions: 25000,
      clicks: 1250,
      conversions: 62,
      cost: 312.50,
      campaigns: 5,
    },
    meta: {
      impressions: 35000,
      clicks: 1750,
      conversions: 87,
      spend: 437.50,
      campaigns: 7,
    },
  },
};

test.describe('Unified Dashboard E2E', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    
    // Mock unified metrics API
    await page.route('**/api/unified/metrics**', route => {
      const googleData = TEST_CONFIG.mockData.google;
      const metaData = TEST_CONFIG.mockData.meta;
      
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          aggregated: {
            total: {
              impressions: googleData.impressions + metaData.impressions,
              clicks: googleData.clicks + metaData.clicks,
              conversions: googleData.conversions + metaData.conversions,
              spend: googleData.cost + metaData.spend,
              ctr: ((googleData.clicks + metaData.clicks) / (googleData.impressions + metaData.impressions) * 100).toFixed(2),
              conversionRate: ((googleData.conversions + metaData.conversions) / (googleData.clicks + metaData.clicks) * 100).toFixed(2),
              cpc: ((googleData.cost + metaData.spend) / (googleData.clicks + metaData.clicks)).toFixed(2),
              cpa: ((googleData.cost + metaData.spend) / (googleData.conversions + metaData.conversions)).toFixed(2),
            },
            dateRange: {
              from: '2024-01-01',
              to: '2024-01-31',
            },
          },
          byPlatform: [
            {
              platform: 'google',
              impressions: googleData.impressions,
              clicks: googleData.clicks,
              conversions: googleData.conversions,
              spend: googleData.cost,
              campaigns: googleData.campaigns,
              ctr: (googleData.clicks / googleData.impressions * 100).toFixed(2),
              conversionRate: (googleData.conversions / googleData.clicks * 100).toFixed(2),
              cpc: (googleData.cost / googleData.clicks).toFixed(2),
              cpa: (googleData.cost / googleData.conversions).toFixed(2),
            },
            {
              platform: 'meta',
              impressions: metaData.impressions,
              clicks: metaData.clicks,
              conversions: metaData.conversions,
              spend: metaData.spend,
              campaigns: metaData.campaigns,
              ctr: (metaData.clicks / metaData.impressions * 100).toFixed(2),
              conversionRate: (metaData.conversions / metaData.clicks * 100).toFixed(2),
              cpc: (metaData.spend / metaData.clicks).toFixed(2),
              cpa: (metaData.spend / metaData.conversions).toFixed(2),
            },
          ],
        }),
      });
    });

    // Mock platform comparison API
    await page.route('**/api/unified/comparison**', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          comparison: {
            impressions: {
              google: TEST_CONFIG.mockData.google.impressions,
              meta: TEST_CONFIG.mockData.meta.impressions,
              winner: 'meta',
              difference: 10000,
              percentageDifference: 40,
            },
            clicks: {
              google: TEST_CONFIG.mockData.google.clicks,
              meta: TEST_CONFIG.mockData.meta.clicks,
              winner: 'meta',
              difference: 500,
              percentageDifference: 40,
            },
            conversions: {
              google: TEST_CONFIG.mockData.google.conversions,
              meta: TEST_CONFIG.mockData.meta.conversions,
              winner: 'meta',
              difference: 25,
              percentageDifference: 40.3,
            },
            ctr: {
              google: 5.0,
              meta: 5.0,
              winner: 'tie',
              difference: 0,
              percentageDifference: 0,
            },
          },
          winner: {
            platform: 'meta',
            score: 75,
            reasons: ['Maior volume de impressões', 'Mais conversões', 'Melhor alcance'],
          },
        }),
      });
    });

    // Mock time series API
    await page.route('**/api/unified/time-series**', route => {
      const timeSeries = [];
      const baseDate = new Date('2024-01-01');
      
      for (let i = 0; i < 30; i++) {
        const date = new Date(baseDate);
        date.setDate(date.getDate() + i);
        
        timeSeries.push({
          date: date.toISOString().split('T')[0],
          platforms: {
            google: {
              impressions: Math.floor(TEST_CONFIG.mockData.google.impressions / 30 * (0.8 + Math.random() * 0.4)),
              clicks: Math.floor(TEST_CONFIG.mockData.google.clicks / 30 * (0.8 + Math.random() * 0.4)),
              conversions: Math.floor(TEST_CONFIG.mockData.google.conversions / 30 * (0.8 + Math.random() * 0.4)),
              spend: parseFloat((TEST_CONFIG.mockData.google.cost / 30 * (0.8 + Math.random() * 0.4)).toFixed(2)),
            },
            meta: {
              impressions: Math.floor(TEST_CONFIG.mockData.meta.impressions / 30 * (0.8 + Math.random() * 0.4)),
              clicks: Math.floor(TEST_CONFIG.mockData.meta.clicks / 30 * (0.8 + Math.random() * 0.4)),
              conversions: Math.floor(TEST_CONFIG.mockData.meta.conversions / 30 * (0.8 + Math.random() * 0.4)),
              spend: parseFloat((TEST_CONFIG.mockData.meta.spend / 30 * (0.8 + Math.random() * 0.4)).toFixed(2)),
            },
          },
          total: {
            impressions: 0, // Will be calculated
            clicks: 0,
            conversions: 0,
            spend: 0,
          },
        });
        
        // Calculate totals
        const day = timeSeries[i];
        day.total.impressions = day.platforms.google.impressions + day.platforms.meta.impressions;
        day.total.clicks = day.platforms.google.clicks + day.platforms.meta.clicks;
        day.total.conversions = day.platforms.google.conversions + day.platforms.meta.conversions;
        day.total.spend = day.platforms.google.spend + day.platforms.meta.spend;
      }
      
      route.fulfill({
        status: 200,
        body: JSON.stringify({ timeSeries }),
      });
    });

    // Login and setup connected accounts
    await loginAsTestUser(page);
    await setupConnectedPlatforms(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test.describe('Unified Overview', () => {
    test('should display unified dashboard with aggregated KPIs', async () => {
      await page.goto('/dashboard');
      
      // Should show unified dashboard title
      await expect(page.getByText('Dashboard Geral')).toBeVisible();
      
      // Should show aggregated KPI cards
      await expect(page.getByTestId('unified-kpi-impressions')).toBeVisible();
      await expect(page.getByTestId('unified-kpi-clicks')).toBeVisible();
      await expect(page.getByTestId('unified-kpi-conversions')).toBeVisible();
      await expect(page.getByTestId('unified-kpi-spend')).toBeVisible();
      
      // Verify aggregated values
      await expect(page.getByTestId('unified-kpi-impressions')).toContainText('60,000');
      await expect(page.getByTestId('unified-kpi-clicks')).toContainText('3,000');
      await expect(page.getByTestId('unified-kpi-conversions')).toContainText('149');
      await expect(page.getByTestId('unified-kpi-spend')).toContainText('$750.00');
      
      // Should show derived metrics
      await expect(page.getByTestId('unified-ctr')).toContainText('5.00%');
      await expect(page.getByTestId('unified-conversion-rate')).toContainText('4.97%');
      await expect(page.getByTestId('unified-cpc')).toContainText('$0.25');
      await expect(page.getByTestId('unified-cpa')).toContainText('$5.03');
    });

    test('should show platform breakdown', async () => {
      await page.goto('/dashboard');
      
      // Should show platform breakdown section
      await expect(page.getByTestId('platform-breakdown')).toBeVisible();
      
      // Should show Google Ads section
      await expect(page.getByTestId('google-platform-card')).toBeVisible();
      await expect(page.getByText('Google Ads')).toBeVisible();
      await expect(page.getByTestId('google-impressions')).toContainText('25,000');
      await expect(page.getByTestId('google-campaigns-count')).toContainText('5 campanhas');
      
      // Should show Meta Ads section
      await expect(page.getByTestId('meta-platform-card')).toBeVisible();
      await expect(page.getByText('Meta Ads')).toBeVisible();
      await expect(page.getByTestId('meta-impressions')).toContainText('35,000');
      await expect(page.getByTestId('meta-campaigns-count')).toContainText('7 campanhas');
      
      // Should show platform performance indicators
      await expect(page.getByTestId('google-performance-indicator')).toBeVisible();
      await expect(page.getByTestId('meta-performance-indicator')).toBeVisible();
    });

    test('should display platform comparison chart', async () => {
      await page.goto('/dashboard');
      
      // Should show comparison chart
      await expect(page.getByTestId('platform-comparison-chart')).toBeVisible();
      
      // Should show chart legend
      await expect(page.getByText('Google Ads')).toBeVisible();
      await expect(page.getByText('Meta Ads')).toBeVisible();
      
      // Should show metric selector
      await expect(page.getByTestId('chart-metric-selector')).toBeVisible();
      
      // Change metric to clicks
      await page.click('[data-testid="chart-metric-selector"]');
      await page.click('[data-testid="metric-clicks"]');
      
      // Chart should update
      await expect(page.getByTestId('chart-title')).toContainText('Cliques por Plataforma');
    });

    test('should show connection status for both platforms', async () => {
      await page.goto('/dashboard');
      
      // Should show connection indicators
      await expect(page.getByTestId('google-connection-status')).toBeVisible();
      await expect(page.getByTestId('meta-connection-status')).toBeVisible();
      
      // Should show connected status
      await expect(page.getByTestId('google-connection-status')).toContainText('Conectado');
      await expect(page.getByTestId('meta-connection-status')).toContainText('Conectado');
      
      // Should show last sync times
      await expect(page.getByTestId('google-last-sync')).toBeVisible();
      await expect(page.getByTestId('meta-last-sync')).toBeVisible();
    });
  });

  test.describe('Platform Navigation', () => {
    test('should navigate to platform-specific dashboards', async () => {
      await page.goto('/dashboard');
      
      // Click on Google Ads platform card
      await page.click('[data-testid="google-platform-card"]');
      
      // Should navigate to Google Ads dashboard
      await expect(page).toHaveURL(/.*dashboard\/google.*/);
      await expect(page.getByText('Google Ads')).toBeVisible();
      
      // Go back to unified dashboard
      await page.goto('/dashboard');
      
      // Click on Meta Ads platform card
      await page.click('[data-testid="meta-platform-card"]');
      
      // Should navigate to Meta Ads dashboard
      await expect(page).toHaveURL(/.*dashboard\/meta.*/);
      await expect(page.getByText('Meta Ads')).toBeVisible();
    });

    test('should show quick action buttons', async () => {
      await page.goto('/dashboard');
      
      // Should show quick action buttons
      await expect(page.getByTestId('quick-actions')).toBeVisible();
      
      // Should show sync all button
      await expect(page.getByTestId('sync-all-platforms')).toBeVisible();
      
      // Should show view analytics button
      await expect(page.getByTestId('view-analytics')).toBeVisible();
      
      // Should show export data button
      await expect(page.getByTestId('export-unified-data')).toBeVisible();
      
      // Click view analytics
      await page.click('[data-testid="view-analytics"]');
      
      // Should navigate to analytics
      await expect(page).toHaveURL(/.*dashboard\/analytics.*/);
    });

    test('should handle platform-specific actions', async () => {
      await page.goto('/dashboard');
      
      // Google Ads specific actions
      await page.hover('[data-testid="google-platform-card"]');
      await expect(page.getByTestId('google-quick-actions')).toBeVisible();
      
      await expect(page.getByTestId('google-sync-now')).toBeVisible();
      await expect(page.getByTestId('google-view-campaigns')).toBeVisible();
      
      // Meta Ads specific actions
      await page.hover('[data-testid="meta-platform-card"]');
      await expect(page.getByTestId('meta-quick-actions')).toBeVisible();
      
      await expect(page.getByTestId('meta-sync-now')).toBeVisible();
      await expect(page.getByTestId('meta-view-campaigns')).toBeVisible();
    });
  });

  test.describe('Performance Comparison', () => {
    test('should display detailed platform comparison', async () => {
      await page.goto('/dashboard');
      
      // Open comparison modal
      await page.click('[data-testid="detailed-comparison"]');
      await expect(page.getByTestId('comparison-modal')).toBeVisible();
      
      // Should show comparison table
      await expect(page.getByTestId('comparison-table')).toBeVisible();
      
      // Should show metrics comparison
      await expect(page.getByTestId('comparison-impressions')).toBeVisible();
      await expect(page.getByTestId('comparison-clicks')).toBeVisible();
      await expect(page.getByTestId('comparison-conversions')).toBeVisible();
      
      // Should show winner indicators
      await expect(page.getByTestId('winner-impressions')).toContainText('Meta Ads');
      await expect(page.getByTestId('winner-clicks')).toContainText('Meta Ads');
      await expect(page.getByTestId('winner-conversions')).toContainText('Meta Ads');
      
      // Should show percentage differences
      await expect(page.getByTestId('diff-impressions')).toContainText('+40%');
      await expect(page.getByTestId('diff-clicks')).toContainText('+40%');
      await expect(page.getByTestId('diff-conversions')).toContainText('+40.3%');
    });

    test('should show overall platform winner', async () => {
      await page.goto('/dashboard');
      
      // Should show winner section
      await expect(page.getByTestId('platform-winner')).toBeVisible();
      await expect(page.getByText('Melhor Performance')).toBeVisible();
      
      // Should show Meta as winner
      await expect(page.getByTestId('winner-platform')).toContainText('Meta Ads');
      await expect(page.getByTestId('winner-score')).toContainText('75%');
      
      // Should show winner reasons
      await expect(page.getByTestId('winner-reasons')).toBeVisible();
      await expect(page.getByText('Maior volume de impressões')).toBeVisible();
      await expect(page.getByText('Mais conversões')).toBeVisible();
      await expect(page.getByText('Melhor alcance')).toBeVisible();
    });

    test('should allow metric-specific comparison', async () => {
      await page.goto('/dashboard');
      
      // Open comparison modal
      await page.click('[data-testid="detailed-comparison"]');
      
      // Select specific metrics to compare
      await page.check('[data-testid="compare-ctr"]');
      await page.check('[data-testid="compare-conversion-rate"]');
      await page.check('[data-testid="compare-cpc"]');
      
      // Should show selected metrics comparison
      await expect(page.getByTestId('comparison-ctr')).toBeVisible();
      await expect(page.getByTestId('comparison-conversion-rate')).toBeVisible();
      await expect(page.getByTestId('comparison-cpc')).toBeVisible();
      
      // Should show efficiency comparison
      await expect(page.getByTestId('efficiency-analysis')).toBeVisible();
    });
  });

  test.describe('Time Series Analysis', () => {
    test('should display unified time series chart', async () => {
      await page.goto('/dashboard');
      
      // Should show time series chart
      await expect(page.getByTestId('unified-time-series')).toBeVisible();
      
      // Should show chart controls
      await expect(page.getByTestId('time-series-controls')).toBeVisible();
      await expect(page.getByTestId('granularity-selector')).toBeVisible();
      
      // Change granularity to weekly
      await page.click('[data-testid="granularity-selector"]');
      await page.click('[data-testid="granularity-weekly"]');
      
      // Chart should update
      await expect(page.getByTestId('chart-granularity-indicator')).toContainText('Semanal');
    });

    test('should show platform trends over time', async () => {
      await page.goto('/dashboard');
      
      // Should show trend indicators
      await expect(page.getByTestId('google-trend')).toBeVisible();
      await expect(page.getByTestId('meta-trend')).toBeVisible();
      
      // Should show trend direction
      await expect(page.getByTestId('google-trend-direction')).toBeVisible();
      await expect(page.getByTestId('meta-trend-direction')).toBeVisible();
      
      // Should show percentage change
      await expect(page.getByTestId('google-trend-change')).toBeVisible();
      await expect(page.getByTestId('meta-trend-change')).toBeVisible();
    });

    test('should allow date range selection for trends', async () => {
      await page.goto('/dashboard');
      
      // Open date range picker
      await page.click('[data-testid="unified-date-range"]');
      await expect(page.getByTestId('date-range-modal')).toBeVisible();
      
      // Select last 7 days
      await page.click('[data-testid="preset-7-days"]');
      
      // Should update all charts and metrics
      await expect(page.getByTestId('date-range-indicator')).toContainText('Últimos 7 dias');
      
      // Custom date range
      await page.click('[data-testid="unified-date-range"]');
      await page.click('[data-testid="custom-range"]');
      
      await page.fill('[data-testid="start-date"]', '2024-01-01');
      await page.fill('[data-testid="end-date"]', '2024-01-15');
      await page.click('[data-testid="apply-range"]');
      
      // Should update with custom range
      await expect(page.getByTestId('date-range-indicator')).toContainText('01/01 - 15/01');
    });
  });

  test.describe('Export and Reporting', () => {
    test('should export unified data', async () => {
      await page.goto('/dashboard');
      
      // Click export button
      await page.click('[data-testid="export-unified-data"]');
      await expect(page.getByTestId('export-modal')).toBeVisible();
      
      // Should show platform selection
      await expect(page.getByTestId('platform-selection')).toBeVisible();
      await page.check('[data-testid="include-google"]');
      await page.check('[data-testid="include-meta"]');
      
      // Select export format
      await page.click('[data-testid="export-format-csv"]');
      
      // Select metrics
      await page.check('[data-testid="export-impressions"]');
      await page.check('[data-testid="export-clicks"]');
      await page.check('[data-testid="export-conversions"]');
      
      // Start export
      const downloadPromise = page.waitForEvent('download');
      await page.click('[data-testid="start-unified-export"]');
      
      // Should trigger download
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/unified-metrics.*\.csv$/);
    });

    test('should generate comparison report', async () => {
      await page.goto('/dashboard');
      
      // Open comparison modal
      await page.click('[data-testid="detailed-comparison"]');
      
      // Generate report
      await page.click('[data-testid="generate-report"]');
      await expect(page.getByTestId('report-modal')).toBeVisible();
      
      // Should show report preview
      await expect(page.getByTestId('report-preview')).toBeVisible();
      await expect(page.getByText('Relatório de Comparação')).toBeVisible();
      
      // Should include executive summary
      await expect(page.getByTestId('executive-summary')).toBeVisible();
      await expect(page.getByText('Meta Ads apresentou melhor performance')).toBeVisible();
      
      // Download report
      const downloadPromise = page.waitForEvent('download');
      await page.click('[data-testid="download-report"]');
      
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/platform-comparison.*\.pdf$/);
    });
  });

  test.describe('Error Handling', () => {
    test('should handle partial platform data', async () => {
      // Mock Google Ads error
      await page.route('**/api/unified/metrics**', route => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            aggregated: {
              total: {
                impressions: TEST_CONFIG.mockData.meta.impressions,
                clicks: TEST_CONFIG.mockData.meta.clicks,
                conversions: TEST_CONFIG.mockData.meta.conversions,
                spend: TEST_CONFIG.mockData.meta.spend,
              },
            },
            byPlatform: [
              {
                platform: 'meta',
                impressions: TEST_CONFIG.mockData.meta.impressions,
                clicks: TEST_CONFIG.mockData.meta.clicks,
                conversions: TEST_CONFIG.mockData.meta.conversions,
                spend: TEST_CONFIG.mockData.meta.spend,
              },
            ],
            warnings: ['Google Ads data unavailable'],
            errors: {
              google: 'API connection failed',
            },
          }),
        });
      });

      await page.goto('/dashboard');
      
      // Should show warning about missing data
      await expect(page.getByTestId('data-warning')).toBeVisible();
      await expect(page.getByText('Google Ads data unavailable')).toBeVisible();
      
      // Should show only Meta data
      await expect(page.getByTestId('meta-platform-card')).toBeVisible();
      await expect(page.getByTestId('google-platform-card')).toHaveClass(/.*error.*/);
      
      // Should show retry option
      await expect(page.getByTestId('retry-google-data')).toBeVisible();
    });

    test('should handle complete data failure', async () => {
      // Mock complete API failure
      await page.route('**/api/unified/metrics**', route => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({
            error: 'Service unavailable',
          }),
        });
      });

      await page.goto('/dashboard');
      
      // Should show error state
      await expect(page.getByTestId('dashboard-error')).toBeVisible();
      await expect(page.getByText('Erro ao carregar dados')).toBeVisible();
      
      // Should show retry button
      await expect(page.getByTestId('retry-dashboard')).toBeVisible();
      
      // Should show offline message
      await expect(page.getByText('Verifique sua conexão')).toBeVisible();
    });
  });

  test.describe('Real-time Updates', () => {
    test('should update data automatically', async () => {
      await page.goto('/dashboard');
      
      // Should show auto-refresh indicator
      await expect(page.getByTestId('auto-refresh-indicator')).toBeVisible();
      
      // Should show last updated time
      await expect(page.getByTestId('last-updated')).toBeVisible();
      
      // Mock data update
      await page.route('**/api/unified/metrics**', route => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            aggregated: {
              total: {
                impressions: 65000, // Updated value
                clicks: 3250,
                conversions: 162,
                spend: 812.50,
              },
            },
            byPlatform: [
              {
                platform: 'google',
                impressions: 27000, // Updated
                clicks: 1350,
                conversions: 67,
                spend: 337.50,
              },
              {
                platform: 'meta',
                impressions: 38000, // Updated
                clicks: 1900,
                conversions: 95,
                spend: 475.00,
              },
            ],
          }),
        });
      });
      
      // Wait for auto-refresh
      await page.waitForTimeout(5000);
      
      // Should show updated values
      await expect(page.getByTestId('unified-kpi-impressions')).toContainText('65,000');
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

async function setupConnectedPlatforms(page: Page) {
  // Mock both platforms as connected
  await page.evaluate(() => {
    localStorage.setItem('google-ads-connected', 'true');
    localStorage.setItem('meta-ads-connected', 'true');
  });
  
  // Mock platform status APIs
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
}