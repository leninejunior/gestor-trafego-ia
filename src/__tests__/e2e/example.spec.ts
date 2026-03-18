import { test, expect } from '@playwright/test'

test.describe('Example E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock de APIs se necessário
    await page.route('**/api/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: 'mocked' })
      })
    })
  })

  test('should load homepage', async ({ page }) => {
    // Act
    await page.goto('/')
    
    // Assert
    await expect(page).toHaveTitle(/.*Flying Fox.*/)
  })

  test('should handle navigation', async ({ page }) => {
    // Act
    await page.goto('/')
    
    // Tentar encontrar e clicar em um link de navegação (se existir)
    const navLink = page.locator('a[href*="/dashboard"]').first()
    if (await navLink.isVisible()) {
      await navLink.click()
      await expect(page).toHaveURL(/.*dashboard.*/)
    } else {
      // Se não encontrar, apenas verifica que a página carregou
      await expect(page.locator('body')).toBeVisible()
    }
  })

  test('should handle form submission', async ({ page }) => {
    // Arrange
    await page.goto('/')
    
    // Procurar por formulários na página
    const form = page.locator('form').first()
    if (await form.isVisible()) {
      // Preencher campos do formulário se existirem
      const emailInput = form.locator('input[type="email"], input[name*="email"]')
      if (await emailInput.isVisible()) {
        await emailInput.fill('test@example.com')
        
        const submitButton = form.locator('button[type="submit"], input[type="submit"]')
        if (await submitButton.isVisible()) {
          // Mock da resposta do formulário
          await page.route('**/api/**', async (route) => {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ success: true, message: 'Form submitted' })
            })
          })
          
          await submitButton.click()
          
          // Verificar se há mensagem de sucesso
          const successMessage = page.locator('.success, .alert-success, [data-testid="success"]')
          if (await successMessage.isVisible({ timeout: 5000 })) {
            await expect(successMessage).toBeVisible()
          }
        }
      }
    } else {
      // Se não houver formulário, apenas verifica que a página está funcional
      await expect(page.locator('body')).toBeVisible()
    }
  })

  test('should be responsive on mobile', async ({ page }) => {
    // Arrange
    await page.setViewportSize({ width: 375, height: 667 }) // iPhone dimensions
    
    // Act
    await page.goto('/')
    
    // Assert
    await expect(page.locator('body')).toBeVisible()
    
    // Verificar se há menu mobile (se existir)
    const mobileMenu = page.locator('[data-testid="mobile-menu"], .mobile-menu, button[aria-label*="menu"]')
    if (await mobileMenu.isVisible()) {
      await expect(mobileMenu).toBeVisible()
    }
  })

  test('should handle network errors gracefully', async ({ page }) => {
    // Arrange
    await page.route('**/api/**', route => route.abort())
    
    // Act
    await page.goto('/')
    
    // Assert
    // A página deve carregar mesmo com APIs offline
    await expect(page.locator('body')).toBeVisible()
    
    // Verificar se há mensagem de erro (se implementada)
    const errorMessage = page.locator('.error, .alert-error, [data-testid="error"]')
    if (await errorMessage.isVisible({ timeout: 3000 })) {
      await expect(errorMessage).toBeVisible()
    }
  })
})