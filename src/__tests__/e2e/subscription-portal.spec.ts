import { test, expect } from '@playwright/test';

test.describe('Subscription Portal E2E Tests', () => {
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

    // Mock subscription data
    await page.route('**/api/subscriptions/current', async (route) => {
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
          plan: {
            id: 'pro-plan',
            name: 'Pro Plan',
            monthlyPrice: 99.99,
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

    // Mock available plans
    await page.route('**/api/subscriptions/plans', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'basic-plan',
            name: 'Basic Plan',
            monthlyPrice: 29.99,
            annualPrice: 299.99,
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
          {
            id: 'pro-plan',
            name: 'Pro Plan',
            monthlyPrice: 99.99,
            annualPrice: 999.99,
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
          {
            id: 'enterprise-plan',
            name: 'Enterprise Plan',
            monthlyPrice: 299.99,
            annualPrice: 2999.99,
            features: {
              maxClients: -1,
              maxCampaigns: -1,
              advancedAnalytics: true,
              customReports: true,
              apiAccess: true,
              whiteLabel: true,
              prioritySupport: true,
            },
          },
        ]),
      });
    });
  });

  test('should display current subscription details', async ({ page }) => {
    await page.goto('/dashboard/billing');

    // Check current plan display
    await expect(page.locator('[data-testid="current-plan-name"]')).toContainText('Pro Plan');
    await expect(page.locator('[data-testid="current-plan-price"]')).toContainText('$99.99');
    await expect(page.locator('[data-testid="billing-cycle"]')).toContainText('monthly');
    await expect(page.locator('[data-testid="subscription-status"]')).toContainText('active');

    // Check feature list
    await expect(page.locator('[data-testid="feature-advanced-analytics"]')).toBeVisible();
    await expect(page.locator('[data-testid="feature-custom-reports"]')).toBeVisible();
    await expect(page.locator('[data-testid="feature-api-access"]')).toBeVisible();
    await expect(page.locator('[data-testid="feature-priority-support"]')).toBeVisible();

    // Check that disabled features are not shown or marked as unavailable
    await expect(page.locator('[data-testid="feature-white-label"]')).not.toBeVisible();
  });

  test('should show plan comparison and upgrade options', async ({ page }) => {
    await page.goto('/dashboard/billing');

    // Click upgrade button
    await page.click('[data-testid="upgrade-plan-button"]');

    // Check plan comparison modal/page
    await expect(page.locator('[data-testid="plan-comparison"]')).toBeVisible();

    // Verify all plans are displayed
    await expect(page.locator('[data-testid="plan-basic"]')).toBeVisible();
    await expect(page.locator('[data-testid="plan-pro"]')).toBeVisible();
    await expect(page.locator('[data-testid="plan-enterprise"]')).toBeVisible();

    // Check current plan is highlighted
    await expect(page.locator('[data-testid="plan-pro"]')).toHaveClass(/current-plan/);

    // Verify feature comparison
    await expect(page.locator('[data-testid="basic-max-clients"]')).toContainText('3');
    await expect(page.locator('[data-testid="pro-max-clients"]')).toContainText('10');
    await expect(page.locator('[data-testid="enterprise-max-clients"]')).toContainText('Unlimited');
  });

  test('should handle plan upgrade flow', async ({ page }) => {
    // Mock upgrade calculation
    await page.route('**/api/subscriptions/calculate-proration', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          proratedAmount: 100.00,
          creditAmount: 50.00,
          upgradeAmount: 150.00,
          nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      });
    });

    // Mock upgrade API
    await page.route('**/api/subscriptions/upgrade', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          subscription: {
            id: 'sub-123',
            planId: 'enterprise-plan',
            status: 'active',
          },
          prorationAmount: 100.00,
        }),
      });
    });

    await page.goto('/dashboard/billing');
    await page.click('[data-testid="upgrade-plan-button"]');

    // Select Enterprise plan
    await page.click('[data-testid="select-enterprise-plan"]');

    // Check upgrade preview
    await expect(page.locator('[data-testid="upgrade-preview"]')).toBeVisible();
    await expect(page.locator('[data-testid="prorated-amount"]')).toContainText('$100.00');
    await expect(page.locator('[data-testid="credit-amount"]')).toContainText('$50.00');

    // Confirm upgrade
    await page.click('[data-testid="confirm-upgrade-button"]');

    // Check success message
    await expect(page.locator('[data-testid="upgrade-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="upgrade-success"]')).toContainText('Successfully upgraded');
  });

  test('should display billing history', async ({ page }) => {
    // Mock billing history
    await page.route('**/api/subscriptions/billing-history', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'inv-123',
            invoiceNumber: 'INV-20240101-0001',
            amount: 99.99,
            currency: 'usd',
            status: 'paid',
            dueDate: '2024-01-01T00:00:00Z',
            paidAt: '2024-01-01T12:00:00Z',
            lineItems: [
              {
                description: 'Pro Plan - Monthly Subscription',
                amount: 99.99,
                quantity: 1,
              },
            ],
          },
          {
            id: 'inv-124',
            invoiceNumber: 'INV-20240201-0001',
            amount: 99.99,
            currency: 'usd',
            status: 'paid',
            dueDate: '2024-02-01T00:00:00Z',
            paidAt: '2024-02-01T12:00:00Z',
            lineItems: [
              {
                description: 'Pro Plan - Monthly Subscription',
                amount: 99.99,
                quantity: 1,
              },
            ],
          },
        ]),
      });
    });

    await page.goto('/dashboard/billing');

    // Navigate to billing history
    await page.click('[data-testid="billing-history-tab"]');

    // Check billing history table
    await expect(page.locator('[data-testid="billing-history-table"]')).toBeVisible();
    await expect(page.locator('[data-testid="invoice-INV-20240101-0001"]')).toBeVisible();
    await expect(page.locator('[data-testid="invoice-INV-20240201-0001"]')).toBeVisible();

    // Check invoice details
    await expect(page.locator('[data-testid="invoice-amount-inv-123"]')).toContainText('$99.99');
    await expect(page.locator('[data-testid="invoice-status-inv-123"]')).toContainText('Paid');

    // Test download invoice
    await page.click('[data-testid="download-invoice-inv-123"]');
    // Note: In a real test, you'd verify the download actually happened
  });

  test('should handle subscription cancellation flow', async ({ page }) => {
    // Mock cancellation API
    await page.route('**/api/subscriptions/cancel', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          subscription: {
            id: 'sub-123',
            status: 'canceled',
            canceledAt: new Date().toISOString(),
          },
        }),
      });
    });

    await page.goto('/dashboard/billing');

    // Click cancel subscription
    await page.click('[data-testid="cancel-subscription-button"]');

    // Check cancellation modal
    await expect(page.locator('[data-testid="cancellation-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="cancellation-warning"]')).toContainText('lose access');

    // Confirm cancellation
    await page.click('[data-testid="confirm-cancellation-button"]');

    // Check success message
    await expect(page.locator('[data-testid="cancellation-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="cancellation-success"]')).toContainText('successfully canceled');
  });

  test('should update payment method', async ({ page }) => {
    // Mock payment methods API
    await page.route('**/api/subscriptions/payment-methods', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'pm_123',
              type: 'card',
              card: {
                brand: 'visa',
                last4: '4242',
                exp_month: 12,
                exp_year: 2025,
              },
            },
          ]),
        });
      } else if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            paymentMethod: {
              id: 'pm_new_123',
              type: 'card',
              card: {
                brand: 'mastercard',
                last4: '5555',
                exp_month: 6,
                exp_year: 2026,
              },
            },
          }),
        });
      }
    });

    await page.goto('/dashboard/billing');

    // Navigate to payment methods
    await page.click('[data-testid="payment-methods-tab"]');

    // Check current payment method
    await expect(page.locator('[data-testid="current-payment-method"]')).toBeVisible();
    await expect(page.locator('[data-testid="card-last4"]')).toContainText('4242');

    // Add new payment method
    await page.click('[data-testid="add-payment-method-button"]');

    // Fill payment form (mocked Stripe Elements)
    await page.fill('[data-testid="card-number"]', '5555555555554444');
    await page.fill('[data-testid="card-expiry"]', '06/26');
    await page.fill('[data-testid="card-cvc"]', '123');

    // Submit new payment method
    await page.click('[data-testid="save-payment-method-button"]');

    // Check success message
    await expect(page.locator('[data-testid="payment-method-success"]')).toBeVisible();
  });
});