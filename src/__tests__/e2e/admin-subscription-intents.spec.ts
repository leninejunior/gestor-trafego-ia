/**
 * Testes E2E do Painel Administrativo de Subscription Intents
 * Testa fluxos completos de usuário no painel administrativo
 * Requirements: 3.1, 3.2, 3.3, 6.1, 6.4
 */

import { test, expect } from '@playwright/test';

test.describe('Admin Subscription Intents E2E', () => {
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
            role: 'admin',
          },
        }),
      });
    });

    // Mock subscription intents list
    await page.route('**/api/admin/subscription-intents**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            intents: [
              {
                id: 'intent-1',
                user_email: 'customer1@example.com',
                user_name: 'Customer One',
                organization_name: 'Company One',
                status: 'pending',
                billing_cycle: 'monthly',
                created_at: '2024-01-01T10:00:00Z',
                expires_at: '2024-01-08T10:00:00Z',
                plan: {
                  id: 'plan-1',
                  name: 'Pro Plan',
                  monthly_price: 99.99
                }
              },
              {
                id: 'intent-2',
                user_email: 'customer2@example.com',
                user_name: 'Customer Two',
                organization_name: 'Company Two',
                status: 'completed',
                billing_cycle: 'annual',
                created_at: '2024-01-02T10:00:00Z',
                expires_at: '2024-01-09T10:00:00Z',
                completed_at: '2024-01-02T11:30:00Z',
                plan: {
                  id: 'plan-2',
                  name: 'Basic Plan',
                  annual_price: 299.99
                }
              }
            ],
            total: 2,
            page: 1,
            limit: 20,
            hasMore: false
          }),
        });
      }
    });
  });

  test('deve navegar e visualizar lista de subscription intents', async ({ page }) => {
    await page.goto('/admin/subscription-intents');

    // Verificar título da página
    await expect(page.locator('h1')).toContainText('Gestão de Subscription Intents');

    // Verificar se a lista de intents é exibida
    await expect(page.locator('[data-testid="subscription-intents-table"]')).toBeVisible();
    
    // Verificar se os intents aparecem na tabela
    await expect(page.locator('text=customer1@example.com')).toBeVisible();
    await expect(page.locator('text=customer2@example.com')).toBeVisible();
    await expect(page.locator('text=Company One')).toBeVisible();
    await expect(page.locator('text=Company Two')).toBeVisible();
  });
