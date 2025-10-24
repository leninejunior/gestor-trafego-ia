import { test, expect } from '@playwright/test';

test.describe('Admin Panel Subscription Management E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock admin authentication
    await page.route('**/api/auth/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'admin-123',
            email: 'admin@example.com',
            role: 'super_admin',
          },
        }),
      });
    });

    // Mock admin subscription analytics
    await page.route('**/api/admin/analytics/subscriptions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          totalSubscriptions: 150,
          activeSubscriptions: 120,
          trialingSubscriptions: 20,
          canceledSubscriptions: 10,
          mrr: 12500.00,
          arr: 150000.00,
          churnRate: 5.2,
          conversionRate: 85.5,
        }),
      });
    });

    // Mock subscription list
    await page.route('**/api/admin/subscriptions/search**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          subscriptions: [
            {
              id: 'sub-123',
              organizationId: 'org-123',
              planId: 'pro-plan',
              status: 'active',
              billingCycle: 'monthly',
              currentPeriodStart: new Date().toISOString(),
              currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              organization: {
                name: 'Acme Corp',
                slug: 'acme-corp',
              },
              plan: {
                name: 'Pro Plan',
                monthlyPrice: 99.99,
              },
            },
            {
              id: 'sub-124',
              organizationId: 'org-124',
              planId: 'basic-plan',
              status: 'trialing',
              billingCycle: 'monthly',
              trialEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              organization: {
                name: 'Beta Inc',
                slug: 'beta-inc',
              },
              plan: {
                name: 'Basic Plan',
                monthlyPrice: 29.99,
              },
            },
          ],
          total: 2,
        }),
      });
    });
  });

  test('should display subscription analytics dashboard', async ({ page }) => {
    await page.goto('/admin/subscriptions');

    // Check key metrics
    await expect(page.locator('[data-testid="total-subscriptions"]')).toContainText('150');
    await expect(page.locator('[data-testid="active-subscriptions"]')).toContainText('120');
    await expect(page.locator('[data-testid="mrr-metric"]')).toContainText('$12,500');
    await expect(page.locator('[data-testid="arr-metric"]')).toContainText('$150,000');
    await expect(page.locator('[data-testid="churn-rate"]')).toContainText('5.2%');
    await expect(page.locator('[data-testid="conversion-rate"]')).toContainText('85.5%');

    // Check subscription status distribution chart
    await expect(page.locator('[data-testid="subscription-status-chart"]')).toBeVisible();

    // Check revenue trend chart
    await expect(page.locator('[data-testid="revenue-trend-chart"]')).toBeVisible();
  });

  test('should search and filter subscriptions', async ({ page }) => {
    await page.goto('/admin/subscriptions');

    // Check subscription list
    await expect(page.locator('[data-testid="subscriptions-table"]')).toBeVisible();
    await expect(page.locator('[data-testid="subscription-sub-123"]')).toBeVisible();
    await expect(page.locator('[data-testid="subscription-sub-124"]')).toBeVisible();

    // Test search functionality
    await page.fill('[data-testid="subscription-search"]', 'Acme');
    await page.keyboard.press('Enter');

    // Should filter to show only Acme Corp
    await expect(page.locator('[data-testid="subscription-sub-123"]')).toBeVisible();
    await expect(page.locator('[data-testid="subscription-sub-124"]')).not.toBeVisible();

    // Test status filter
    await page.selectOption('[data-testid="status-filter"]', 'trialing');

    // Should show only trialing subscriptions
    await expect(page.locator('[data-testid="subscription-sub-124"]')).toBeVisible();
    await expect(page.locator('[data-testid="subscription-sub-123"]')).not.toBeVisible();

    // Clear filters
    await page.click('[data-testid="clear-filters"]');
    await expect(page.locator('[data-testid="subscription-sub-123"]')).toBeVisible();
    await expect(page.locator('[data-testid="subscription-sub-124"]')).toBeVisible();
  });

  test('should manage individual subscription', async ({ page }) => {
    // Mock subscription details
    await page.route('**/api/admin/subscriptions/sub-123', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'sub-123',
            organizationId: 'org-123',
            planId: 'pro-plan',
            status: 'active',
            billingCycle: 'monthly',
            currentPeriodStart: new Date().toISOString(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            organization: {
              name: 'Acme Corp',
              slug: 'acme-corp',
              users: [
                {
                  id: 'user-123',
                  email: 'admin@acme.com',
                  role: 'admin',
                },
              ],
            },
            plan: {
              name: 'Pro Plan',
              monthlyPrice: 99.99,
              features: {
                maxClients: 10,
                maxCampaigns: 50,
                advancedAnalytics: true,
              },
            },
            invoices: [
              {
                id: 'inv-123',
                invoiceNumber: 'INV-20240101-0001',
                amount: 99.99,
                status: 'paid',
                dueDate: '2024-01-01T00:00:00Z',
              },
            ],
          }),
        });
      } else if (route.request().method() === 'PUT') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            subscription: {
              id: 'sub-123',
              status: 'canceled',
            },
          }),
        });
      }
    });

    await page.goto('/admin/subscriptions');

    // Click on subscription to view details
    await page.click('[data-testid="view-subscription-sub-123"]');

    // Check subscription details modal/page
    await expect(page.locator('[data-testid="subscription-details"]')).toBeVisible();
    await expect(page.locator('[data-testid="organization-name"]')).toContainText('Acme Corp');
    await expect(page.locator('[data-testid="plan-name"]')).toContainText('Pro Plan');
    await expect(page.locator('[data-testid="subscription-status"]')).toContainText('active');

    // Check organization users
    await expect(page.locator('[data-testid="organization-users"]')).toBeVisible();
    await expect(page.locator('[data-testid="user-admin@acme.com"]')).toBeVisible();

    // Check billing history
    await expect(page.locator('[data-testid="subscription-invoices"]')).toBeVisible();
    await expect(page.locator('[data-testid="invoice-INV-20240101-0001"]')).toBeVisible();

    // Test subscription actions
    await page.click('[data-testid="subscription-actions-menu"]');
    await expect(page.locator('[data-testid="cancel-subscription-action"]')).toBeVisible();
    await expect(page.locator('[data-testid="change-plan-action"]')).toBeVisible();
    await expect(page.locator('[data-testid="adjust-billing-action"]')).toBeVisible();

    // Cancel subscription
    await page.click('[data-testid="cancel-subscription-action"]');
    await page.click('[data-testid="confirm-cancel-subscription"]');

    // Check success message
    await expect(page.locator('[data-testid="subscription-canceled-success"]')).toBeVisible();
  });

  test('should manage subscription plans', async ({ page }) => {
    // Mock plans API
    await page.route('**/api/admin/plans**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'basic-plan',
              name: 'Basic Plan',
              monthlyPrice: 29.99,
              annualPrice: 299.99,
              isActive: true,
              features: {
                maxClients: 3,
                maxCampaigns: 10,
                advancedAnalytics: false,
              },
            },
            {
              id: 'pro-plan',
              name: 'Pro Plan',
              monthlyPrice: 99.99,
              annualPrice: 999.99,
              isActive: true,
              features: {
                maxClients: 10,
                maxCampaigns: 50,
                advancedAnalytics: true,
              },
            },
          ]),
        });
      } else if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'new-plan-123',
            name: 'Enterprise Plan',
            monthlyPrice: 299.99,
            annualPrice: 2999.99,
            isActive: true,
          }),
        });
      }
    });

    await page.goto('/admin/plans');

    // Check plans list
    await expect(page.locator('[data-testid="plans-table"]')).toBeVisible();
    await expect(page.locator('[data-testid="plan-basic-plan"]')).toBeVisible();
    await expect(page.locator('[data-testid="plan-pro-plan"]')).toBeVisible();

    // Create new plan
    await page.click('[data-testid="create-plan-button"]');

    // Fill plan form
    await page.fill('[data-testid="plan-name"]', 'Enterprise Plan');
    await page.fill('[data-testid="plan-description"]', 'Enterprise plan with unlimited features');
    await page.fill('[data-testid="monthly-price"]', '299.99');
    await page.fill('[data-testid="annual-price"]', '2999.99');

    // Configure features
    await page.fill('[data-testid="max-clients"]', '-1'); // Unlimited
    await page.fill('[data-testid="max-campaigns"]', '-1'); // Unlimited
    await page.check('[data-testid="advanced-analytics"]');
    await page.check('[data-testid="custom-reports"]');
    await page.check('[data-testid="api-access"]');
    await page.check('[data-testid="white-label"]');
    await page.check('[data-testid="priority-support"]');

    // Save plan
    await page.click('[data-testid="save-plan-button"]');

    // Check success message
    await expect(page.locator('[data-testid="plan-created-success"]')).toBeVisible();
  });

  test('should handle billing management', async ({ page }) => {
    // Mock billing data
    await page.route('**/api/admin/billing/failed-payments', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'pi_failed_123',
            subscriptionId: 'sub-123',
            amount: 99.99,
            currency: 'usd',
            status: 'requires_payment_method',
            lastAttempt: new Date().toISOString(),
            retryCount: 2,
            organization: {
              name: 'Acme Corp',
            },
          },
        ]),
      });
    });

    await page.route('**/api/admin/billing/retry-payment/pi_failed_123', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          paymentIntent: {
            id: 'pi_retry_123',
            status: 'processing',
          },
        }),
      });
    });

    await page.goto('/admin/billing-management');

    // Check failed payments section
    await expect(page.locator('[data-testid="failed-payments-section"]')).toBeVisible();
    await expect(page.locator('[data-testid="failed-payment-pi_failed_123"]')).toBeVisible();

    // Check payment details
    await expect(page.locator('[data-testid="payment-amount-pi_failed_123"]')).toContainText('$99.99');
    await expect(page.locator('[data-testid="payment-organization-pi_failed_123"]')).toContainText('Acme Corp');
    await expect(page.locator('[data-testid="retry-count-pi_failed_123"]')).toContainText('2');

    // Retry payment
    await page.click('[data-testid="retry-payment-pi_failed_123"]');
    await page.click('[data-testid="confirm-retry-payment"]');

    // Check success message
    await expect(page.locator('[data-testid="payment-retry-success"]')).toBeVisible();
  });

  test('should export subscription data', async ({ page }) => {
    // Mock export API
    await page.route('**/api/admin/analytics/export**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          downloadUrl: '/api/admin/analytics/export/download/export-123.csv',
          filename: 'subscriptions-export-2024-01-01.csv',
        }),
      });
    });

    await page.goto('/admin/subscriptions');

    // Click export button
    await page.click('[data-testid="export-subscriptions-button"]');

    // Configure export options
    await page.selectOption('[data-testid="export-format"]', 'csv');
    await page.selectOption('[data-testid="export-date-range"]', 'last-30-days');
    await page.check('[data-testid="include-canceled"]');

    // Start export
    await page.click('[data-testid="start-export-button"]');

    // Check export progress/success
    await expect(page.locator('[data-testid="export-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="download-export-link"]')).toBeVisible();
  });
});