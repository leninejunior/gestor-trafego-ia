/**
 * Google Ads Data Export E2E Tests
 * 
 * Tests data export functionality for Google Ads
 * Requirements: 12.1, 12.2, 12.3
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
  mockExportData: {
    campaigns: [
      {
        id: 'campaign-123',
        name: 'Test Campaign 1',
        status: 'ENABLED',
        impressions: 10000,
        clicks: 500,
        conversions: 25,
        cost: 75.00,
        date: '2024-01-01',
      },
      {
        id: 'campaign-456',
        name: 'Test Campaign 2',
        status: 'PAUSED',
        impressions: 15000,
        clicks: 600,
        conversions: 30,
        cost: 120.00,
        date: '2024-01-02',
      },
    ],
  },
};

test.describe('Google Ads Data Export E2E', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    
    // Mock export APIs
    await page.route('**/api/exports/google**', route => {
      const url = new URL(route.request().url());
      const format = url.searchParams.get('format') || 'csv';
      
      if (route.request().method() === 'POST') {
        // Start export
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            exportId: 'export-123',
            status: 'processing',
            estimatedTime: 30,
            downloadUrl: null,
          }),
        });
      } else {
        // Get export status
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            exportId: 'export-123',
            status: 'completed',
            downloadUrl: `/api/exports/export-123/download`,
            fileSize: 1024,
            recordCount: TEST_CONFIG.mockExportData.campaigns.length,
          }),
        });
      }
    });

    await page.route('**/api/exports/unified**', route => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            exportId: 'unified-export-123',
            status: 'processing',
            estimatedTime: 60,
            platforms: ['google', 'meta'],
          }),
        });
      } else {
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            exportId: 'unified-export-123',
            status: 'completed',
            downloadUrl: `/api/exports/unified-export-123/download`,
            fileSize: 2048,
            recordCount: TEST_CONFIG.mockExportData.campaigns.length * 2,
          }),
        });
      }
    });

    // Mock download endpoint
    await page.route('**/api/exports/*/download**', route => {
      const exportId = route.request().url().split('/').slice(-2, -1)[0];
      const isUnified = exportId.includes('unified');
      
      let csvContent = 'Date,Campaign,Platform,Impressions,Clicks,Conversions,Cost\n';
      
      if (isUnified) {
        // Add both Google and Meta data
        TEST_CONFIG.mockExportData.campaigns.forEach(campaign => {
          csvContent += `${campaign.date},${campaign.name},Google,${campaign.impressions},${campaign.clicks},${campaign.conversions},${campaign.cost}\n`;
          csvContent += `${campaign.date},${campaign.name} (Meta),Meta,${campaign.impressions * 1.5},${campaign.clicks * 1.2},${campaign.conversions * 0.8},${campaign.cost * 1.3}\n`;
        });
      } else {
        // Google only
        TEST_CONFIG.mockExportData.campaigns.forEach(campaign => {
          csvContent += `${campaign.date},${campaign.name},Google,${campaign.impressions},${campaign.clicks},${campaign.conversions},${campaign.cost}\n`;
        });
      }
      
      route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${exportId}.csv"`,
        },
        body: csvContent,
      });
    });

    // Login and setup connected account
    await loginAsTestUser(page);
    await setupConnectedGoogleAds(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test.describe('Google Ads Export', () => {
    test('should export Google Ads data in CSV format', async () => {
      await page.goto('/dashboard/google');
      
      // Click export button
      await page.click('[data-testid="export-data"]');
      await expect(page.getByTestId('export-modal')).toBeVisible();
      
      // Should show export configuration
      await expect(page.getByText('Exportar Dados Google Ads')).toBeVisible();
      
      // Select CSV format
      await page.click('[data-testid="export-format-csv"]');
      await expect(page.getByTestId('export-format-csv')).toBeChecked();
      
      // Select date range
      await page.click('[data-testid="export-date-range"]');
      await page.click('[data-testid="preset-last-30-days"]');
      await expect(page.getByTestId('date-range-display')).toContainText('Últimos 30 dias');
      
      // Select metrics to export
      await page.check('[data-testid="export-metric-impressions"]');
      await page.check('[data-testid="export-metric-clicks"]');
      await page.check('[data-testid="export-metric-conversions"]');
      await page.check('[data-testid="export-metric-cost"]');
      
      // Should show export preview
      await expect(page.getByTestId('export-preview')).toBeVisible();
      await expect(page.getByText('Estimativa: 2 campanhas')).toBeVisible();
      
      // Start export
      await page.click('[data-testid="start-export"]');
      
      // Should show processing state
      await expect(page.getByText('Processando exportação')).toBeVisible();
      await expect(page.getByTestId('export-progress')).toBeVisible();
      
      // Wait for completion
      await page.waitForTimeout(2000);
      
      // Should show download ready
      await expect(page.getByText('Exportação concluída')).toBeVisible();
      await expect(page.getByTestId('download-button')).toBeVisible();
      
      // Download file
      const downloadPromise = page.waitForEvent('download');
      await page.click('[data-testid="download-button"]');
      
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/export-123\.csv$/);
      
      // Verify file content
      const path = await download.path();
      expect(path).toBeTruthy();
    });

    test('should export in JSON format', async () => {
      await page.goto('/dashboard/google');
      
      // Open export modal
      await page.click('[data-testid="export-data"]');
      
      // Select JSON format
      await page.click('[data-testid="export-format-json"]');
      await expect(page.getByTestId('export-format-json')).toBeChecked();
      
      // Configure export
      await page.click('[data-testid="export-date-range"]');
      await page.click('[data-testid="preset-last-7-days"]');
      
      // Select all metrics
      await page.click('[data-testid="select-all-metrics"]');
      
      // Should show JSON preview
      await expect(page.getByTestId('json-preview')).toBeVisible();
      await expect(page.getByText('Formato: JSON')).toBeVisible();
      
      // Start export
      await page.click('[data-testid="start-export"]');
      
      // Wait for completion and download
      await page.waitForTimeout(2000);
      
      const downloadPromise = page.waitForEvent('download');
      await page.click('[data-testid="download-button"]');
      
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/export-123\.json$/);
    });

    test('should handle custom date range export', async () => {
      await page.goto('/dashboard/google');
      
      // Open export modal
      await page.click('[data-testid="export-data"]');
      
      // Select custom date range
      await page.click('[data-testid="export-date-range"]');
      await page.click('[data-testid="custom-date-range"]');
      
      // Set custom dates
      await page.fill('[data-testid="start-date"]', '2024-01-01');
      await page.fill('[data-testid="end-date"]', '2024-01-31');
      await page.click('[data-testid="apply-date-range"]');
      
      // Should show custom range
      await expect(page.getByTestId('date-range-display')).toContainText('01/01/2024 - 31/01/2024');
      
      // Should update export preview
      await expect(page.getByTestId('export-preview')).toContainText('Período: 31 dias');
      
      // Start export
      await page.click('[data-testid="start-export"]');
      
      // Should process successfully
      await page.waitForTimeout(2000);
      await expect(page.getByText('Exportação concluída')).toBeVisible();
    });

    test('should filter campaigns for export', async () => {
      await page.goto('/dashboard/google');
      
      // Open export modal
      await page.click('[data-testid="export-data"]');
      
      // Open campaign filter
      await page.click('[data-testid="campaign-filter"]');
      await expect(page.getByTestId('campaign-filter-panel')).toBeVisible();
      
      // Filter by status
      await page.click('[data-testid="filter-status"]');
      await page.click('[data-testid="status-enabled"]');
      
      // Filter by performance
      await page.fill('[data-testid="min-impressions"]', '5000');
      await page.fill('[data-testid="min-clicks"]', '100');
      
      // Apply filters
      await page.click('[data-testid="apply-campaign-filters"]');
      
      // Should show filtered preview
      await expect(page.getByTestId('filtered-campaigns-count')).toContainText('1 campanha selecionada');
      
      // Start export
      await page.click('[data-testid="start-export"]');
      
      // Should export only filtered campaigns
      await page.waitForTimeout(2000);
      await expect(page.getByText('1 campanha exportada')).toBeVisible();
    });
  });

  test.describe('Unified Export', () => {
    test('should export unified data from both platforms', async () => {
      await page.goto('/dashboard');
      
      // Click unified export button
      await page.click('[data-testid="export-unified-data"]');
      await expect(page.getByTestId('unified-export-modal')).toBeVisible();
      
      // Should show platform selection
      await expect(page.getByText('Exportar Dados Consolidados')).toBeVisible();
      await expect(page.getByTestId('platform-selection')).toBeVisible();
      
      // Select both platforms
      await page.check('[data-testid="include-google"]');
      await page.check('[data-testid="include-meta"]');
      
      // Should show both platforms selected
      await expect(page.getByTestId('selected-platforms')).toContainText('Google Ads, Meta Ads');
      
      // Configure export
      await page.click('[data-testid="export-format-csv"]');
      await page.click('[data-testid="export-date-range"]');
      await page.click('[data-testid="preset-last-30-days"]');
      
      // Select metrics
      await page.check('[data-testid="export-impressions"]');
      await page.check('[data-testid="export-clicks"]');
      await page.check('[data-testid="export-conversions"]');
      await page.check('[data-testid="export-spend"]');
      
      // Should show unified preview
      await expect(page.getByTestId('unified-preview')).toBeVisible();
      await expect(page.getByText('Estimativa: 4 registros')).toBeVisible(); // 2 campaigns x 2 platforms
      
      // Start export
      await page.click('[data-testid="start-unified-export"]');
      
      // Should show processing with platform breakdown
      await expect(page.getByText('Processando dados consolidados')).toBeVisible();
      await expect(page.getByTestId('platform-progress')).toBeVisible();
      
      // Wait for completion
      await page.waitForTimeout(3000);
      
      // Should show completion with summary
      await expect(page.getByText('Exportação consolidada concluída')).toBeVisible();
      await expect(page.getByText('4 registros exportados')).toBeVisible();
      
      // Download unified file
      const downloadPromise = page.waitForEvent('download');
      await page.click('[data-testid="download-unified"]');
      
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/unified-export-123\.csv$/);
    });

    test('should handle single platform unified export', async () => {
      await page.goto('/dashboard');
      
      // Open unified export
      await page.click('[data-testid="export-unified-data"]');
      
      // Select only Google Ads
      await page.check('[data-testid="include-google"]');
      await page.uncheck('[data-testid="include-meta"]');
      
      // Should show single platform warning
      await expect(page.getByTestId('single-platform-warning')).toBeVisible();
      await expect(page.getByText('Apenas Google Ads será exportado')).toBeVisible();
      
      // Should suggest platform-specific export
      await expect(page.getByTestId('suggest-platform-export')).toBeVisible();
      
      // Continue with unified export
      await page.click('[data-testid="continue-unified"]');
      
      // Start export
      await page.click('[data-testid="start-unified-export"]');
      
      // Should process successfully
      await page.waitForTimeout(2000);
      await expect(page.getByText('Exportação concluída')).toBeVisible();
    });

    test('should compare platforms in export', async () => {
      await page.goto('/dashboard');
      
      // Open unified export
      await page.click('[data-testid="export-unified-data"]');
      
      // Select both platforms
      await page.check('[data-testid="include-google"]');
      await page.check('[data-testid="include-meta"]');
      
      // Enable comparison mode
      await page.check('[data-testid="enable-comparison"]');
      
      // Should show comparison options
      await expect(page.getByTestId('comparison-options')).toBeVisible();
      
      // Select comparison metrics
      await page.check('[data-testid="compare-ctr"]');
      await page.check('[data-testid="compare-cpc"]');
      await page.check('[data-testid="compare-conversion-rate"]');
      
      // Should show comparison preview
      await expect(page.getByTestId('comparison-preview')).toBeVisible();
      await expect(page.getByText('Incluirá análise comparativa')).toBeVisible();
      
      // Start export
      await page.click('[data-testid="start-unified-export"]');
      
      // Should include comparison data
      await page.waitForTimeout(3000);
      await expect(page.getByText('Análise comparativa incluída')).toBeVisible();
    });
  });

  test.describe('Export Management', () => {
    test('should show export history', async () => {
      await page.goto('/dashboard/google');
      
      // Open export history
      await page.click('[data-testid="export-history"]');
      await expect(page.getByTestId('export-history-modal')).toBeVisible();
      
      // Should show previous exports
      await expect(page.getByTestId('export-history-list')).toBeVisible();
      await expect(page.getByText('Exportações Anteriores')).toBeVisible();
      
      // Should show export details
      await expect(page.getByTestId('export-entry')).toBeVisible();
      await expect(page.getByText('CSV - Google Ads')).toBeVisible();
      await expect(page.getByText('2 campanhas')).toBeVisible();
      
      // Should allow re-download
      await expect(page.getByTestId('redownload-export')).toBeVisible();
      
      // Should show export date
      await expect(page.getByTestId('export-date')).toBeVisible();
    });

    test('should handle large export with progress tracking', async () => {
      // Mock large export
      await page.route('**/api/exports/google**', route => {
        if (route.request().method() === 'POST') {
          route.fulfill({
            status: 202,
            body: JSON.stringify({
              exportId: 'large-export-123',
              status: 'processing',
              estimatedTime: 300, // 5 minutes
              totalRecords: 10000,
            }),
          });
        }
      });

      await page.goto('/dashboard/google');
      
      // Start large export
      await page.click('[data-testid="export-data"]');
      await page.click('[data-testid="export-format-csv"]');
      await page.click('[data-testid="start-export"]');
      
      // Should show detailed progress
      await expect(page.getByText('Processando exportação grande')).toBeVisible();
      await expect(page.getByTestId('detailed-progress')).toBeVisible();
      
      // Should show estimated time
      await expect(page.getByText('Tempo estimado: 5 minutos')).toBeVisible();
      
      // Should show record count
      await expect(page.getByText('10,000 registros')).toBeVisible();
      
      // Should allow cancellation
      await expect(page.getByTestId('cancel-export')).toBeVisible();
      
      // Should show progress percentage
      await expect(page.getByTestId('progress-percentage')).toBeVisible();
    });

    test('should handle export errors gracefully', async () => {
      // Mock export error
      await page.route('**/api/exports/google**', route => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({
            error: 'Export service unavailable',
            code: 'SERVICE_ERROR',
          }),
        });
      });

      await page.goto('/dashboard/google');
      
      // Try to export
      await page.click('[data-testid="export-data"]');
      await page.click('[data-testid="start-export"]');
      
      // Should show error message
      await expect(page.getByText('Erro na exportação')).toBeVisible();
      await expect(page.getByText('Export service unavailable')).toBeVisible();
      
      // Should show retry option
      await expect(page.getByTestId('retry-export')).toBeVisible();
      
      // Should show alternative options
      await expect(page.getByText('Tente novamente ou contate o suporte')).toBeVisible();
    });

    test('should validate export limits based on plan', async () => {
      // Mock plan limits
      await page.route('**/api/feature-gate/export-permission**', route => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            allowed: false,
            reason: 'Export limit exceeded',
            limit: 5,
            used: 5,
            resetDate: '2024-02-01',
          }),
        });
      });

      await page.goto('/dashboard/google');
      
      // Try to export
      await page.click('[data-testid="export-data"]');
      
      // Should show limit warning
      await expect(page.getByTestId('export-limit-warning')).toBeVisible();
      await expect(page.getByText('Limite de exportações atingido')).toBeVisible();
      
      // Should show upgrade option
      await expect(page.getByTestId('upgrade-plan')).toBeVisible();
      
      // Should show reset date
      await expect(page.getByText('Limite será renovado em 01/02/2024')).toBeVisible();
      
      // Export button should be disabled
      await expect(page.getByTestId('start-export')).toBeDisabled();
    });
  });

  test.describe('Export Notifications', () => {
    test('should notify when export is ready', async () => {
      await page.goto('/dashboard/google');
      
      // Start export
      await page.click('[data-testid="export-data"]');
      await page.click('[data-testid="start-export"]');
      
      // Close modal while processing
      await page.click('[data-testid="close-export-modal"]');
      
      // Should show background processing notification
      await expect(page.getByTestId('export-notification')).toBeVisible();
      await expect(page.getByText('Exportação em andamento')).toBeVisible();
      
      // Wait for completion
      await page.waitForTimeout(3000);
      
      // Should show completion notification
      await expect(page.getByTestId('export-ready-notification')).toBeVisible();
      await expect(page.getByText('Exportação pronta para download')).toBeVisible();
      
      // Should have download action
      await expect(page.getByTestId('notification-download')).toBeVisible();
    });

    test('should send email notification for large exports', async () => {
      // Mock email notification setting
      await page.route('**/api/exports/google**', route => {
        if (route.request().method() === 'POST') {
          route.fulfill({
            status: 202,
            body: JSON.stringify({
              exportId: 'email-export-123',
              status: 'processing',
              estimatedTime: 600, // 10 minutes
              emailNotification: true,
            }),
          });
        }
      });

      await page.goto('/dashboard/google');
      
      // Start large export
      await page.click('[data-testid="export-data"]');
      
      // Enable email notification
      await page.check('[data-testid="email-notification"]');
      
      await page.click('[data-testid="start-export"]');
      
      // Should show email notification confirmation
      await expect(page.getByText('Você receberá um email quando a exportação estiver pronta')).toBeVisible();
      
      // Should show email address
      await expect(page.getByTestId('notification-email')).toContainText(TEST_CONFIG.testUser.email);
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
  
  // Mock campaigns API
  await page.route('**/api/google/campaigns**', route => {
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        campaigns: TEST_CONFIG.mockExportData.campaigns,
        pagination: {
          total: TEST_CONFIG.mockExportData.campaigns.length,
          page: 1,
          limit: 20,
        },
      }),
    });
  });
}