import { test, expect } from '@playwright/test';

/**
 * Testes End-to-End completos do fluxo de checkout
 * Cobre todos os cenários de pagamento e recovery flows
 * Requirements: 1.1-1.5, 2.1-2.5
 */

test.describe('Fluxo Completo de Checkout', () => {
  test.beforeEach(async ({ page }) => {
    // Setup inicial - navegar para página de checkout
    await page.goto('/checkout');
  });

  test('deve completar checkout com sucesso - plano mensal', async ({ page }) => {
    // Preencher dados do cliente
    await page.fill('[data-testid="user-name"]', 'João Silva');
    await page.fill('[data-testid="user-email"]', 'joao@exemplo.com');
    await page.fill('[data-testid="organization-name"]', 'Empresa Teste');
    await page.fill('[data-testid="cpf-cnpj"]', '12345678901');
    await page.fill('[data-testid="phone"]', '11999999999');

    // Selecionar plano mensal
    await page.click('[data-testid="plan-monthly"]');

    // Verificar preview do plano
    await expect(page.locator('[data-testid="plan-preview"]')).toContainText('Plano Mensal');
    await expect(page.locator('[data-testid="price-preview"]')).toBeVisible();

    // Submeter checkout
    await page.click('[data-testid="submit-checkout"]');

    // Verificar redirecionamento para página de status
    await expect(page).toHaveURL(/\/checkout\/status\/.+/);
    
    // Verificar elementos da página de status
    await expect(page.locator('[data-testid="payment-status"]')).toContainText('Processando');
    await expect(page.locator('[data-testid="intent-id"]')).toBeVisible();
    await expect(page.locator('[data-testid="customer-info"]')).toContainText('João Silva');
  });

  test('deve completar checkout com sucesso - plano anual', async ({ page }) => {
    // Preencher dados do cliente
    await page.fill('[data-testid="user-name"]', 'Maria Santos');
    await page.fill('[data-testid="user-email"]', 'maria@exemplo.com');
    await page.fill('[data-testid="organization-name"]', 'Startup XYZ');
    await page.fill('[data-testid="cpf-cnpj"]', '98765432100');

    // Selecionar plano anual
    await page.click('[data-testid="plan-annual"]');

    // Verificar desconto anual
    await expect(page.locator('[data-testid="discount-badge"]')).toContainText('20% OFF');

    // Submeter checkout
    await page.click('[data-testid="submit-checkout"]');

    // Verificar criação do subscription intent
    await expect(page).toHaveURL(/\/checkout\/status\/.+/);
    await expect(page.locator('[data-testid="payment-status"]')).toContainText('Processando');
  });

  test('deve validar campos obrigatórios', async ({ page }) => {
    // Tentar submeter sem preencher campos
    await page.click('[data-testid="submit-checkout"]');

    // Verificar mensagens de erro
    await expect(page.locator('[data-testid="error-name"]')).toContainText('Nome é obrigatório');
    await expect(page.locator('[data-testid="error-email"]')).toContainText('Email é obrigatório');
    await expect(page.locator('[data-testid="error-organization"]')).toContainText('Nome da organização é obrigatório');

    // Preencher email inválido
    await page.fill('[data-testid="user-email"]', 'email-invalido');
    await page.blur('[data-testid="user-email"]');
    
    await expect(page.locator('[data-testid="error-email"]')).toContainText('Email inválido');
  });

  test('deve exibir loading states durante processamento', async ({ page }) => {
    // Preencher dados válidos
    await page.fill('[data-testid="user-name"]', 'Teste Loading');
    await page.fill('[data-testid="user-email"]', 'loading@teste.com');
    await page.fill('[data-testid="organization-name"]', 'Empresa Loading');
    await page.click('[data-testid="plan-monthly"]');

    // Verificar estado inicial do botão
    const submitButton = page.locator('[data-testid="submit-checkout"]');
    await expect(submitButton).toBeEnabled();
    await expect(submitButton).toContainText('Finalizar Checkout');

    // Submeter e verificar loading state
    await submitButton.click();
    
    // Verificar loading state (pode ser rápido, então usamos waitFor)
    await page.waitForSelector('[data-testid="loading-spinner"]', { timeout: 5000 });
    await expect(submitButton).toBeDisabled();
  });

  test('deve calcular preços corretamente', async ({ page }) => {
    // Selecionar plano mensal
    await page.click('[data-testid="plan-monthly"]');
    
    // Verificar preço mensal
    const monthlyPrice = await page.locator('[data-testid="price-display"]').textContent();
    expect(monthlyPrice).toMatch(/R\$\s*\d+,\d{2}/);

    // Mudar para plano anual
    await page.click('[data-testid="plan-annual"]');
    
    // Verificar preço anual com desconto
    const annualPrice = await page.locator('[data-testid="price-display"]').textContent();
    expect(annualPrice).toMatch(/R\$\s*\d+,\d{2}/);
    
    // Verificar que o preço anual é diferente do mensal
    expect(annualPrice).not.toBe(monthlyPrice);
  });
});

