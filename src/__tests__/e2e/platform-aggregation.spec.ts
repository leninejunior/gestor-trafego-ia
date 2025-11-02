/**
 * Platform Aggregation E2E Tests
 * 
 * End-to-end tests for multi-platform data aggregation functionality
 * Requirements: 5.1, 5.2, 5.5
 */

import { test, expect } from '@playwright/test';

test.describe('Platform Aggregation E2E Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.route('**/api/auth/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'test-user-123',
            email: 'test@example.com',
          },
        }),
      });
    });

    // Mock client membership
    await page.route('**/api/clients/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          clients: [
            {
              id: 'client-123',
              name: 'Test Client',
              organization_id: 'org-123',
            },
          ],
        }),
      });
    });
  });

  test.describe('Unified Dashboard', () => {
    test('should display aggregated metrics from both platforms', async ({ page }) => {
      // Mock unified metrics API
      await page.route('**/api/unified/metrics**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              total: {
                spend: 2500,
                conversions: 110,
                impressions: 220000,
                clicks: 4400,
                averageRoas: 2.7,
                averageCtr: 2.0,
                averageCpc: 0.568,
                averageCpa: 22.7,
                averageConversionRate: 2.5,
              },
              byPlatform: [
                {
                  platform: 'meta',
                  spend: 1000,
                  conversions: 50,
                  impressions: 100000,
                  clicks: 2000,
                  ctr: 2.0,
                  cpc: 0.5,
                  cpa: 20,
                  roas: 3.0,
                  conversionRate: 2.5,
                },
                {
                  platform: 'google',
                  spend: 1500,
                  conversions: 60,
                  impressions: 120000,
                  clicks: 2400,
                  ctr: 2.0,
                  cpc: 0.625,
                  cpa: 25,
                  roas: 2.4,
                  conversionRate: 2.5,
                },
              ],
              dataQuality: {
                metaDataAvailable: true,
                googleDataAvailable: true,
                totalCampaigns: 10,
                metaCampaigns: 5,
                googleCampaigns: 5,
              },
            },
          }),
        });
      });

      await page.goto('/dashboard');

      // Check that unified metrics are displayed
      await expect(page.locator('[data-testid="total-spend"]')).toContainText('$2,500');
      await expect(page.locator('[data-testid="total-conversions"]')).toContainText('110');
      await expect(page.locator('[data-testid="total-impressions"]')).toContainText('220,000');
      await expect(page.locator('[data-testid="average-roas"]')).toContainText('2.7');

      // Check platform breakdown
      await expect(page.locator('[data-testid="meta-spend"]')).toContainText('$1,000');
      await expect(page.locator('[data-testid="google-spend"]')).toContainText('$1,500');
    });

    test('should handle partial data when one platform is unavailable', async ({ page }) => {
      // Mock unified metrics API with partial data
      await page.route('**/api/unified/metrics**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              total: {
                spend: 1000,
                conversions: 50,
                impressions: 100000,
                clicks: 2000,
                averageRoas: 3.0,
                averageCtr: 2.0,
                averageCpc: 0.5,
                averageCpa: 20,
                averageConversionRate: 2.5,
              },
              byPlatform: [
                {
                  platform: 'meta',
                  spend: 1000,
                  conversions: 50,
                  impressions: 100000,
                  clicks: 2000,
                  ctr: 2.0,
                  cpc: 0.5,
                  cpa: 20,
                  roas: 3.0,
                  conversionRate: 2.5,
                },
              ],
              dataQuality: {
                metaDataAvailable: true,
                googleDataAvailable: false,
                totalCampaigns: 5,
                metaCampaigns: 5,
                googleCampaigns: 0,
              },
            },
            meta: {
              partialData: true,
              warnings: ['Google Ads data not available'],
            },
          }),
        });
      });

      await page.goto('/dashboard');

      // Check that partial data warning is displayed
      await expect(page.locator('[data-testid="partial-data-warning"]')).toBeVisible();
      await expect(page.locator('[data-testid="partial-data-warning"]')).toContainText('Google Ads data not available');

      // Check that only Meta data is shown
      await expect(page.locator('[data-testid="meta-platform-card"]')).toBeVisible();
      await expect(page.locator('[data-testid="google-platform-card"]')).not.toBeVisible();

      // Check connect Google Ads prompt
      await expect(page.locator('[data-testid="connect-google-prompt"]')).toBeVisible();
    });

    test('should allow date range filtering', async ({ page }) => {
      let requestUrl = '';
      
      await page.route('**/api/unified/metrics**', async (route) => {
        requestUrl = route.request().url();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              total: { spend: 1500, conversions: 75 },
              byPlatform: [],
              dataQuality: { metaDataAvailable: true, googleDataAvailable: true },
            },
          }),
        });
      });

      await page.goto('/dashboard');

      // Open date range picker
      await page.click('[data-testid="date-range-picker"]');

      // Select custom date range
      await page.fill('[data-testid="start-date-input"]', '2024-01-01');
      await page.fill('[data-testid="end-date-input"]', '2024-01-31');
      await page.click('[data-testid="apply-date-range"]');

      // Wait for API call
      await page.waitForTimeout(1000);

      // Verify API was called with correct date range
      expect(requestUrl).toContain('startDate=2024-01-01');
      expect(requestUrl).toContain('endDate=2024-01-31');
    });
  });

  test.describe('Platform Comparison', () => {
    test('should display platform comparison charts', async ({ page }) => {
      // Mock comparison API
      await page.route('**/api/unified/comparison**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              platforms: {
                meta: {
                  platform: 'meta',
                  spend: 1000,
                  conversions: 50,
                  roas: 3.0,
                  ctr: 2.0,
                  cpc: 0.5,
                },
                google: {
                  platform: 'google',
                  spend: 1500,
                  conversions: 60,
                  roas: 2.4,
                  ctr: 2.0,
                  cpc: 0.625,
                },
              },
              comparison: {
                betterPerformingPlatform: 'meta',
                metrics: {
                  roas: {
                    meta: 3.0,
                    google: 2.4,
                    difference: 25,
                    winner: 'meta',
                    significance: 'high',
                  },
                  cpc: {
                    meta: 0.5,
                    google: 0.625,
                    difference: -20,
                    winner: 'meta',
                    significance: 'medium',
                  },
                },
              },
              insights: [
                'Meta Ads shows 25.0% better ROAS than Google Ads',
                'Meta Ads has 20.0% lower cost per click',
              ],
            },
          }),
        });
      });

      await page.goto('/dashboard/analytics');

      // Check comparison chart is displayed
      await expect(page.locator('[data-testid="platform-comparison-chart"]')).toBeVisible();

      // Check platform performance indicators
      await expect(page.locator('[data-testid="better-platform-indicator"]')).toContainText('Meta Ads');

      // Check insights
      await expect(page.locator('[data-testid="comparison-insights"]')).toContainText('25.0% better ROAS');
      await expect(page.locator('[data-testid="comparison-insights"]')).toContainText('20.0% lower cost per click');

      // Check metric comparison cards
      await expect(page.locator('[data-testid="roas-comparison"]')).toBeVisible();
      await expect(page.locator('[data-testid="cpc-comparison"]')).toBeVisible();
    });

    test('should handle comparison with only one platform', async ({ page }) => {
      await page.route('**/api/unified/comparison**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              platforms: {
                meta: {
                  platform: 'meta',
                  spend: 1000,
                  conversions: 50,
                  roas: 3.0,
                },
              },
              comparison: {
                betterPerformingPlatform: 'meta',
                metrics: {},
              },
              insights: [
                'Only Meta Ads data is available. Consider connecting Google Ads for comprehensive analysis.',
              ],
            },
          }),
        });
      });

      await page.goto('/dashboard/analytics');

      // Check single platform message
      await expect(page.locator('[data-testid="single-platform-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="connect-missing-platform"]')).toBeVisible();

      // Check insight about missing platform
      await expect(page.locator('[data-testid="comparison-insights"]')).toContainText('Consider connecting Google Ads');
    });
  });

  test.describe('Time Series Analysis', () => {
    test('should display time series charts', async ({ page }) => {
      await page.route('**/api/unified/time-series**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              dateRange: {
                startDate: '2024-01-01',
                endDate: '2024-01-07',
              },
              granularity: 'day',
              dataPoints: [
                {
                  date: '2024-01-01',
                  meta: { spend: 100, conversions: 5 },
                  google: { spend: 150, conversions: 6 },
                  total: { spend: 250, conversions: 11 },
                },
                {
                  date: '2024-01-02',
                  meta: { spend: 110, conversions: 6 },
                  google: { spend: 140, conversions: 5 },
                  total: { spend: 250, conversions: 11 },
                },
                // ... more data points
              ],
            },
            summary: {
              totalDataPoints: 7,
              trends: {
                spend: { direction: 'up', change: 5.2, confidence: 'medium' },
                conversions: { direction: 'stable', change: 1.1, confidence: 'low' },
              },
            },
          }),
        });
      });

      await page.goto('/dashboard/analytics/trends');

      // Check time series chart is displayed
      await expect(page.locator('[data-testid="time-series-chart"]')).toBeVisible();

      // Check trend indicators
      await expect(page.locator('[data-testid="spend-trend"]')).toContainText('up');
      await expect(page.locator('[data-testid="conversions-trend"]')).toContainText('stable');

      // Check granularity selector
      await expect(page.locator('[data-testid="granularity-selector"]')).toBeVisible();
    });

    test('should allow granularity changes', async ({ page }) => {
      let requestUrl = '';
      
      await page.route('**/api/unified/time-series**', async (route) => {
        requestUrl = route.request().url();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              granularity: 'week',
              dataPoints: [],
            },
          }),
        });
      });

      await page.goto('/dashboard/analytics/trends');

      // Change granularity to weekly
      await page.selectOption('[data-testid="granularity-selector"]', 'week');

      // Wait for API call
      await page.waitForTimeout(1000);

      // Verify API was called with correct granularity
      expect(requestUrl).toContain('granularity=week');
    });
  });

  test.describe('Insights and Recommendations', () => {
    test('should display actionable insights', async ({ page }) => {
      await page.route('**/api/unified/insights**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              insights: [
                {
                  type: 'opportunity',
                  platform: 'google',
                  metric: 'ctr',
                  title: 'Low Click-Through Rate',
                  description: 'CTR of 1.2% suggests ad creative may need improvement.',
                  impact: 'medium',
                  actionable: true,
                  recommendation: 'Test new ad creatives, headlines, and calls-to-action to improve engagement.',
                },
                {
                  type: 'success',
                  platform: 'meta',
                  metric: 'roas',
                  title: 'Excellent Return on Ad Spend',
                  description: 'Outstanding ROAS of 4.2 indicates highly effective campaigns.',
                  impact: 'high',
                  actionable: true,
                  recommendation: 'Consider increasing budget allocation to scale successful campaigns.',
                },
                {
                  type: 'warning',
                  metric: 'connectivity',
                  title: 'Platform Performance Gap',
                  description: 'Meta Ads significantly outperforms Google Ads in ROAS.',
                  impact: 'high',
                  actionable: true,
                  recommendation: 'Analyze successful strategies from Meta and apply them to improve Google Ads performance.',
                },
              ],
              summary: {
                totalInsights: 3,
                highImpactInsights: 2,
                actionableInsights: 3,
                platformSpecificInsights: {
                  meta: 1,
                  google: 1,
                  unified: 1,
                },
              },
            },
          }),
        });
      });

      await page.goto('/dashboard/insights');

      // Check insights are displayed
      await expect(page.locator('[data-testid="insights-list"]')).toBeVisible();
      await expect(page.locator('[data-testid="insight-card"]')).toHaveCount(3);

      // Check insight types
      await expect(page.locator('[data-testid="opportunity-insight"]')).toBeVisible();
      await expect(page.locator('[data-testid="success-insight"]')).toBeVisible();
      await expect(page.locator('[data-testid="warning-insight"]')).toBeVisible();

      // Check actionable recommendations
      await expect(page.locator('[data-testid="recommendation"]')).toHaveCount(3);

      // Check summary stats
      await expect(page.locator('[data-testid="total-insights"]')).toContainText('3');
      await expect(page.locator('[data-testid="high-impact-insights"]')).toContainText('2');
      await expect(page.locator('[data-testid="actionable-insights"]')).toContainText('3');
    });

    test('should filter insights by type and impact', async ({ page }) => {
      let requestUrl = '';
      
      await page.route('**/api/unified/insights**', async (route) => {
        requestUrl = route.request().url();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              insights: [
                {
                  type: 'opportunity',
                  impact: 'high',
                  title: 'High Impact Opportunity',
                  actionable: true,
                },
              ],
              summary: { totalInsights: 1 },
            },
          }),
        });
      });

      await page.goto('/dashboard/insights');

      // Filter by type
      await page.selectOption('[data-testid="insight-type-filter"]', 'opportunity');

      // Filter by impact
      await page.selectOption('[data-testid="impact-filter"]', 'high');

      // Apply filters
      await page.click('[data-testid="apply-filters"]');

      // Wait for API call
      await page.waitForTimeout(1000);

      // Verify API was called with correct filters
      expect(requestUrl).toContain('types=opportunity');
      expect(requestUrl).toContain('minImpact=high');
    });
  });

  test.describe('Error Handling', () => {
    test('should handle API errors gracefully', async ({ page }) => {
      await page.route('**/api/unified/metrics**', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Failed to aggregate metrics',
            details: [
              { platform: 'meta', error: 'Connection timeout', retryable: true },
              { platform: 'google', error: 'API rate limit exceeded', retryable: true },
            ],
          }),
        });
      });

      await page.goto('/dashboard');

      // Check error message is displayed
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Failed to aggregate metrics');

      // Check retry button is available
      await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();

      // Check platform-specific error details
      await expect(page.locator('[data-testid="platform-errors"]')).toContainText('Connection timeout');
      await expect(page.locator('[data-testid="platform-errors"]')).toContainText('API rate limit exceeded');
    });

    test('should handle network connectivity issues', async ({ page }) => {
      // Simulate network failure
      await page.route('**/api/unified/**', async (route) => {
        await route.abort('failed');
      });

      await page.goto('/dashboard');

      // Check offline message
      await expect(page.locator('[data-testid="offline-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="offline-message"]')).toContainText('Unable to connect');

      // Check cached data fallback if available
      const cachedDataElement = page.locator('[data-testid="cached-data-indicator"]');
      if (await cachedDataElement.isVisible()) {
        await expect(cachedDataElement).toContainText('Showing cached data');
      }
    });
  });

  test.describe('Performance', () => {
    test('should load dashboard within acceptable time', async ({ page }) => {
      const startTime = Date.now();

      await page.route('**/api/unified/metrics**', async (route) => {
        // Simulate realistic API response time
        await new Promise(resolve => setTimeout(resolve, 500));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              total: { spend: 1000, conversions: 50 },
              byPlatform: [],
              dataQuality: { metaDataAvailable: true, googleDataAvailable: true },
            },
          }),
        });
      });

      await page.goto('/dashboard');
      await expect(page.locator('[data-testid="dashboard-content"]')).toBeVisible();

      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(3000); // Should load within 3 seconds
    });

    test('should handle large datasets efficiently', async ({ page }) => {
      // Mock large dataset response
      const largeDataset = {
        success: true,
        data: {
          total: { spend: 100000, conversions: 5000 },
          byPlatform: Array.from({ length: 100 }, (_, i) => ({
            platform: i % 2 === 0 ? 'meta' : 'google',
            spend: 1000,
            conversions: 50,
          })),
          dataQuality: { metaDataAvailable: true, googleDataAvailable: true },
        },
      };

      await page.route('**/api/unified/metrics**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(largeDataset),
        });
      });

      const startTime = Date.now();
      await page.goto('/dashboard');
      await expect(page.locator('[data-testid="dashboard-content"]')).toBeVisible();
      const renderTime = Date.now() - startTime;

      expect(renderTime).toBeLessThan(5000); // Should render within 5 seconds even with large dataset
    });
  });
});