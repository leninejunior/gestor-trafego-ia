import { test, expect } from '@playwright/test';

/**
 * Testes E2E para fluxos de error e recovery
 * Testa cenários de falha e opções de recuperação
 * Requirements: 1.5, 5.2, 8.1, 8.2
 */

test.describe('Fluxos de Error e Recovery', () => {
  test('deve lidar com falha de pagamento e oferecer recovery', async ({ page }) => {
    // Mock para intent com falha de pagamento
    await page.route('/api/subscriptions/status/failed-intent', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          intent_id: 'failed-intent',
          status: 'failed',
          user_name: 'Ana Costa',
          user_email: 'ana@exemplo.com',
          organization_name: 'Empresa Falha',
          plan_name: 'Plano Pro',
          billing_cycle: 'monthly',
          amount: 99.90,
          payment_method: 'credit_card',
          failure_reason: 'Cartão recusado',
          failure_code: 'card_declined',
          created_at: new Date().toISOString()
        })
      });
    });

    await page.goto('/checkout/status/failed-intent');

    // Verificar status de falha
    await expect(page.locator('[data-testid="payment-status"]')).toContainText('Pagamento Falhou');
    await expect(page.locator('[data-testid="status-badge"]')).toHaveClass(/failed/);

    // Verificar mensagem de erro específica
    await expect(page.locator('[data-testid="failure-reason"]')).toContainText('Cartão recusado');

    // Verificar opções de recovery
    await expect(page.locator('[data-testid="retry-payment-button"]')).toContainText('Tentar Novamente');
    await expect(page.locator('[data-testid="change-method-button"]')).toContainText('Alterar Método');
    await expect(page.locator('[data-testid="contact-support-button"]')).toContainText('Contatar Suporte');
  });

  test('deve permitir retry de pagamento falhado', async ({ page }) => {
    // Mock para intent falhado
    await page.route('/api/subscriptions/status/retry-intent', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          intent_id: 'retry-intent',
          status: 'failed',
          user_name: 'Pedro Silva',
          user_email: 'pedro@exemplo.com',
          organization_name: 'Empresa Retry',
          plan_name: 'Plano Basic',
          billing_cycle: 'monthly',
          amount: 49.90,
          failure_reason: 'Saldo insuficiente'
        })
      });
    });

    // Mock para retry de pagamento
    await page.route('/api/subscriptions/recovery/regenerate', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          new_intent_id: 'retry-new-intent',
          checkout_url: 'https://iugu.com/checkout/retry',
          status_url: '/checkout/status/retry-new-intent'
        })
      });
    });

    await page.goto('/checkout/status/retry-intent');

    // Clicar em tentar novamente
    await page.click('[data-testid="retry-payment-button"]');

    // Verificar loading state
    await expect(page.locator('[data-testid="retry-payment-button"]')).toBeDisabled();
    await expect(page.locator('[data-testid="retry-payment-button"]')).toContainText('Processando...');

    // Verificar redirecionamento para nova tentativa
    await expect(page).toHaveURL('/checkout/status/retry-new-intent');
  });

  test('deve exibir instruções específicas por tipo de erro', async ({ page }) => {
    const errorScenarios = [
      {
        code: 'card_declined',
        reason: 'Cartão recusado',
        instruction: 'Verifique os dados do cartão ou tente outro cartão'
      },
      {
        code: 'insufficient_funds',
        reason: 'Saldo insuficiente',
        instruction: 'Verifique o saldo disponível ou use outro método'
      },
      {
        code: 'expired_card',
        reason: 'Cartão expirado',
        instruction: 'Use um cartão válido com data de validade atual'
      },
      {
        code: 'invalid_cvc',
        reason: 'Código de segurança inválido',
        instruction: 'Verifique o código de 3 dígitos no verso do cartão'
      }
    ];

    for (const scenario of errorScenarios) {
      // Mock para cada cenário de erro
      await page.route(`/api/subscriptions/status/${scenario.code}-intent`, route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            intent_id: `${scenario.code}-intent`,
            status: 'failed',
            user_name: 'Teste Erro',
            user_email: 'erro@exemplo.com',
            organization_name: 'Empresa Erro',
            plan_name: 'Plano Test',
            billing_cycle: 'monthly',
            amount: 99.90,
            failure_reason: scenario.reason,
            failure_code: scenario.code
          })
        });
      });

      await page.goto(`/checkout/status/${scenario.code}-intent`);

      // Verificar mensagem de erro específica
      await expect(page.locator('[data-testid="failure-reason"]')).toContainText(scenario.reason);
      
      // Verificar instrução específica
      await expect(page.locator('[data-testid="error-instruction"]')).toContainText(scenario.instruction);
    }
  });

  test('deve lidar com múltiplas tentativas de pagamento', async ({ page }) => {
    // Mock para intent com histórico de tentativas
    await page.route('/api/subscriptions/status/multi-attempt-intent', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          intent_id: 'multi-attempt-intent',
          status: 'failed',
          user_name: 'Carlos Multi',
          user_email: 'carlos@exemplo.com',
          organization_name: 'Empresa Multi',
          plan_name: 'Plano Pro',
          billing_cycle: 'monthly',
          amount: 99.90,
          attempt_count: 3,
          max_attempts: 5,
          payment_attempts: [
            {
              attempt: 1,
              timestamp: '2024-01-01T10:00:00Z',
              method: 'credit_card',
              status: 'failed',
              reason: 'Cartão recusado'
            },
            {
              attempt: 2,
              timestamp: '2024-01-01T11:00:00Z',
              method: 'credit_card',
              status: 'failed',
              reason: 'Saldo insuficiente'
            },
            {
              attempt: 3,
              timestamp: '2024-01-01T12:00:00Z',
              method: 'pix',
              status: 'failed',
              reason: 'Timeout'
            }
          ]
        })
      });
    });

    await page.goto('/checkout/status/multi-attempt-intent');

    // Verificar contador de tentativas
    await expect(page.locator('[data-testid="attempt-counter"]')).toContainText('Tentativa 3 de 5');

    // Verificar histórico de tentativas
    await expect(page.locator('[data-testid="attempt-history"]')).toBeVisible();
    await expect(page.locator('[data-testid="attempt-1"]')).toContainText('Cartão recusado');
    await expect(page.locator('[data-testid="attempt-2"]')).toContainText('Saldo insuficiente');
    await expect(page.locator('[data-testid="attempt-3"]')).toContainText('Timeout');

    // Verificar que ainda pode tentar novamente
    await expect(page.locator('[data-testid="retry-payment-button"]')).toBeEnabled();
  });

  test('deve bloquear tentativas após limite máximo', async ({ page }) => {
    // Mock para intent que atingiu limite de tentativas
    await page.route('/api/subscriptions/status/max-attempts-intent', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          intent_id: 'max-attempts-intent',
          status: 'failed',
          user_name: 'Maria Limite',
          user_email: 'maria@exemplo.com',
          organization_name: 'Empresa Limite',
          plan_name: 'Plano Basic',
          billing_cycle: 'monthly',
          amount: 49.90,
          attempt_count: 5,
          max_attempts: 5,
          blocked_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24h
        })
      });
    });

    await page.goto('/checkout/status/max-attempts-intent');

    // Verificar que atingiu limite
    await expect(page.locator('[data-testid="attempt-counter"]')).toContainText('Limite de tentativas atingido');

    // Verificar que botão de retry está desabilitado
    await expect(page.locator('[data-testid="retry-payment-button"]')).toBeDisabled();

    // Verificar mensagem de bloqueio
    await expect(page.locator('[data-testid="blocked-message"]')).toContainText('Aguarde 24 horas');

    // Verificar opções alternativas
    await expect(page.locator('[data-testid="contact-support-button"]')).toBeEnabled();
    await expect(page.locator('[data-testid="new-checkout-button"]')).toContainText('Iniciar Novo Checkout');
  });

  test('deve oferecer contato com suporte', async ({ page }) => {
    await page.route('/api/subscriptions/status/support-intent', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          intent_id: 'support-intent',
          status: 'failed',
          user_name: 'João Suporte',
          user_email: 'joao@exemplo.com',
          organization_name: 'Empresa Suporte',
          plan_name: 'Plano Pro',
          billing_cycle: 'monthly',
          amount: 99.90,
          failure_reason: 'Erro técnico'
        })
      });
    });

    await page.goto('/checkout/status/support-intent');

    // Clicar em contatar suporte
    await page.click('[data-testid="contact-support-button"]');

    // Verificar modal de suporte
    await expect(page.locator('[data-testid="support-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="support-email"]')).toContainText('suporte@exemplo.com');
    await expect(page.locator('[data-testid="support-phone"]')).toContainText('(11) 9999-9999');

    // Verificar informações do caso
    await expect(page.locator('[data-testid="case-id"]')).toContainText('support-intent');
    await expect(page.locator('[data-testid="case-details"]')).toContainText('Erro técnico');
  });

  test('deve permitir cancelamento de intent', async ({ page }) => {
    // Mock para cancelamento
    await page.route('/api/subscriptions/recovery/cancel', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Intenção de pagamento cancelada com sucesso'
        })
      });
    });

    await page.goto('/checkout/status/failed-intent');

    // Clicar em cancelar
    await page.click('[data-testid="cancel-intent-button"]');

    // Verificar modal de confirmação
    await expect(page.locator('[data-testid="cancel-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="cancel-warning"]')).toContainText('Esta ação não pode ser desfeita');

    // Confirmar cancelamento
    await page.click('[data-testid="confirm-cancel-button"]');

    // Verificar mensagem de sucesso
    await expect(page.locator('[data-testid="success-message"]')).toContainText('cancelada com sucesso');
  });
});

