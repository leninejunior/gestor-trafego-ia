import { test, expect } from '@playwright/test'

test.describe('Checkout Flow E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Mock de APIs para evitar dependências externas
    await page.route('**/api/subscriptions/checkout-iugu', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          checkout_url: 'https://checkout.iugu.com/123',
          intent_id: 'intent-123'
        })
      })
    })

    await page.route('**/api/plans', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'Basic Plan',
            price: 99.90,
            interval: 'monthly',
            features: { clients: 10, campaigns: 50 },
            popular: true
          },
          {
            id: '456e7890-f12c-34e5-b567-537725285111',
            name: 'Professional Plan',
            price: 199.90,
            interval: 'monthly',
            features: { clients: 50, campaigns: 200 },
            popular: false
          }
        ])
      })
    })
  })

  test('should complete checkout flow successfully', async ({ page }) => {
    // 1. Navegar para a página de planos
    await page.goto('/plans')
    
    // 2. Verificar se os planos são exibidos
    await expect(page.locator('h1')).toContainText('Escolha seu plano')
    await expect(page.locator('[data-testid="plan-card"]').first()).toBeVisible()
    
    // 3. Selecionar o plano Basic
    await page.locator('[data-testid="plan-card"]').first().click()
    
    // 4. Preencher formulário de checkout
    await expect(page.locator('[data-testid="checkout-form"]')).toBeVisible()
    
    await page.fill('[data-testid="name-input"]', 'Test User')
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="cpf-input"]', '12345678901')
    await page.fill('[data-testid="organization-input"]', 'Test Organization')
    
    // 5. Submeter formulário
    await page.click('[data-testid="submit-button"]')
    
    // 6. Verificar redirecionamento para checkout
    await expect(page).toHaveURL(/https:\/\/checkout\.iugu\.com\/.*/)
    
    // 7. Verificar se o intent foi criado
    const apiCalls = await page.evaluate(() => {
      return (window as any).__apiCalls || []
    })
    
    const checkoutCall = apiCalls.find((call: any) => call.url.includes('/api/subscriptions/checkout-iugu'))
    expect(checkoutCall).toBeDefined()
    expect(checkoutCall?.postData).toMatchObject({
      plan_id: '123e4567-e89b-12d3-a456-426614174000',
      user_data: {
        name: 'Test User',
        email: 'test@example.com',
        cpf_cnpj: '12345678901',
        organization_name: 'Test Organization'
      }
    })
  })

  test('should validate form fields', async ({ page }) => {
    // 1. Navegar para a página de planos
    await page.goto('/plans')
    
    // 2. Selecionar o plano Basic
    await page.locator('[data-testid="plan-card"]').first().click()
    
    // 3. Tentar submeter formulário vazio
    await page.click('[data-testid="submit-button"]')
    
    // 4. Verificar mensagens de erro
    await expect(page.locator('[data-testid="name-error"]')).toContainText('Nome é obrigatório')
    await expect(page.locator('[data-testid="email-error"]')).toContainText('Email é inválido')
    await expect(page.locator('[data-testid="cpf-error"]')).toContainText('CPF/CNPJ é inválido')
    await expect(page.locator('[data-testid="organization-error"]')).toContainText('Nome da organização é obrigatório')
  })

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock de erro na API
    await page.route('**/api/subscriptions/checkout-iugu', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Erro interno do servidor'
        })
      })
    })

    // 1. Navegar para a página de planos
    await page.goto('/plans')
    
    // 2. Selecionar o plano Basic
    await page.locator('[data-testid="plan-card"]').first().click()
    
    // 3. Preencher formulário
    await page.fill('[data-testid="name-input"]', 'Test User')
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="cpf-input"]', '12345678901')
    await page.fill('[data-testid="organization-input"]', 'Test Organization')
    
    // 4. Submeter formulário
    await page.click('[data-testid="submit-button"]')
    
    // 5. Verificar mensagem de erro
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible()
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Erro ao processar checkout')
  })

  test('should be accessible', async ({ page }) => {
    // 1. Navegar para a página de planos
    await page.goto('/plans')
    
    // 2. Verificar acessibilidade
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('[data-testid="plan-card"]')).toBeVisible()
    
    // 3. Navegação por teclado
    await page.keyboard.press('Tab')
    await expect(page.locator('[data-testid="plan-card"]').first()).toBeFocused()
    
    await page.keyboard.press('Tab')
    await expect(page.locator('[data-testid="select-plan-button"]').first()).toBeFocused()
    
    // 4. Selecionar plano e preencher formulário
    await page.keyboard.press('Enter')
    await expect(page.locator('[data-testid="checkout-form"]')).toBeVisible()
    
    await page.keyboard.press('Tab')
    await expect(page.locator('[data-testid="name-input"]')).toBeFocused()
    
    await page.keyboard.press('Tab')
    await expect(page.locator('[data-testid="email-input"]')).toBeFocused()
    
    await page.keyboard.press('Tab')
    await expect(page.locator('[data-testid="cpf-input"]')).toBeFocused()
    
    await page.keyboard.press('Tab')
    await expect(page.locator('[data-testid="organization-input"]')).toBeFocused()
    
    await page.keyboard.press('Tab')
    await expect(page.locator('[data-testid="submit-button"]')).toBeFocused()
  })

  test('should work on mobile', async ({ page }) => {
    // 1. Simular viewport mobile
    await page.setViewportSize({ width: 375, height: 667 })
    
    // 2. Navegar para a página de planos
    await page.goto('/plans')
    
    // 3. Verificar layout responsivo
    await expect(page.locator('[data-testid="plan-card"]').first()).toBeVisible()
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible()
    
    // 4. Abrir menu mobile se necessário
    if (await page.locator('[data-testid="mobile-menu"]').isVisible()) {
      await page.click('[data-testid="mobile-menu"]')
    }
    
    // 5. Selecionar plano
    await page.locator('[data-testid="plan-card"]').first().click()
    
    // 6. Verificar formulário em mobile
    await expect(page.locator('[data-testid="checkout-form"]')).toBeVisible()
    await expect(page.locator('[data-testid="name-input"]')).toBeVisible()
    
    // 7. Preencher e submeter
    await page.fill('[data-testid="name-input"]', 'Test User')
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="cpf-input"]', '12345678901')
    await page.fill('[data-testid="organization-input"]', 'Test Organization')
    
    // Scroll para o botão se necessário
    await page.locator('[data-testid="submit-button"]').scrollIntoViewIfNeeded()
    await page.click('[data-testid="submit-button"]')
    
    // 8. Verificar redirecionamento
    await expect(page).toHaveURL(/https:\/\/checkout\.iugu\.com\/.*/)
  })

  test('should handle network failures', async ({ page }) => {
    // 1. Simular falha de rede
    await page.route('**/api/subscriptions/checkout-iugu', async (route) => {
      await route.abort('failed')
    })

    // 2. Navegar para a página de planos
    await page.goto('/plans')
    
    // 3. Selecionar plano e preencher formulário
    await page.locator('[data-testid="plan-card"]').first().click()
    await page.fill('[data-testid="name-input"]', 'Test User')
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="cpf-input"]', '12345678901')
    await page.fill('[data-testid="organization-input"]', 'Test Organization')
    
    // 4. Submeter formulário
    await page.click('[data-testid="submit-button"]')
    
    // 5. Verificar mensagem de erro de rede
    await expect(page.locator('[data-testid="network-error"]')).toBeVisible()
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible()
  })

  test('should track analytics events', async ({ page }) => {
    // 1. Mock do analytics
    const analyticsEvents: any[] = []
    await page.addInitScript(() => {
      (window as any).gtag = (event: string, data: any) => {
        (window as any).__analyticsEvents = (window as any).__analyticsEvents || []
        ;(window as any).__analyticsEvents.push({ event, data })
      }
    })
    
    // 2. Navegar para a página de planos
    await page.goto('/plans')
    
    // 3. Selecionar plano
    await page.locator('[data-testid="plan-card"]').first().click()
    
    // 4. Preencher formulário
    await page.fill('[data-testid="name-input"]', 'Test User')
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="cpf-input"]', '12345678901')
    await page.fill('[data-testid="organization-input"]', 'Test Organization')
    
    // 5. Submeter formulário
    await page.click('[data-testid="submit-button"]')
    
    // 6. Verificar eventos de analytics
    const events = await page.evaluate(() => (window as any).__analyticsEvents || [])
    
    expect(events).toContainEqual(
      expect.objectContaining({
        event: 'plan_selected',
        data: expect.objectContaining({
          plan_id: '123e4567-e89b-12d3-a456-426614174000'
        })
      })
    )
    
    expect(events).toContainEqual(
      expect.objectContaining({
        event: 'checkout_started',
        data: expect.objectContaining({
          plan_id: '123e4567-e89b-12d3-a456-426614174000'
        })
      })
    )
  })
})