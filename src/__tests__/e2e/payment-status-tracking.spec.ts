import { test, expect } from '@playwright/test';

/**
 * Testes E2E para acompanhamento de status de pagamento
 * Testa página de status, updates em tempo real e recovery flows
 * Requirements: 2.5, 5.1, 5.2
 */

test.describe('Acompanhamento de Status de Pagamento', () => {
  test.beforeEach(async ({ page }) => {
    // Mock do subscription intent para testes
    await page.route('/api/subscriptions/status/*', route => {
      const url = route.request().url();
      const intentId = url.split('/').pop();
      
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          intent_id: intentId,
          status: 'pending',
          user_name: 'João Silva',
          user_email: 'joao@exemplo.com',
          organization_name: 'Empresa Teste',
          plan_name: 'Plano Pro',
          billing_cycle: 'monthly',
          amount: 99.90,
          payment_method: 'credit_card',
          checkout_url: 'https://iugu.com/checkout/test',
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        })
      });
    });
  });

  test('deve exibir informações completas do pagamento pendente', async ({ page }) => {
    await page.goto('/checkout/status/test-intent-123');

    // Verificar informações do cliente
    await expect(page.locator('[data-testid="customer-name"]')).toContainText('João Silva');
    await expect(page.locator('[data-testid="customer-email"]')).toContainText('joao@exemplo.com');
    await expect(page.locator('[data-testid="organization-name"]')).toContainText('Empresa Teste');

    // Verificar informações do plano
    await expect(page.locator('[data-testid="plan-name"]')).toContainText('Plano Pro');
    await expect(page.locator('[data-testid="billing-cycle"]')).toContainText('Mensal');
    await expect(page.locator('[data-testid="amount"]')).toContainText('R$ 99,90');

    // Verificar status
    await expect(page.locator('[data-testid="payment-status"]')).toContainText('Aguardando Pagamento');
    await expect(page.locator('[data-testid="status-badge"]')).toHaveClass(/pending/);
  });

  test('deve exibir botão de pagamento quando pendente', async ({ page }) => {
    await page.goto('/checkout/status/test-intent-123');

    // Verificar botão de pagamento
    const paymentButton = page.locator('[data-testid="payment-button"]');
    await expect(paymentButton).toBeVisible();
    await expect(paymentButton).toContainText('Efetuar Pagamento');
    await expect(paymentButton).toHaveAttribute('href', 'https://iugu.com/checkout/test');
  });

  test('deve atualizar status automaticamente via polling', async ({ page }) => {
    let requestCount = 0;
    
    // Mock que muda status após algumas requisições
    await page.route('/api/subscriptions/status/test-intent-123', route => {
      requestCount++;
      const status = requestCount < 3 ? 'pending' : 'completed';
      
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          intent_id: 'test-intent-123',
          status: status,
          user_name: 'João Silva',
          user_email: 'joao@exemplo.com',
          organization_name: 'Empresa Teste',
          plan_name: 'Plano Pro',
          billing_cycle: 'monthly',
          amount: 99.90,
          payment_method: 'credit_card',
          completed_at: status === 'completed' ? new Date().toISOString() : null
        })
      });
    });

    await page.goto('/checkout/status/test-intent-123');

    // Verificar status inicial
    await expect(page.locator('[data-testid="payment-status"]')).toContainText('Aguardando');

    // Aguardar polling atualizar status
    await expect(page.locator('[data-testid="payment-status"]')).toContainText('Concluído', { timeout: 10000 });
    await expect(page.locator('[data-testid="status-badge"]')).toHaveClass(/completed/);
  });

  test('deve exibir informações de acesso quando pagamento confirmado', async ({ page }) => {
    // Mock com status completed
    await page.route('/api/subscriptions/status/completed-intent', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          intent_id: 'completed-intent',
          status: 'completed',
          user_name: 'Maria Santos',
          user_email: 'maria@exemplo.com',
          organization_name: 'Startup XYZ',
          plan_name: 'Plano Pro',
          billing_cycle: 'annual',
          amount: 959.20,
          payment_method: 'pix',
          completed_at: new Date().toISOString(),
          access_info: {
            login_url: 'https://app.exemplo.com/login',
            temporary_password: 'temp123456'
          }
        })
      });
    });

    await page.goto('/checkout/status/completed-intent');

    // Verificar status concluído
    await expect(page.locator('[data-testid="payment-status"]')).toContainText('Pagamento Confirmado');
    await expect(page.locator('[data-testid="status-badge"]')).toHaveClass(/completed/);

    // Verificar informações de acesso
    await expect(page.locator('[data-testid="access-info"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-url"]')).toContainText('app.exemplo.com/login');
    await expect(page.locator('[data-testid="access-button"]')).toContainText('Acessar Sistema');
  });

  test('deve lidar com pagamento expirado', async ({ page }) => {
    // Mock com status expired
    await page.route('/api/subscriptions/status/expired-intent', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          intent_id: 'expired-intent',
          status: 'expired',
          user_name: 'Carlos Oliveira',
          user_email: 'carlos@exemplo.com',
          organization_name: 'Empresa Expirada',
          plan_name: 'Plano Basic',
          billing_cycle: 'monthly',
          amount: 49.90,
          payment_method: 'bank_slip',
          expires_at: new Date(Date.now() - 60 * 60 * 1000).toISOString() // 1 hora atrás
        })
      });
    });

    await page.goto('/checkout/status/expired-intent');

    // Verificar status expirado
    await expect(page.locator('[data-testid="payment-status"]')).toContainText('Expirado');
    await expect(page.locator('[data-testid="status-badge"]')).toHaveClass(/expired/);

    // Verificar opções de recovery
    await expect(page.locator('[data-testid="expired-message"]')).toContainText('prazo de pagamento expirou');
    await expect(page.locator('[data-testid="regenerate-button"]')).toContainText('Gerar Nova Cobrança');
  });

  test('deve permitir gerar nova cobrança para intent expirado', async ({ page }) => {
    // Mock para intent expirado
    await page.route('/api/subscriptions/status/expired-intent', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          intent_id: 'expired-intent',
          status: 'expired',
          user_name: 'Carlos Oliveira',
          user_email: 'carlos@exemplo.com',
          organization_name: 'Empresa Expirada',
          plan_name: 'Plano Basic',
          billing_cycle: 'monthly',
          amount: 49.90
        })
      });
    });

    // Mock para regenerar cobrança
    await page.route('/api/subscriptions/recovery/regenerate', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          new_intent_id: 'new-intent-456',
          checkout_url: 'https://iugu.com/checkout/new',
          status_url: '/checkout/status/new-intent-456'
        })
      });
    });

    await page.goto('/checkout/status/expired-intent');

    // Clicar em gerar nova cobrança
    await page.click('[data-testid="regenerate-button"]');

    // Verificar loading state
    await expect(page.locator('[data-testid="regenerate-button"]')).toBeDisabled();
    await expect(page.locator('[data-testid="regenerate-button"]')).toContainText('Gerando...');

    // Verificar redirecionamento para nova cobrança
    await expect(page).toHaveURL('/checkout/status/new-intent-456');
  });
});