test.describe('Recovery de Conectividade', () => {
  test('deve lidar com perda de conexão', async ({ page }) => {
    await page.goto('/checkout/status/test-intent-123');

    // Simular perda de conexão
    await page.setOffline(true);

    // Verificar indicador de conexão
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('Sem conexão');
    await expect(page.locator('[data-testid="offline-banner"]')).toBeVisible();

    // Restaurar conexão
    await page.setOffline(false);

    // Verificar reconexão
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('Conectado');
    await expect(page.locator('[data-testid="offline-banner"]')).not.toBeVisible();
  });

  test('deve sincronizar dados após reconexão', async ({ page }) => {
    let requestCount = 0;

    // Mock que simula dados desatualizados inicialmente
    await page.route('/api/subscriptions/status/sync-intent', route => {
      requestCount++;
      const status = requestCount === 1 ? 'pending' : 'completed';
      
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          intent_id: 'sync-intent',
          status: status,
          user_name: 'Sync User',
          user_email: 'sync@exemplo.com',
          organization_name: 'Empresa Sync',
          plan_name: 'Plano Pro',
          billing_cycle: 'monthly',
          amount: 99.90,
          last_updated: new Date().toISOString()
        })
      });
    });

    await page.goto('/checkout/status/sync-intent');

    // Verificar status inicial
    await expect(page.locator('[data-testid="payment-status"]')).toContainText('Aguardando');

    // Simular perda e recuperação de conexão
    await page.setOffline(true);
    await page.waitForTimeout(1000);
    await page.setOffline(false);

    // Verificar sincronização automática
    await expect(page.locator('[data-testid="payment-status"]')).toContainText('Concluído', { timeout: 5000 });
  });

  test('deve permitir sincronização manual', async ({ page }) => {
    await page.goto('/checkout/status/test-intent-123');

    // Simular dados desatualizados
    await page.setOffline(true);
    await page.waitForTimeout(500);
    await page.setOffline(false);

    // Clicar em sincronizar manualmente
    await page.click('[data-testid="sync-button"]');

    // Verificar loading state
    await expect(page.locator('[data-testid="sync-button"]')).toBeDisabled();
    await expect(page.locator('[data-testid="sync-spinner"]')).toBeVisible();

    // Verificar sincronização completa
    await expect(page.locator('[data-testid="sync-button"]')).toBeEnabled();
    await expect(page.locator('[data-testid="last-sync"]')).toContainText('Agora');
  });
});

