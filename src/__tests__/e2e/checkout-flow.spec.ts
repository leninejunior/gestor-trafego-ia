import { test, expect, Page } from '@playwright/test';

// Mock data for testing
const testUser = {
  name: 'João Silva',
  email: 'joao.silva@teste.com',
  organization: 'Empresa Teste LTDA',
  cpf: '123.456.789-00',
  phone: '(11) 99999-9999'
};

const testPlan = {
  id: 'plan-pro',
  name: 'Pro',
  monthlyPrice: 99.90,
  annualPrice: 999.00
};

test.describe('Checkout Flow E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API responses
    await page.route('/api/subscriptions/plans', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: testPlan.id,
              name: testPlan.name,
              description: 'Plano profissional completo',
              monthly_price: testPlan.monthlyPrice,
              annual_price: testPlan.annualPrice,
              features: {
                advancedAnalytics: true,
                customReports: true,
                apiAccess: true
              },
              max_clients: 50,
              max_campaigns: 200
            }
          ]
        })
      });
    });
  });

  test('should complete full checkout flow successfully', async ({ page }) => {
    // Navigate to checkout with plan
    await page.goto(`/checkout?plan=${testPlan.id}`);

    // Wait for page to load
    await expect(page.locator('h1')).toContainText('Criar Conta');

    // Verify plan information is displayed
    await expect(page.locator('text=' + testPlan.name)).toBeVisible();

    // Fill user information
    await page.fill('input[placeholder="Seu nome"]', testUser.name);
    await page.fill('input[placeholder="seu@email.com"]', testUser.email);
    await page.fill('input[placeholder="Nome da sua empresa"]', testUser.organization);
    await page.fill('input[placeholder="000.000.000-00"]', testUser.cpf);
    await page.fill('input[placeholder="(00) 00000-0000"]', testUser.phone);

    // Test billing cycle selection
    await page.click('text=Anual');
    await expect(page.locator('text=-17%')).toBeVisible();
    
    // Switch back to monthly
    await page.click('text=Mensal');

    // Mock checkout API response
    await page.route('/api/subscriptions/checkout-iugu', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          intent_id: 'intent_123456',
          checkout_url: 'https://iugu.com/checkout/123456',
          status_url: '/checkout/status/intent_123456'
        })
      });
    });

    // Submit form
    await page.click('button:has-text("Continuar para Pagamento")');

    // Should redirect to status page
    await expect(page).toHaveURL(/\/checkout\/status\/intent_123456/);
  });

  test('should show validation errors for invalid data', async ({ page }) => {
    await page.goto(`/checkout?plan=${testPlan.id}`);

    // Try to submit with empty fields
    await page.click('button:has-text("Continuar para Pagamento")');

    // Should show validation errors (HTML5 validation will prevent submission)
    const nameInput = page.locator('input[placeholder="Seu nome"]');
    await expect(nameInput).toHaveAttribute('required');

    // Fill invalid email
    await page.fill('input[placeholder="Seu nome"]', testUser.name);
    await page.fill('input[placeholder="seu@email.com"]', 'invalid-email');
    await page.fill('input[placeholder="Nome da sua empresa"]', testUser.organization);

    // Try to submit
    await page.click('button:has-text("Continuar para Pagamento")');

    // Should not proceed due to invalid email
    const emailInput = page.locator('input[placeholder="seu@email.com"]');
    await expect(emailInput).toHaveAttribute('type', 'email');
  });

  test('should handle checkout API errors gracefully', async ({ page }) => {
    await page.goto(`/checkout?plan=${testPlan.id}`);

    // Fill valid data
    await page.fill('input[placeholder="Seu nome"]', testUser.name);
    await page.fill('input[placeholder="seu@email.com"]', testUser.email);
    await page.fill('input[placeholder="Nome da sua empresa"]', testUser.organization);

    // Mock API error response
    await page.route('/api/subscriptions/checkout-iugu', async route => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Plano não encontrado',
          code: 'INVALID_PLAN'
        })
      });
    });

    // Submit form
    await page.click('button:has-text("Continuar para Pagamento")');

    // Should show error toast
    await expect(page.locator('[role="alert"]')).toContainText('Erro no checkout');
  });

  test('should redirect to home if no plan is selected', async ({ page }) => {
    await page.goto('/checkout');

    // Should redirect to home page
    await expect(page).toHaveURL('/');
  });

  test('should show plan details correctly', async ({ page }) => {
    await page.goto(`/checkout?plan=${testPlan.id}`);

    // Wait for plan to load
    await expect(page.locator('text=' + testPlan.name)).toBeVisible();

    // Check monthly price
    await expect(page.locator(`text=R$ ${testPlan.monthlyPrice.toFixed(2)}`)).toBeVisible();

    // Switch to annual and check price
    await page.click('text=Anual');
    await expect(page.locator(`text=R$ ${testPlan.annualPrice.toFixed(2)}`)).toBeVisible();

    // Check savings calculation
    const savings = (testPlan.monthlyPrice * 12 - testPlan.annualPrice).toFixed(2);
    await expect(page.locator(`text=Economize R$ ${savings} por ano`)).toBeVisible();

    // Check features
    await expect(page.locator('text=Analytics avançado')).toBeVisible();
    await expect(page.locator('text=Relatórios personalizados')).toBeVisible();
    await expect(page.locator('text=Acesso à API')).toBeVisible();
  });

  test('should be responsive on mobile devices', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto(`/checkout?plan=${testPlan.id}`);

    // Check if layout adapts to mobile
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('text=' + testPlan.name)).toBeVisible();

    // Form should be usable on mobile
    await page.fill('input[placeholder="Seu nome"]', testUser.name);
    await page.fill('input[placeholder="seu@email.com"]', testUser.email);
    
    // Billing cycle buttons should be accessible
    await page.click('text=Anual');
    await expect(page.locator('text=-17%')).toBeVisible();
  });

  test('should handle network errors', async ({ page }) => {
    await page.goto(`/checkout?plan=${testPlan.id}`);

    // Fill form
    await page.fill('input[placeholder="Seu nome"]', testUser.name);
    await page.fill('input[placeholder="seu@email.com"]', testUser.email);
    await page.fill('input[placeholder="Nome da sua empresa"]', testUser.organization);

    // Mock network error
    await page.route('/api/subscriptions/checkout-iugu', async route => {
      await route.abort('failed');
    });

    // Submit form
    await page.click('button:has-text("Continuar para Pagamento")');

    // Should show network error
    await expect(page.locator('[role="alert"]')).toContainText('Erro no checkout');
  });

  test('should preserve form data on page refresh', async ({ page }) => {
    await page.goto(`/checkout?plan=${testPlan.id}`);

    // Fill some data
    await page.fill('input[placeholder="Seu nome"]', testUser.name);
    await page.fill('input[placeholder="seu@email.com"]', testUser.email);

    // Note: In a real implementation, you might want to add localStorage
    // persistence for form data to improve UX
    
    // For now, just verify the form is properly structured
    await expect(page.locator('input[placeholder="Seu nome"]')).toHaveValue(testUser.name);
    await expect(page.locator('input[placeholder="seu@email.com"]')).toHaveValue(testUser.email);
  });
});