test.describe('WebSocket Updates em Tempo Real', () => {
  test('deve conectar ao WebSocket para updates', async ({ page }) => {
    // Mock WebSocket connection
    await page.addInitScript(() => {
      class MockWebSocket {
        constructor(url) {
          this.url = url;
          this.readyState = 1; // OPEN
          setTimeout(() => {
            if (this.onopen) this.onopen();
          }, 100);
        }
        
        send(data) {
          // Simular resposta do servidor
          setTimeout(() => {
            if (this.onmessage) {
              this.onmessage({
                data: JSON.stringify({
                  type: 'status_update',
                  intent_id: 'test-intent-123',
                  status: 'completed'
                })
              });
            }
          }, 1000);
        }
        
        close() {
          this.readyState = 3; // CLOSED
        }
      }
      
      window.WebSocket = MockWebSocket;
    });

    await page.goto('/checkout/status/test-intent-123');

    // Verificar conexão WebSocket
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('Conectado');

    // Aguardar update via WebSocket
    await expect(page.locator('[data-testid="payment-status"]')).toContainText('Concluído', { timeout: 5000 });
  });

  test('deve lidar com falha de conexão WebSocket', async ({ page }) => {
    // Mock WebSocket que falha
    await page.addInitScript(() => {
      class MockWebSocket {
        constructor(url) {
          this.url = url;
          setTimeout(() => {
            if (this.onerror) this.onerror(new Error('Connection failed'));
          }, 100);
        }
      }
      
      window.WebSocket = MockWebSocket;
    });

    await page.goto('/checkout/status/test-intent-123');

    // Verificar fallback para polling
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('Polling');
  });
});

test.describe('Consulta Pública de Status', () => {
  test('deve permitir consulta por email', async ({ page }) => {
    // Mock para consulta pública
    await page.route('/api/subscriptions/status/public', route => {
      const body = route.request().postDataJSON();
      
      if (body.email === 'joao@exemplo.com') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            intents: [{
              intent_id: 'public-intent-123',
              status: 'pending',
              plan_name: 'Plano Pro',
              amount: 99.90,
              created_at: new Date().toISOString()
            }]
          })
        });
      } else {
        route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Nenhum pagamento encontrado' })
        });
      }
    });

    await page.goto('/checkout/status');

    // Preencher email para consulta
    await page.fill('[data-testid="search-email"]', 'joao@exemplo.com');
    await page.click('[data-testid="search-button"]');

    // Verificar resultados
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
    await expect(page.locator('[data-testid="intent-item"]')).toContainText('Plano Pro');
    await expect(page.locator('[data-testid="intent-item"]')).toContainText('R$ 99,90');
  });

  test('deve permitir consulta por CPF', async ({ page }) => {
    // Mock para consulta por CPF
    await page.route('/api/subscriptions/status/public', route => {
      const body = route.request().postDataJSON();
      
      if (body.cpf_cnpj === '12345678901') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            intents: [{
              intent_id: 'cpf-intent-456',
              status: 'completed',
              plan_name: 'Plano Basic',
              amount: 49.90,
              completed_at: new Date().toISOString()
            }]
          })
        });
      } else {
        route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Nenhum pagamento encontrado' })
        });
      }
    });

    await page.goto('/checkout/status');

    // Preencher CPF para consulta
    await page.fill('[data-testid="search-cpf"]', '12345678901');
    await page.click('[data-testid="search-button"]');

    // Verificar resultados
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
    await expect(page.locator('[data-testid="intent-item"]')).toContainText('Plano Basic');
    await expect(page.locator('[data-testid="intent-status"]')).toContainText('Concluído');
  });

  test('deve lidar com consulta sem resultados', async ({ page }) => {
    // Mock para consulta sem resultados
    await page.route('/api/subscriptions/status/public', route => {
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Nenhum pagamento encontrado' })
      });
    });

    await page.goto('/checkout/status');

    // Fazer consulta
    await page.fill('[data-testid="search-email"]', 'inexistente@exemplo.com');
    await page.click('[data-testid="search-button"]');

    // Verificar mensagem de não encontrado
    await expect(page.locator('[data-testid="no-results"]')).toContainText('Nenhum pagamento encontrado');
  });
});