test.describe('Timeout e Rate Limiting', () => {
  test('deve lidar com timeout de API', async ({ page }) => {
    // Mock que demora para responder
    await page.route('/api/subscriptions/status/timeout-intent', route => {
      setTimeout(() => {
        route.fulfill({
          status: 408,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Request timeout' })
        });
      }, 5000);
    });

    await page.goto('/checkout/status/timeout-intent');

    // Verificar indicador de loading
    await expect(page.locator('[data-testid="loading-status"]')).toBeVisible();

    // Verificar mensagem de timeout
    await expect(page.locator('[data-testid="timeout-message"]')).toContainText('Timeout', { timeout: 10000 });

    // Verificar botão de retry
    await expect(page.locator('[data-testid="retry-load-button"]')).toBeVisible();
  });

  test('deve lidar com rate limiting', async ({ page }) => {
    // Mock que retorna rate limit
    await page.route('/api/subscriptions/status/rate-limit-intent', route => {
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ 
          error: 'Rate limit exceeded',
          retry_after: 60
        })
      });
    });

    await page.goto('/checkout/status/rate-limit-intent');

    // Verificar mensagem de rate limit
    await expect(page.locator('[data-testid="rate-limit-message"]')).toContainText('muitas requisições');
    await expect(page.locator('[data-testid="retry-countdown"]')).toContainText('60');

    // Verificar countdown
    await page.waitForTimeout(2000);
    await expect(page.locator('[data-testid="retry-countdown"]')).toContainText('58');
  });
});