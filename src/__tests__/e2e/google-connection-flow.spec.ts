/**
 * Google Ads Connection Flow E2E Tests
 * 
 * Tests complete user journey for connecting Google Ads accounts
 * Requirements: 1.1, 4.1
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
    customerId: '1234567890',
  },
};

test.describe('Google Ads Connection Flow E2E', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    
    // Mock external Google APIs
    await page.route('**/accounts.google.com/**', route => {
      const url = route.request().url();
      
      if (url.includes('oauth/authorize')) {
        // Mock OAuth authorization page
        route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: `
            <html>
              <body>
                <h1>Google OAuth Authorization</h1>
                <form action="/oauth/callback" method="get">
                  <input type="hidden" name="code" value="${TEST_CONFIG.mockGoogleAuth.code}" />
                  <input type="hidden" name="state" value="${TEST_CONFIG.mockGoogleAuth.state}" />
                  <button type="submit" data-testid="authorize-button">Authorize</button>
                </form>
              </body>
            </html>
          `,
        });
      } else {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ success: true }),
        });
      }
    });

    await page.route('**/googleads.googleapis.com/**', route => {
      const url = route.request().url();
      
      if (url.includes('customers:listAccessibleCustomers')) {
        // Mock accessible customers API
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            resourceNames: [
              'customers/1234567890',
              'customers/0987654321',
            ],
          }),
        });
      } else if (url.includes('customers/')) {
        // Mock customer details API
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            results: [
              {
                customer: {
                  resourceName: 'customers/1234567890',
                  id: '1234567890',
                  descriptiveName: 'Test Account 1',
                  currencyCode: 'USD',
                  timeZone: 'America/New_York',
                },
              },
            ],
          }),
        });
      } else {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ success: true }),
        });
      }
    });

    // Login as test user
    await loginAsTestUser(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test.describe('OAuth Connection Process', () => {
    test('should complete full OAuth connection flow', async () => {
      // Navigate to dashboard
      await page.goto('/dashboard');
      await expect(page).toHaveTitle(/Dashboard/);

      // Navigate to Google Ads section
      await page.click('[data-testid="sidebar-google-ads"]');
      await expect(page).toHaveURL(/.*dashboard\/google.*/);

      // Should show connection prompt
      await expect(page.getByText('Conectar Google Ads')).toBeVisible();
      await expect(page.getByTestId('connect-google-ads')).toBeVisible();

      // Click connect Google Ads button
      await page.click('[data-testid="connect-google-ads"]');
      
      // Should redirect to OAuth flow
      await page.waitForURL(/.*accounts\.google\.com.*/);
      await expect(page.getByText('Google OAuth Authorization')).toBeVisible();
      
      // Authorize the application
      await page.click('[data-testid="authorize-button"]');
      
      // Should redirect to account selection page
      await page.waitForURL(/.*google\/select-accounts.*/);
      await expect(page.getByText('Selecionar Contas Google Ads')).toBeVisible();
      
      // Should show available accounts
      await expect(page.getByText('Test Account 1')).toBeVisible();
      await expect(page.getByText('1234567890')).toBeVisible();
      
      // Select account
      await page.check('[data-testid="account-checkbox-1234567890"]');
      await expect(page.getByTestId('account-checkbox-1234567890')).toBeChecked();
      
      // Connect selected accounts
      await page.click('[data-testid="connect-accounts-button"]');
      
      // Should redirect back to dashboard with success message
      await page.waitForURL(/.*dashboard\/google.*/);
      await expect(page.getByText('Conta conectada com sucesso')).toBeVisible();
      
      // Should show connected account status
      await expect(page.getByTestId('connection-status-active')).toBeVisible();
      await expect(page.getByText('Test Account 1')).toBeVisible();
    });

    test('should handle OAuth cancellation gracefully', async () => {
      await page.goto('/dashboard/google');
      
      // Click connect button
      await page.click('[data-testid="connect-google-ads"]');
      
      // Wait for OAuth page
      await page.waitForURL(/.*accounts\.google\.com.*/);
      
      // Simulate user canceling OAuth by navigating back
      await page.goBack();
      
      // Should return to dashboard
      await page.waitForURL(/.*dashboard\/google.*/);
      
      // Should show appropriate message
      await expect(page.getByText('Conexão cancelada')).toBeVisible();
      
      // Connect button should still be available
      await expect(page.getByTestId('connect-google-ads')).toBeVisible();
    });

    test('should handle OAuth errors', async () => {
      // Mock OAuth error response
      await page.route('**/api/google/callback**', route => {
        const url = new URL(route.request().url());
        url.searchParams.set('error', 'access_denied');
        url.searchParams.set('error_description', 'User denied access');
        
        route.fulfill({
          status: 302,
          headers: {
            'Location': `/dashboard/google?error=oauth_error&message=${encodeURIComponent('Acesso negado pelo usuário')}`,
          },
        });
      });

      await page.goto('/dashboard/google');
      
      // Click connect button
      await page.click('[data-testid="connect-google-ads"]');
      
      // Wait for OAuth page and authorize (will trigger error)
      await page.waitForURL(/.*accounts\.google\.com.*/);
      await page.click('[data-testid="authorize-button"]');
      
      // Should redirect back with error
      await page.waitForURL(/.*dashboard\/google.*error=oauth_error.*/);
      await expect(page.getByText('Acesso negado pelo usuário')).toBeVisible();
      
      // Should show retry option
      await expect(page.getByTestId('connect-google-ads')).toBeVisible();
    });

    test('should validate account selection', async () => {
      // Complete OAuth flow to account selection
      await completeOAuthFlow(page);
      
      // Should be on account selection page
      await expect(page).toHaveURL(/.*google\/select-accounts.*/);
      
      // Try to connect without selecting any accounts
      await page.click('[data-testid="connect-accounts-button"]');
      
      // Should show validation error
      await expect(page.getByText('Selecione pelo menos uma conta')).toBeVisible();
      
      // Select an account
      await page.check('[data-testid="account-checkbox-1234567890"]');
      
      // Now connection should work
      await page.click('[data-testid="connect-accounts-button"]');
      await page.waitForURL(/.*dashboard\/google.*/);
      await expect(page.getByText('Conta conectada com sucesso')).toBeVisible();
    });
  });

  test.describe('Account Management', () => {
    test.beforeEach(async () => {
      // Setup connected account
      await connectGoogleAdsAccount(page);
    });

    test('should display connected account information', async () => {
      await page.goto('/dashboard/google');
      
      // Should show connection status
      await expect(page.getByTestId('connection-status-active')).toBeVisible();
      await expect(page.getByText('Conectado')).toBeVisible();
      
      // Should show account details
      await expect(page.getByText('Test Account 1')).toBeVisible();
      await expect(page.getByText('1234567890')).toBeVisible();
      
      // Should show last sync time
      await expect(page.getByTestId('last-sync-time')).toBeVisible();
      
      // Should show connection actions
      await expect(page.getByTestId('connection-settings')).toBeVisible();
    });

    test('should allow disconnecting account', async () => {
      await page.goto('/dashboard/google');
      
      // Open connection settings
      await page.click('[data-testid="connection-settings"]');
      await expect(page.getByTestId('connection-menu')).toBeVisible();
      
      // Click disconnect option
      await page.click('[data-testid="disconnect-account"]');
      
      // Should show confirmation dialog
      await expect(page.getByTestId('disconnect-dialog')).toBeVisible();
      await expect(page.getByText('Desconectar conta Google Ads?')).toBeVisible();
      
      // Confirm disconnection
      await page.click('[data-testid="confirm-disconnect"]');
      
      // Should show success message
      await expect(page.getByText('Conta desconectada com sucesso')).toBeVisible();
      
      // Should return to connection prompt
      await expect(page.getByTestId('connect-google-ads')).toBeVisible();
      await expect(page.getByTestId('connection-status-active')).not.toBeVisible();
    });

    test('should handle reconnection for expired tokens', async () => {
      // Mock expired token scenario
      await page.route('**/api/google/campaigns**', route => {
        route.fulfill({
          status: 401,
          body: JSON.stringify({
            error: 'Token expired',
            code: 'AUTHENTICATION_ERROR',
          }),
        });
      });

      await page.goto('/dashboard/google');
      
      // Should show token expired warning
      await expect(page.getByText('Token expirado')).toBeVisible();
      await expect(page.getByTestId('reconnect-button')).toBeVisible();
      
      // Click reconnect
      await page.click('[data-testid="reconnect-button"]');
      
      // Should start OAuth flow again
      await page.waitForURL(/.*accounts\.google\.com.*/);
      await expect(page.getByText('Google OAuth Authorization')).toBeVisible();
    });

    test('should show multiple connected accounts', async () => {
      // Mock multiple accounts response
      await page.route('**/api/google/accounts**', route => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            accounts: [
              {
                customerId: '1234567890',
                descriptiveName: 'Test Account 1',
                currencyCode: 'USD',
                connected: true,
              },
              {
                customerId: '0987654321',
                descriptiveName: 'Test Account 2',
                currencyCode: 'EUR',
                connected: false,
              },
            ],
          }),
        });
      });

      await page.goto('/dashboard/google');
      
      // Should show connected accounts section
      await expect(page.getByTestId('connected-accounts')).toBeVisible();
      
      // Should show first account as connected
      await expect(page.getByText('Test Account 1')).toBeVisible();
      await expect(page.getByTestId('account-status-1234567890-connected')).toBeVisible();
      
      // Should show second account as available to connect
      await expect(page.getByText('Test Account 2')).toBeVisible();
      await expect(page.getByTestId('connect-account-0987654321')).toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test('should handle network errors during connection', async () => {
      // Mock network failure
      await page.route('**/api/google/auth**', route => {
        route.abort('failed');
      });

      await page.goto('/dashboard/google');
      
      // Try to connect
      await page.click('[data-testid="connect-google-ads"]');
      
      // Should show network error
      await expect(page.getByText('Erro de conexão')).toBeVisible();
      await expect(page.getByText('Verifique sua conexão com a internet')).toBeVisible();
      
      // Should show retry button
      await expect(page.getByTestId('retry-connection')).toBeVisible();
    });

    test('should handle API errors gracefully', async () => {
      // Mock API error
      await page.route('**/api/google/**', route => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({
            error: 'Internal server error',
          }),
        });
      });

      await page.goto('/dashboard/google');
      
      // Try to connect
      await page.click('[data-testid="connect-google-ads"]');
      
      // Should show API error
      await expect(page.getByText('Erro interno do servidor')).toBeVisible();
      await expect(page.getByText('Tente novamente em alguns minutos')).toBeVisible();
    });

    test('should handle invalid Google Ads accounts', async () => {
      // Mock invalid account response
      await page.route('**/googleads.googleapis.com/**', route => {
        route.fulfill({
          status: 403,
          body: JSON.stringify({
            error: {
              code: 403,
              message: 'The caller does not have permission',
            },
          }),
        });
      });

      // Complete OAuth flow
      await completeOAuthFlow(page);
      
      // Should show permission error
      await expect(page.getByText('Sem permissão para acessar esta conta')).toBeVisible();
      await expect(page.getByText('Verifique se você tem acesso à conta Google Ads')).toBeVisible();
      
      // Should provide help link
      await expect(page.getByTestId('help-link')).toBeVisible();
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test('should work on mobile devices', async () => {
      await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
      
      await page.goto('/dashboard/google');
      
      // Should show mobile-optimized layout
      await expect(page.getByTestId('mobile-menu-toggle')).toBeVisible();
      
      // Connection button should be visible and accessible
      await expect(page.getByTestId('connect-google-ads')).toBeVisible();
      
      // Click connect button
      await page.click('[data-testid="connect-google-ads"]');
      
      // OAuth flow should work on mobile
      await page.waitForURL(/.*accounts\.google\.com.*/);
      await expect(page.getByText('Google OAuth Authorization')).toBeVisible();
    });

    test('should handle account selection on mobile', async () => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Complete OAuth flow to account selection
      await completeOAuthFlow(page);
      
      // Account selection should be mobile-friendly
      await expect(page.getByTestId('mobile-account-list')).toBeVisible();
      
      // Account cards should stack vertically
      const accountCards = page.getByTestId('account-card');
      const firstCard = accountCards.first();
      const secondCard = accountCards.nth(1);
      
      if (await secondCard.isVisible()) {
        const firstCardBox = await firstCard.boundingBox();
        const secondCardBox = await secondCard.boundingBox();
        
        // Second card should be below first card
        expect(secondCardBox!.y).toBeGreaterThan(firstCardBox!.y + firstCardBox!.height);
      }
    });
  });

  test.describe('Accessibility', () => {
    test('should be keyboard navigable', async () => {
      await page.goto('/dashboard/google');
      
      // Tab to connect button
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // Connect button should be focused
      await expect(page.getByTestId('connect-google-ads')).toBeFocused();
      
      // Press Enter to activate
      await page.keyboard.press('Enter');
      
      // Should start OAuth flow
      await page.waitForURL(/.*accounts\.google\.com.*/);
    });

    test('should have proper ARIA labels', async () => {
      await page.goto('/dashboard/google');
      
      // Check ARIA labels
      await expect(page.getByTestId('connect-google-ads')).toHaveAttribute('aria-label', 'Conectar conta Google Ads');
      
      // After connection
      await connectGoogleAdsAccount(page);
      await page.goto('/dashboard/google');
      
      await expect(page.getByTestId('connection-status-active')).toHaveAttribute('aria-label', 'Conta Google Ads conectada');
      await expect(page.getByTestId('connection-settings')).toHaveAttribute('aria-label', 'Configurações da conexão');
    });

    test('should support screen readers', async () => {
      await page.goto('/dashboard/google');
      
      // Check for screen reader content
      await expect(page.getByText('Conectar sua conta Google Ads para começar')).toBeVisible();
      
      // Status should be announced
      await connectGoogleAdsAccount(page);
      await page.goto('/dashboard/google');
      
      await expect(page.getByTestId('sr-connection-status')).toHaveText('Conta Google Ads conectada com sucesso');
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

async function completeOAuthFlow(page: Page) {
  await page.goto('/dashboard/google');
  await page.click('[data-testid="connect-google-ads"]');
  await page.waitForURL(/.*accounts\.google\.com.*/);
  await page.click('[data-testid="authorize-button"]');
  await page.waitForURL(/.*google\/select-accounts.*/);
}

async function connectGoogleAdsAccount(page: Page) {
  // Mock the connection in localStorage for subsequent tests
  await page.evaluate(() => {
    localStorage.setItem('google-ads-connected', 'true');
    localStorage.setItem('google-ads-customer-id', '1234567890');
    localStorage.setItem('google-ads-account-name', 'Test Account 1');
  });
  
  // Mock API responses for connected state
  await page.route('**/api/google/connections**', route => {
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        connections: [
          {
            id: 'connection-123',
            customerId: '1234567890',
            descriptiveName: 'Test Account 1',
            status: 'active',
            lastSyncAt: new Date().toISOString(),
          },
        ],
      }),
    });
  });
}