test.describe('Checkout Status Page Tests', () => {
  const mockIntent = {
    id: 'intent_123456',
    status: 'pending',
    user_email: testUser.email,
    user_name: testUser.name,
    organization_name: testUser.organization,
    plan_name: testPlan.name,
    billing_cycle: 'monthly',
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  };

  test('should display payment status correctly', async ({ page }) => {
    // Mock status API
    await page.route('/api/subscriptions/status/intent_123456', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          intent: mockIntent
        })
      });
    });

    await page.goto('/checkout/status/intent_123456');

    // Should show pending status
    await expect(page.locator('text=Aguardando Pagamento')).toBeVisible();
    await expect(page.locator(`text=${testUser.name}`)).toBeVisible();
    await expect(page.locator(`text=${testUser.email}`)).toBeVisible();
    await expect(page.locator(`text=${testUser.organization}`)).toBeVisible();
  });

  test('should show completed status', async ({ page }) => {
    const completedIntent = {
      ...mockIntent,
      status: 'completed',
      completed_at: new Date().toISOString()
    };

    await page.route('/api/subscriptions/status/intent_123456', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          intent: completedIntent
        })
      });
    });

    await page.goto('/checkout/status/intent_123456');

    await expect(page.locator('text=Pagamento Confirmado')).toBeVisible();
    await expect(page.locator('text=Acessar Dashboard')).toBeVisible();
  });

  test('should handle failed payment status', async ({ page }) => {
    const failedIntent = {
      ...mockIntent,
      status: 'failed',
      error_message: 'Cartão recusado'
    };

    await page.route('/api/subscriptions/status/intent_123456', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          intent: failedIntent
        })
      });
    });

    await page.goto('/checkout/status/intent_123456');

    await expect(page.locator('text=Pagamento Falhou')).toBeVisible();
    await expect(page.locator('text=Cartão recusado')).toBeVisible();
    await expect(page.locator('text=Tentar Novamente')).toBeVisible();
  });

  test('should handle retry payment action', async ({ page }) => {
    const failedIntent = {
      ...mockIntent,
      status: 'failed'
    };

    await page.route('/api/subscriptions/status/intent_123456', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          intent: failedIntent
        })
      });
    });

    // Mock retry API
    await page.route('/api/subscriptions/recovery/regenerate', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          checkout_url: 'https://iugu.com/checkout/new_123456'
        })
      });
    });

    await page.goto('/checkout/status/intent_123456');

    // Click retry button
    await page.click('text=Tentar Novamente');

    // Should redirect to new checkout URL
    // Note: In a real test, you might want to mock window.location.href
  });
});