test.describe('Cenários de Erro e Recovery', () => {
  test('deve lidar com erro de API durante checkout', async ({ page }) => {
    // Mock de erro de API
    await page.route('/api/subscriptions/checkout-iugu', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Erro interno do servidor' })
      });
    });

    // Preencher dados e submeter
    await page.fill('[data-testid="user-name"]', 'Teste Erro');
    await page.fill('[data-testid="user-email"]', 'erro@teste.com');
    await page.fill('[data-testid="organization-name"]', 'Empresa Erro');
    await page.click('[data-testid="plan-monthly"]');
    await page.click('[data-testid="submit-checkout"]');

    // Verificar mensagem de erro
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Erro interno do servidor');
    
    // Verificar que o botão volta ao estado normal
    await expect(page.locator('[data-testid="submit-checkout"]')).toBeEnabled();
    await expect(page.locator('[data-testid="submit-checkout"]')).toContainText('Tentar Novamente');
  });

  test('deve permitir nova tentativa após erro', async ({ page }) => {
    let requestCount = 0;
    
    // Mock que falha na primeira tentativa e sucede na segunda
    await page.route('/api/subscriptions/checkout-iugu', route => {
      requestCount++;
      if (requestCount === 1) {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Erro temporário' })
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            intent_id: 'test-intent-123',
            checkout_url: 'https://iugu.com/checkout/test',
            status_url: '/checkout/status/test-intent-123'
          })
        });
      }
    });

    // Preencher dados
    await page.fill('[data-testid="user-name"]', 'Teste Retry');
    await page.fill('[data-testid="user-email"]', 'retry@teste.com');
    await page.fill('[data-testid="organization-name"]', 'Empresa Retry');
    await page.click('[data-testid="plan-monthly"]');

    // Primeira tentativa (falha)
    await page.click('[data-testid="submit-checkout"]');
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Erro temporário');

    // Segunda tentativa (sucesso)
    await page.click('[data-testid="submit-checkout"]');
    await expect(page).toHaveURL(/\/checkout\/status\/.+/);
  });

  test('deve validar timeout de requisição', async ({ page }) => {
    // Mock que demora muito para responder
    await page.route('/api/subscriptions/checkout-iugu', route => {
      // Não responder para simular timeout
      setTimeout(() => {
        route.fulfill({
          status: 408,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Timeout da requisição' })
        });
      }, 10000);
    });

    // Preencher dados e submeter
    await page.fill('[data-testid="user-name"]', 'Teste Timeout');
    await page.fill('[data-testid="user-email"]', 'timeout@teste.com');
    await page.fill('[data-testid="organization-name"]', 'Empresa Timeout');
    await page.click('[data-testid="plan-monthly"]');
    await page.click('[data-testid="submit-checkout"]');

    // Verificar que aparece mensagem de timeout
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Timeout', { timeout: 15000 });
  });
});

