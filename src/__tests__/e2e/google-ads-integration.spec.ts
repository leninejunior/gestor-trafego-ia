/**
 * Google Ads Integration End-to-End Tests
 * 
 * Tests complete user workflows for Google Ads integration
 * including OAuth flow, campaign management, and analytics
 * Requirements: 1.1, 4.1, 5.1, 12.1
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
  mockGoogleAuth: {
    code: 'mock-auth-code-123',
    state: 'mock-state-parameter',
  },
};

test.describe('Google Ads Integration E2E', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    
    // Mock external API calls
    await page.route('**/accounts.google.com/**', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true }),
      });
    });

    await page.route('**/googleads.googleapis.com/**', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          results: [
            {
              campaign: {
                id: '12345',
                name: 'Test Campaign',
                status: 'ENABLED',
              },
              metrics: {
                impressions: '1000',
                clicks: '50',
                conversions: '5',
                costMicros: '25000000',
              },
            },
          ],
        }),
      });
    });

    // Login as test user
    await loginAsTestUser(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test.describe('Google Ads Connection Flow', () => {
    test('should complete OAuth connection flow', async () => {
      // Navigate to dashboard
      await page.goto('/dashboard');
      await expect(page).toHaveTitle(/Dashboard/);

      // Navigate to Google Ads section
      await page.click('[data-testid="google-ads-menu"]');
      await expect(page.getByText('Google Ads')).toBeVisible();

      // Click connect Google Ads button
      await page.click('[data-testid="connect-google-ads"]');
      
      // Should redirect to OAuth flow
      await expect(page).toHaveURL(/.*google.*auth.*/);
      
      // Mock successful OAuth callback
      await page.goto(`/api/google/callback?code=${TEST_CONFIG.mockGoogleAuth.code}&state=${TEST_CONFIG.mockGoogleAuth.state}`);
      
      // Should redirect to account selection
      await expect(page).toHaveURL(/.*select-accounts.*/);
      
      // Select Google Ads account
      await page.check('[data-testid="account-checkbox-1234567890"]');
      await page.click('[data-testid="connect-accounts-button"]');
      
      // Should redirect back to dashboard with success message
      await expect(page).toHaveURL(/.*dashboard.*google.*success=connected.*/);
      await expect(page.getByText('Conta conectada com sucesso')).toBeVisible();
    });

    test('should handle OAuth errors gracefully', async () => {
      // Navigate to dashboard
      await page.goto('/dashboard');
      
      // Navigate to Google Ads section
      await page.click('[data-testid="google-ads-menu"]');
      
      // Click connect Google Ads button
      await page.click('[data-testid="connect-google-ads"]');
      
      // Mock OAuth error
      await page.goto('/api/google/callback?error=access_denied&error_description=User%20denied%20access');
      
      // Should redirect back with error message
      await expect(page).toHaveURL(/.*dashboard.*error=oauth_error.*/);
      await expect(page.getByText('Acesso negado')).toBeVisible();
    });

    test('should allow disconnecting Google Ads account', async () => {
      // Setup: Connect account first
      await connectGoogleAdsAccount(page);
      
      // Navigate to Google Ads dashboard
      await page.goto('/dashboard/google');
      
      // Open connection settings
      await page.click('[data-testid="connection-settings"]');
      
      // Click disconnect button
      await page.click('[data-testid="disconnect-google-ads"]');
      
      // Confirm disconnection in modal
      await page.click('[data-testid="confirm-disconnect"]');
      
      // Should show success message
      await expect(page.getByText('Conta desconectada com sucesso')).toBeVisible();
      
      // Should show connect button again
      await expect(page.getByTestId('connect-google-ads')).toBeVisible();
    });
  });

  test.describe('Google Ads Dashboard', () => {
    test.beforeEach(async () => {
      // Setup connected Google Ads account
      await connectGoogleAdsAccount(page);
    });

    test('should display Google Ads dashboard with campaigns', async () => {
      await page.goto('/dashboard/google');
      
      // Should show dashboard title
      await expect(page.getByText('Google Ads')).toBeVisible();
      
      // Should show KPI cards
      await expect(page.getByTestId('kpi-impressions')).toBeVisible();
      await expect(page.getByTestId('kpi-clicks')).toBeVisible();
      await expect(page.getByTestId('kpi-conversions')).toBeVisible();
      await expect(page.getByTestId('kpi-cost')).toBeVisible();
      
      // Should show campaigns list
      await expect(page.getByTestId('campaigns-list')).toBeVisible();
      await expect(page.getByText('Test Campaign')).toBeVisible();
    });

    test('should filter campaigns by status', async () => {
      await page.goto('/dashboard/google');
      
      // Open status filter
      await page.click('[data-testid="status-filter"]');
      
      // Select "ENABLED" status
      await page.click('[data-testid="status-enabled"]');
      
      // Should update campaigns list
      await expect(page.getByText('Test Campaign')).toBeVisible();
      
      // Select "PAUSED" status
      await page.click('[data-testid="status-paused"]');
      
      // Should show no campaigns message
      await expect(page.getByText('Nenhuma campanha encontrada')).toBeVisible();
    });

    test('should search campaigns by name', async () => {
      await page.goto('/dashboard/google');
      
      // Enter search term
      await page.fill('[data-testid="campaign-search"]', 'Test');
      await page.press('[data-testid="campaign-search"]', 'Enter');
      
      // Should show matching campaign
      await expect(page.getByText('Test Campaign')).toBeVisible();
      
      // Enter non-matching search term
      await page.fill('[data-testid="campaign-search"]', 'NonExistent');
      await page.press('[data-testid="campaign-search"]', 'Enter');
      
      // Should show no results
      await expect(page.getByText('Nenhuma campanha encontrada')).toBeVisible();
    });

    test('should trigger manual sync', async () => {
      await page.goto('/dashboard/google');
      
      // Click sync button
      await page.click('[data-testid="manual-sync"]');
      
      // Should show sync in progress
      await expect(page.getByText('Sincronização iniciada')).toBeVisible();
      await expect(page.getByTestId('sync-progress')).toBeVisible();
      
      // Wait for sync to complete (mocked)
      await page.waitForTimeout(2000);
      
      // Should show sync completed
      await expect(page.getByText('Sincronização concluída')).toBeVisible();
    });
  });

  test.describe('Campaign Details', () => {
    test.beforeEach(async () => {
      await connectGoogleAdsAccount(page);
    });

    test('should display campaign details with metrics', async () => {
      await page.goto('/dashboard/google');
      
      // Click on campaign to view details
      await page.click('[data-testid="campaign-test-campaign"]');
      
      // Should navigate to campaign details
      await expect(page).toHaveURL(/.*campaigns.*12345.*/);
      
      // Should show campaign information
      await expect(page.getByText('Test Campaign')).toBeVisible();
      await expect(page.getByText('ENABLED')).toBeVisible();
      
      // Should show metrics chart
      await expect(page.getByTestId('performance-chart')).toBeVisible();
      
      // Should show metrics summary
      await expect(page.getByTestId('metrics-summary')).toBeVisible();
      
      // Should show historical data
      await expect(page.getByTestId('historical-trends')).toBeVisible();
    });

    test('should change date range for metrics', async () => {
      await page.goto('/dashboard/google/campaigns/12345');
      
      // Open date range picker
      await page.click('[data-testid="date-range-picker"]');
      
      // Select last 7 days
      await page.click('[data-testid="date-range-7-days"]');
      
      // Should update metrics
      await expect(page.getByTestId('metrics-loading')).toBeVisible();
      await expect(page.getByTestId('metrics-loading')).not.toBeVisible();
      
      // Should show updated date range
      await expect(page.getByText('Últimos 7 dias')).toBeVisible();
    });

    test('should compare with previous period', async () => {
      await page.goto('/dashboard/google/campaigns/12345');
      
      // Enable comparison
      await page.check('[data-testid="compare-previous-period"]');
      
      // Should show comparison data
      await expect(page.getByTestId('comparison-chart')).toBeVisible();
      await expect(page.getByText('vs. período anterior')).toBeVisible();
      
      // Should show percentage changes
      await expect(page.getByTestId('change-impressions')).toBeVisible();
      await expect(page.getByTestId('change-clicks')).toBeVisible();
    });
  });

  test.describe('Unified Dashboard', () => {
    test.beforeEach(async () => {
      await connectGoogleAdsAccount(page);
      // Assume Meta Ads is also connected
      await connectMetaAdsAccount(page);
    });

    test('should display unified metrics from both platforms', async () => {
      await page.goto('/dashboard');
      
      // Should show combined KPIs
      await expect(page.getByTestId('unified-kpi-total-spend')).toBeVisible();
      await expect(page.getByTestId('unified-kpi-total-conversions')).toBeVisible();
      
      // Should show platform breakdown
      await expect(page.getByTestId('platform-breakdown-chart')).toBeVisible();
      await expect(page.getByText('Google Ads')).toBeVisible();
      await expect(page.getByText('Meta Ads')).toBeVisible();
      
      // Should show platform comparison
      await expect(page.getByTestId('platform-comparison')).toBeVisible();
    });

    test('should navigate to platform-specific dashboards', async () => {
      await page.goto('/dashboard');
      
      // Click on Google Ads section
      await page.click('[data-testid="google-ads-section"]');
      
      // Should navigate to Google Ads dashboard
      await expect(page).toHaveURL(/.*dashboard\/google.*/);
      
      // Go back to unified dashboard
      await page.goto('/dashboard');
      
      // Click on Meta Ads section
      await page.click('[data-testid="meta-ads-section"]');
      
      // Should navigate to Meta Ads dashboard
      await expect(page).toHaveURL(/.*dashboard\/meta.*/);
    });
  });

  test.describe('Analytics and Insights', () => {
    test.beforeEach(async () => {
      await connectGoogleAdsAccount(page);
    });

    test('should display Google Ads analytics', async () => {
      await page.goto('/dashboard/analytics/google');
      
      // Should show analytics title
      await expect(page.getByText('Insights Google Ads')).toBeVisible();
      
      // Should show performance trends
      await expect(page.getByTestId('performance-trends-chart')).toBeVisible();
      
      // Should show campaign breakdown
      await expect(page.getByTestId('campaign-breakdown')).toBeVisible();
      
      // Should show conversion analysis
      await expect(page.getByTestId('conversion-analysis')).toBeVisible();
    });

    test('should export analytics data', async () => {
      await page.goto('/dashboard/analytics/google');
      
      // Click export button
      await page.click('[data-testid="export-data"]');
      
      // Select export format
      await page.click('[data-testid="export-csv"]');
      
      // Should trigger download
      const downloadPromise = page.waitForEvent('download');
      await page.click('[data-testid="confirm-export"]');
      const download = await downloadPromise;
      
      // Should download CSV file
      expect(download.suggestedFilename()).toMatch(/.*\.csv$/);
    });
  });

  test.describe('Error Handling', () => {
    test('should handle API errors gracefully', async () => {
      // Mock API error
      await page.route('**/api/google/campaigns**', route => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Internal server error' }),
        });
      });

      await connectGoogleAdsAccount(page);
      await page.goto('/dashboard/google');
      
      // Should show error message
      await expect(page.getByText('Erro ao carregar campanhas')).toBeVisible();
      
      // Should show retry button
      await expect(page.getByTestId('retry-button')).toBeVisible();
      
      // Click retry
      await page.click('[data-testid="retry-button"]');
      
      // Should attempt to reload
      await expect(page.getByTestId('loading-campaigns')).toBeVisible();
    });

    test('should handle network errors', async () => {
      // Simulate network failure
      await page.route('**/api/google/**', route => {
        route.abort('failed');
      });

      await page.goto('/dashboard/google');
      
      // Should show network error message
      await expect(page.getByText('Erro de conexão')).toBeVisible();
      await expect(page.getByText('Verifique sua conexão com a internet')).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('should work on mobile devices', async () => {
      await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
      
      await connectGoogleAdsAccount(page);
      await page.goto('/dashboard/google');
      
      // Should show mobile-optimized layout
      await expect(page.getByTestId('mobile-menu-toggle')).toBeVisible();
      
      // KPI cards should stack vertically
      const kpiCards = page.getByTestId('kpi-card');
      const firstCard = kpiCards.first();
      const secondCard = kpiCards.nth(1);
      
      const firstCardBox = await firstCard.boundingBox();
      const secondCardBox = await secondCard.boundingBox();
      
      // Second card should be below first card (not side by side)
      expect(secondCardBox!.y).toBeGreaterThan(firstCardBox!.y + firstCardBox!.height);
    });

    test('should work on tablet devices', async () => {
      await page.setViewportSize({ width: 768, height: 1024 }); // iPad
      
      await connectGoogleAdsAccount(page);
      await page.goto('/dashboard/google');
      
      // Should show tablet-optimized layout
      await expect(page.getByTestId('sidebar')).toBeVisible();
      
      // Charts should be responsive
      const chart = page.getByTestId('performance-chart');
      const chartBox = await chart.boundingBox();
      
      expect(chartBox!.width).toBeLessThan(768);
      expect(chartBox!.width).toBeGreaterThan(400);
    });
  });
});

// Helper functions
async function loginAsTestUser(page: Page) {
  await page.goto('/auth/login');
  await page.fill('[data-testid="email-input"]', TEST_CONFIG.testUser.email);
  await page.fill('[data-testid="password-input"]', TEST_CONFIG.testUser.password);
  await page.click('[data-testid="login-button"]');
  await expect(page).toHaveURL('/dashboard');
}

async function connectGoogleAdsAccount(page: Page) {
  // Mock the connection process
  await page.evaluate(() => {
    // Set up mock connection in localStorage or session
    localStorage.setItem('google-ads-connected', 'true');
    localStorage.setItem('google-ads-customer-id', '1234567890');
  });
}

async function connectMetaAdsAccount(page: Page) {
  // Mock Meta Ads connection
  await page.evaluate(() => {
    localStorage.setItem('meta-ads-connected', 'true');
    localStorage.setItem('meta-ads-account-id', '9876543210');
  });
}