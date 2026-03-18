import { test, expect } from '@playwright/test';

test.describe('Feature Gate Enforcement E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.route('**/api/auth/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'user-123',
            email: 'test@example.com',
          },
        }),
      });
    });
  });

  test.describe('Basic Plan Feature Restrictions', () => {
    test.beforeEach(async ({ page }) => {
      // Mock basic plan subscription
      await page.route('**/api/subscriptions/current', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'sub-basic-123',
            organizationId: 'org-123',
            planId: 'basic-plan',
            status: 'active',
            plan: {
              name: 'Basic Plan',
              features: {
                maxClients: 3,
                maxCampaigns: 10,
                advancedAnalytics: false,
                customReports: false,
                apiAccess: false,
                whiteLabel: false,
                prioritySupport: false,
              },
            },
          }),
        });
      });

      // Mock feature access checks
      await page.route('**/api/feature-gate/check-access', async (route) => {
        const url = new URL(route.request().url());
        const feature = url.searchParams.get('feature');
        
        const basicPlanAccess = {
          'advancedAnalytics': false,
          'customReports': false,
          'apiAccess': false,
          'whiteLabel': false,
        };

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            hasAccess: basicPlanAccess[feature] || false,
            reason: basicPlanAccess[feature] ? 'Feature included in current plan' : 'Feature not included in current plan',
          }),
        });
      });

      // Mock usage limits
      await page.route('**/api/feature-gate/check-usage', async (route) => {
        const url = new URL(route.request().url());
        const feature = url.searchParams.get('feature');
        
        const usageLimits = {
          'clients': { currentUsage: 2, limit: 3, withinLimit: true },
          'campaigns': { currentUsage: 8, limit: 10, withinLimit: true },
        };

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(usageLimits[feature] || { currentUsage: 0, limit: 0, withinLimit: false }),
        });
      });
    });

    test('should restrict access to advanced analytics', async ({ page }) => {
      await page.goto('/dashboard/analytics/advanced');

      // Should show upgrade prompt instead of analytics
      await expect(page.locator('[data-testid="feature-restricted"]')).toBeVisible();
      await expect(page.locator('[data-testid="upgrade-prompt"]')).toContainText('advanced analytics');
      await expect(page.locator('[data-testid="upgrade-button"]')).toBeVisible();

      // Advanced analytics components should not be visible
      await expect(page.locator('[data-testid="advanced-analytics-dashboard"]')).not.toBeVisible();
    });

    test('should restrict custom reports generation', async ({ page }) => {
      await page.goto('/dashboard/reports');

      // Basic reports should be available
      await expect(page.locator('[data-testid="basic-reports"]')).toBeVisible();

      // Custom report builder should be restricted
      await page.click('[data-testid="custom-reports-tab"]');
      await expect(page.locator('[data-testid="feature-restricted"]')).toBeVisible();
      await expect(page.locator('[data-testid="upgrade-prompt"]')).toContainText('custom reports');
    });

    test('should enforce client limits', async ({ page }) => {
      await page.goto('/dashboard/clients');

      // Should show current usage
      await expect(page.locator('[data-testid="client-usage"]')).toContainText('2 of 3 clients');

      // Should allow adding one more client
      await page.click('[data-testid="add-client-button"]');
      await expect(page.locator('[data-testid="add-client-form"]')).toBeVisible();

      // Mock reaching the limit
      await page.route('**/api/feature-gate/check-usage', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            currentUsage: 3,
            limit: 3,
            withinLimit: false,
          }),
        });
      });

      await page.reload();

      // Should show limit reached message
      await expect(page.locator('[data-testid="client-limit-reached"]')).toBeVisible();
      await expect(page.locator('[data-testid="add-client-button"]')).toBeDisabled();
    });

    test('should show upgrade prompts with correct plan suggestions', async ({ page }) => {
      await page.goto('/dashboard/analytics/advanced');

      // Click upgrade button
      await page.click('[data-testid="upgrade-button"]');

      // Should navigate to billing with plan comparison
      await expect(page).toHaveURL(/.*billing.*upgrade/);
      await expect(page.locator('[data-testid="plan-comparison"]')).toBeVisible();

      // Should highlight plans that include the restricted feature
      await expect(page.locator('[data-testid="pro-plan-highlight"]')).toBeVisible();
      await expect(page.locator('[data-testid="enterprise-plan-highlight"]')).toBeVisible();
    });
  });

  test.describe('Pro Plan Feature Access', () => {
    test.beforeEach(async ({ page }) => {
      // Mock pro plan subscription
      await page.route('**/api/subscriptions/current', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'sub-pro-123',
            organizationId: 'org-123',
            planId: 'pro-plan',
            status: 'active',
            plan: {
              name: 'Pro Plan',
              features: {
                maxClients: 10,
                maxCampaigns: 50,
                advancedAnalytics: true,
                customReports: true,
                apiAccess: true,
                whiteLabel: false,
                prioritySupport: true,
              },
            },
          }),
        });
      });

      // Mock feature access checks for pro plan
      await page.route('**/api/feature-gate/check-access', async (route) => {
        const url = new URL(route.request().url());
        const feature = url.searchParams.get('feature');
        
        const proPlanAccess = {
          'advancedAnalytics': true,
          'customReports': true,
          'apiAccess': true,
          'whiteLabel': false, // Still restricted
        };

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            hasAccess: proPlanAccess[feature] || false,
            reason: proPlanAccess[feature] ? 'Feature included in current plan' : 'Feature not included in current plan',
          }),
        });
      });
    });

    test('should allow access to advanced analytics', async ({ page }) => {
      await page.goto('/dashboard/analytics/advanced');

      // Should show full analytics dashboard
      await expect(page.locator('[data-testid="advanced-analytics-dashboard"]')).toBeVisible();
      await expect(page.locator('[data-testid="predictive-analytics"]')).toBeVisible();
      await expect(page.locator('[data-testid="competitor-analysis"]')).toBeVisible();

      // Should not show upgrade prompts
      await expect(page.locator('[data-testid="feature-restricted"]')).not.toBeVisible();
    });

    test('should allow custom reports generation', async ({ page }) => {
      await page.goto('/dashboard/reports');

      // Custom report builder should be available
      await page.click('[data-testid="custom-reports-tab"]');
      await expect(page.locator('[data-testid="custom-report-builder"]')).toBeVisible();

      // Should be able to create custom reports
      await page.click('[data-testid="create-custom-report"]');
      await expect(page.locator('[data-testid="report-builder-form"]')).toBeVisible();
    });

    test('should still restrict white label features', async ({ page }) => {
      await page.goto('/dashboard/settings');

      // White label settings should be restricted
      await page.click('[data-testid="branding-tab"]');
      await expect(page.locator('[data-testid="feature-restricted"]')).toBeVisible();
      await expect(page.locator('[data-testid="upgrade-prompt"]')).toContainText('white label');
    });
  });

  test.describe('Expired/Canceled Subscription', () => {
    test.beforeEach(async ({ page }) => {
      // Mock canceled subscription
      await page.route('**/api/subscriptions/current', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'sub-canceled-123',
            organizationId: 'org-123',
            planId: 'pro-plan',
            status: 'canceled',
            canceledAt: new Date().toISOString(),
            plan: {
              name: 'Pro Plan',
              features: {
                maxClients: 10,
                maxCampaigns: 50,
                advancedAnalytics: true,
                customReports: true,
                apiAccess: true,
                whiteLabel: false,
                prioritySupport: true,
              },
            },
          }),
        });
      });

      // Mock all features as restricted for canceled subscription
      await page.route('**/api/feature-gate/check-access', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            hasAccess: false,
            reason: 'Subscription is not active',
          }),
        });
      });
    });

    test('should restrict all premium features', async ({ page }) => {
      await page.goto('/dashboard/analytics/advanced');

      // Should show subscription expired message
      await expect(page.locator('[data-testid="subscription-expired"]')).toBeVisible();
      await expect(page.locator('[data-testid="reactivate-subscription"]')).toBeVisible();

      // Premium features should not be accessible
      await expect(page.locator('[data-testid="advanced-analytics-dashboard"]')).not.toBeVisible();
    });

    test('should show reactivation options', async ({ page }) => {
      await page.goto('/dashboard');

      // Should show subscription status banner
      await expect(page.locator('[data-testid="subscription-status-banner"]')).toBeVisible();
      await expect(page.locator('[data-testid="subscription-status-banner"]')).toContainText('canceled');

      // Click reactivate
      await page.click('[data-testid="reactivate-subscription-button"]');

      // Should navigate to billing page
      await expect(page).toHaveURL(/.*billing/);
      await expect(page.locator('[data-testid="reactivation-options"]')).toBeVisible();
    });
  });

  test.describe('Trial Subscription', () => {
    test.beforeEach(async ({ page }) => {
      // Mock trial subscription
      await page.route('**/api/subscriptions/current', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'sub-trial-123',
            organizationId: 'org-123',
            planId: 'pro-plan',
            status: 'trialing',
            trialEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            plan: {
              name: 'Pro Plan',
              features: {
                maxClients: 10,
                maxCampaigns: 50,
                advancedAnalytics: true,
                customReports: true,
                apiAccess: true,
                whiteLabel: false,
                prioritySupport: true,
              },
            },
          }),
        });
      });

      // Mock trial access (same as paid but with trial indicators)
      await page.route('**/api/feature-gate/check-access', async (route) => {
        const url = new URL(route.request().url());
        const feature = url.searchParams.get('feature');
        
        const trialAccess = {
          'advancedAnalytics': true,
          'customReports': true,
          'apiAccess': true,
          'whiteLabel': false,
        };

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            hasAccess: trialAccess[feature] || false,
            reason: trialAccess[feature] ? 'Feature included in trial' : 'Feature not included in trial',
            isTrial: true,
            trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          }),
        });
      });
    });

    test('should show trial indicators on premium features', async ({ page }) => {
      await page.goto('/dashboard/analytics/advanced');

      // Should show trial banner
      await expect(page.locator('[data-testid="trial-banner"]')).toBeVisible();
      await expect(page.locator('[data-testid="trial-days-remaining"]')).toContainText('7 days');

      // Features should be accessible but with trial indicators
      await expect(page.locator('[data-testid="advanced-analytics-dashboard"]')).toBeVisible();
      await expect(page.locator('[data-testid="trial-feature-indicator"]')).toBeVisible();
    });

    test('should prompt for subscription before trial ends', async ({ page }) => {
      await page.goto('/dashboard');

      // Should show trial conversion prompt
      await expect(page.locator('[data-testid="trial-conversion-prompt"]')).toBeVisible();
      await expect(page.locator('[data-testid="subscribe-now-button"]')).toBeVisible();

      // Click subscribe
      await page.click('[data-testid="subscribe-now-button"]');

      // Should navigate to billing with trial conversion flow
      await expect(page).toHaveURL(/.*billing.*subscribe/);
      await expect(page.locator('[data-testid="trial-conversion-flow"]')).toBeVisible();
    });
  });
});