test.describe('Diferentes Cenários de Pagamento', () => {
  test('deve lidar com pagamento via PIX', async ({ page }) => {
    // Mock para retornar opção PIX
    await page.route('/api/subscriptions/checkout-iugu', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          intent_id: 'pix-intent-123',
          checkout_url: 'https://iugu.com/checkout/pix',
          status_url: '/checkout/status/pix-intent-123',
          payment_method: 'pix'
        })
      });
    });

    // Preencher dados
    await page.fill('[data-testid="user-name"]', 'Cliente PIX');
    await page.fill('[data-testid="user-email"]', 'pix@teste.com');
    await page.fill('[data-testid="organization-name"]', 'Empresa PIX');
    await page.click('[data-testid="plan-monthly"]');

    // Selecionar PIX como método de pagamento
    await page.click('[data-testid="payment-method-pix"]');
    await page.click('[data-testid="submit-checkout"]');

    // Verificar redirecionamento e informações PIX
    await expect(page).toHaveURL(/\/checkout\/status\/.+/);
    await expect(page.locator('[data-testid="payment-method"]')).toContainText('PIX');
  });

  test('deve lidar com pagamento via cartão de crédito', async ({ page }) => {
    // Mock para retornar opção cartão
    await page.route('/api/subscriptions/checkout-iugu', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          intent_id: 'card-intent-123',
          checkout_url: 'https://iugu.com/checkout/card',
          status_url: '/checkout/status/card-intent-123',
          payment_method: 'credit_card'
        })
      });
    });

    // Preencher dados
    await page.fill('[data-testid="user-name"]', 'Cliente Cartão');
    await page.fill('[data-testid="user-email"]', 'cartao@teste.com');
    await page.fill('[data-testid="organization-name"]', 'Empresa Cartão');
    await page.click('[data-testid="plan-monthly"]');

    // Selecionar cartão como método de pagamento
    await page.click('[data-testid="payment-method-card"]');
    await page.click('[data-testid="submit-checkout"]');

    // Verificar redirecionamento
    await expect(page).toHaveURL(/\/checkout\/status\/.+/);
    await expect(page.locator('[data-testid="payment-method"]')).toContainText('Cartão');
  });

  test('deve lidar com pagamento via boleto', async ({ page }) => {
    // Mock para retornar opção boleto
    await page.route('/api/subscriptions/checkout-iugu', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          intent_id: 'boleto-intent-123',
          checkout_url: 'https://iugu.com/checkout/boleto',
          status_url: '/checkout/status/boleto-intent-123',
          payment_method: 'bank_slip'
        })
      });
    });

    // Preencher dados
    await page.fill('[data-testid="user-name"]', 'Cliente Boleto');
    await page.fill('[data-testid="user-email"]', 'boleto@teste.com');
    await page.fill('[data-testid="organization-name"]', 'Empresa Boleto');
    await page.click('[data-testid="plan-monthly"]');

    // Selecionar boleto como método de pagamento
    await page.click('[data-testid="payment-method-boleto"]');
    await page.click('[data-testid="submit-checkout"]');

    // Verificar redirecionamento
    await expect(page).toHaveURL(/\/checkout\/status\/.+/);
    await expect(page.locator('[data-testid="payment-method"]')).toContainText('Boleto');
  });
});

test.describe('Responsividade e Acessibilidade', () => {
  test('deve funcionar em dispositivos móveis', async ({ page }) => {
    // Simular viewport mobile
    await page.setViewportSize({ width: 375, height: 667 });

    // Verificar que elementos são visíveis e clicáveis
    await expect(page.locator('[data-testid="user-name"]')).toBeVisible();
    await expect(page.locator('[data-testid="plan-selector"]')).toBeVisible();
    
    // Preencher formulário em mobile
    await page.fill('[data-testid="user-name"]', 'Mobile User');
    await page.fill('[data-testid="user-email"]', 'mobile@teste.com');
    await page.fill('[data-testid="organization-name"]', 'Mobile Org');
    
    // Verificar que botões são clicáveis
    await page.click('[data-testid="plan-monthly"]');
    await expect(page.locator('[data-testid="submit-checkout"]')).toBeVisible();
  });

  test('deve ter navegação por teclado funcional', async ({ page }) => {
    // Navegar usando Tab
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="user-name"]')).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="user-email"]')).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="organization-name"]')).toBeFocused();
  });

  test('deve ter labels e aria-labels apropriados', async ({ page }) => {
    // Verificar labels dos campos
    await expect(page.locator('label[for="user-name"]')).toContainText('Nome');
    await expect(page.locator('label[for="user-email"]')).toContainText('Email');
    
    // Verificar aria-labels
    await expect(page.locator('[data-testid="submit-checkout"]')).toHaveAttribute('aria-label');
    await expect(page.locator('[data-testid="plan-selector"]')).toHaveAttribute('role', 'radiogroup');
  });
});