test('deve filtrar subscription intents por status', async ({ page }) => {
    await page.goto('/admin/subscription-intents');

    // Selecionar filtro por status
    await page.selectOption('[data-testid="status-filter"]', 'pending');

    // Verificar se apenas intents pendentes são exibidos
    await expect(page.locator('text=customer1@example.com')).toBeVisible();
    await expect(page.locator('text=PENDING')).toBeVisible();
  });

  test('deve buscar subscription intents por email', async ({ page }) => {
    await page.goto('/admin/subscription-intents');

    // Buscar por email específico
    await page.fill('[data-testid="email-search"]', 'customer1@example.com');
    await page.keyboard.press('Enter');

    // Verificar se apenas o intent correspondente é exibido
    await expect(page.locator('text=customer1@example.com')).toBeVisible();
    await expect(page.locator('text=customer2@example.com')).not.toBeVisible();
  });

  test('deve visualizar detalhes de um subscription intent', async ({ page }) => {
    // Mock intent details
    await page.route('**/api/admin/subscription-intents/intent-1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          intent: {
            id: 'intent-1',
            user_email: 'customer1@example.com',
            user_name: 'Customer One',
            organization_name: 'Company One',
            status: 'pending',
            billing_cycle: 'monthly',
            created_at: '2024-01-01T10:00:00Z',
            expires_at: '2024-01-08T10:00:00Z',
            plan: {
              name: 'Pro Plan',
              monthly_price: 99.99
            }
          },
          webhook_logs: [],
          state_transitions: []
        }),
      });
    });

    await page.goto('/admin/subscription-intents');

    // Clicar no botão de visualizar detalhes
    await page.click('[data-testid="view-intent-intent-1"]');

    // Verificar se o modal/página de detalhes é aberto
    await expect(page.locator('[data-testid="intent-details-modal"]')).toBeVisible();
    await expect(page.locator('text=Customer One')).toBeVisible();
    await expect(page.locator('text=Company One')).toBeVisible();
    await expect(page.locator('text=Pro Plan')).toBeVisible();
  });

  test('deve executar ação de ativação manual', async ({ page }) => {
    // Mock da ação de ativação
    await page.route('**/api/admin/subscription-intents/intent-1', async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Subscription activated successfully'
          }),
        });
      }
    });

    await page.goto('/admin/subscription-intents');

    // Clicar no menu de ações
    await page.click('[data-testid="actions-menu-intent-1"]');

    // Clicar na ação de ativar
    await page.click('[data-testid="activate-intent-intent-1"]');

    // Confirmar a ação
    await page.click('[data-testid="confirm-activate"]');

    // Verificar mensagem de sucesso
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    await expect(page.locator('text=Subscription activated successfully')).toBeVisible();
  });

  test('deve navegar entre abas do painel', async ({ page }) => {
    await page.goto('/admin/subscription-intents');

    // Verificar aba inicial (Intents)
    await expect(page.locator('[data-testid="tab-intents"]')).toHaveClass(/active/);

    // Navegar para aba Analytics
    await page.click('[data-testid="tab-analytics"]');
    await expect(page.locator('[data-testid="analytics-content"]')).toBeVisible();

    // Navegar para aba Troubleshooting
    await page.click('[data-testid="tab-troubleshooting"]');
    await expect(page.locator('[data-testid="troubleshooting-content"]')).toBeVisible();

    // Navegar para aba Webhooks
    await page.click('[data-testid="tab-webhooks"]');
    await expect(page.locator('[data-testid="webhooks-content"]')).toBeVisible();
  });

  test('deve exibir métricas em tempo real', async ({ page }) => {
    // Mock real-time metrics
    await page.route('**/api/admin/subscription-intents/real-time-metrics', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total_intents: 150,
          pending_intents: 25,
          completed_today: 12,
          conversion_rate: 78.5,
          revenue_today: 1250.00
        }),
      });
    });

    await page.goto('/admin/subscription-intents');

    // Verificar se as métricas são exibidas
    await expect(page.locator('[data-testid="metric-total-intents"]')).toContainText('150');
    await expect(page.locator('[data-testid="metric-pending"]')).toContainText('25');
    await expect(page.locator('[data-testid="metric-completed-today"]')).toContainText('12');
    await expect(page.locator('[data-testid="metric-conversion-rate"]')).toContainText('78.5%');
  });

  test('deve exportar dados de analytics', async ({ page }) => {
    // Mock analytics data
    await page.route('**/api/admin/subscription-intents/analytics', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          analytics: {
            metrics: {
              total_intents: 150,
              completed_intents: 120,
              conversion_rate: 80.0,
              total_revenue: 12500.00
            }
          }
        }),
      });
    });

    // Mock export endpoint
    await page.route('**/api/admin/subscription-intents/export', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          download_url: '/api/admin/subscription-intents/export/download/export-123.csv'
        }),
      });
    });

    await page.goto('/admin/subscription-intents');

    // Navegar para aba Analytics
    await page.click('[data-testid="tab-analytics"]');

    // Clicar no botão de exportar CSV
    await page.click('[data-testid="export-csv-button"]');

    // Verificar se o download foi iniciado
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="confirm-export"]');
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toContain('.csv');
  });

  test('deve tratar erros de permissão', async ({ page }) => {
    // Mock erro de permissão
    await page.route('**/api/admin/subscription-intents**', async (route) => {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Forbidden'
        }),
      });
    });

    await page.goto('/admin/subscription-intents');

    // Verificar se a mensagem de erro é exibida
    await expect(page.locator('[data-testid="permission-error"]')).toBeVisible();
    await expect(page.locator('text=Você não tem permissão')).toBeVisible();
  });

  test('deve implementar paginação', async ({ page }) => {
    // Mock large dataset
    await page.route('**/api/admin/subscription-intents**', async (route) => {
      const url = new URL(route.request().url());
      const page_param = url.searchParams.get('page') || '1';
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          intents: Array.from({ length: 20 }, (_, i) => ({
            id: `intent-${page_param}-${i}`,
            user_email: `customer${i}@example.com`,
            user_name: `Customer ${i}`,
            organization_name: `Company ${i}`,
            status: 'pending',
            billing_cycle: 'monthly',
            created_at: '2024-01-01T10:00:00Z',
            plan: { name: 'Pro Plan' }
          })),
          total: 100,
          page: parseInt(page_param),
          limit: 20,
          hasMore: parseInt(page_param) < 5
        }),
      });
    });

    await page.goto('/admin/subscription-intents');

    // Verificar informações de paginação
    await expect(page.locator('[data-testid="pagination-info"]')).toContainText('1 a 20 de 100');

    // Navegar para próxima página
    await page.click('[data-testid="next-page-button"]');

    // Verificar se a página mudou
    await expect(page.locator('[data-testid="pagination-info"]')).toContainText('21 a 40 de 100');
  });

  test('deve atualizar dados automaticamente', async ({ page }) => {
    let callCount = 0;
    
    await page.route('**/api/admin/subscription-intents**', async (route) => {
      callCount++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          intents: [{
            id: `intent-${callCount}`,
            user_email: `customer${callCount}@example.com`,
            status: 'pending',
            plan: { name: 'Pro Plan' }
          }],
          total: 1
        }),
      });
    });

    await page.goto('/admin/subscription-intents');

    // Verificar dados iniciais
    await expect(page.locator('text=customer1@example.com')).toBeVisible();

    // Clicar no botão de atualizar
    await page.click('[data-testid="refresh-button"]');

    // Verificar se os dados foram atualizados
    await expect(page.locator('text=customer2@example.com')).toBeVisible();
  });

  test('deve validar acessibilidade do painel', async ({ page }) => {
    await page.goto('/admin/subscription-intents');

    // Verificar se elementos têm labels apropriados
    await expect(page.locator('[data-testid="email-search"]')).toHaveAttribute('placeholder', 'Buscar por email...');
    await expect(page.locator('[data-testid="status-filter"]')).toHaveAttribute('aria-label');

    // Verificar navegação por teclado
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toBeVisible();

    // Verificar contraste de cores nos badges de status
    const pendingBadge = page.locator('[data-testid="status-badge-pending"]');
    await expect(pendingBadge).toHaveCSS('background-color', 'rgb(254, 249, 195)'); // bg-yellow-100
    await expect(pendingBadge).toHaveCSS('color', 'rgb(146, 64, 14)'); // text-yellow-800
  });

  test('deve funcionar em dispositivos móveis', async ({ page }) => {
    // Simular viewport mobile
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/admin/subscription-intents');

    // Verificar se a interface se adapta ao mobile
    await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
    
    // Verificar se a tabela é responsiva
    await expect(page.locator('[data-testid="subscription-intents-table"]')).toBeVisible();
    
    // Verificar se os filtros são acessíveis em mobile
    await page.click('[data-testid="mobile-filters-button"]');
    await expect(page.locator('[data-testid="mobile-filters-panel"]')).toBeVisible();
  });
});