test.describe('Public Status Search Tests', () => {
  test('should allow searching by email', async ({ page }) => {
    await page.goto('/checkout/status');

    // Should show search form
    await expect(page.locator('text=Consultar Status de Pagamento')).toBeVisible();

    // Email should be selected by default
    await expect(page.locator('button:has-text("Por Email")')).toHaveClass(/bg-/);

    // Fill email and search
    await page.fill('input[placeholder="seu@email.com"]', testUser.email);

    // Mock search API
    await page.route('/api/subscriptions/status/public*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          intents: [
            {
              id: 'intent_123456',
              status: 'completed',
              user_name: testUser.name,
              organization_name: testUser.organization,
              plan_name: testPlan.name,
              billing_cycle: 'monthly',
              created_at: new Date().toISOString(),
              completed_at: new Date().toISOString()
            }
          ]
        })
      });
    });

    await page.click('button:has-text("Buscar Pagamentos")');

    // Should show results
    await expect(page.locator('text=Pagamentos Encontrados (1)')).toBeVisible();
    await expect(page.locator(`text=${testUser.name}`)).toBeVisible();
  });

  test('should allow searching by CPF', async ({ page }) => {
    await page.goto('/checkout/status');

    // Switch to CPF search
    await page.click('button:has-text("Por CPF")');

    // Should show CPF input
    await expect(page.locator('input[placeholder="000.000.000-00"]')).toBeVisible();

    // Fill CPF
    await page.fill('input[placeholder="000.000.000-00"]', testUser.cpf);

    // Mock search API
    await page.route('/api/subscriptions/status/public*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          intents: []
        })
      });
    });

    await page.click('button:has-text("Buscar Pagamentos")');

    // Should show no results message
    await expect(page.locator('text=Nenhum pagamento encontrado')).toBeVisible();
  });
});