# Sistema de Testes do Projeto

## Visão Geral

Este diretório contém todos os testes do projeto, organizados por tipo e camada:

```
src/__tests__/
├── unit/              # Testes unitários
├── integration/        # Testes de integração
├── e2e/              # Testes end-to-end (Playwright)
├── components/         # Testes de componentes React
├── hooks/             # Testes de hooks personalizados
├── services/          # Testes de serviços
├── performance/       # Testes de performance
└── security/          # Testes de segurança
```

## Como Executar os Testes

### Todos os Testes
```bash
npm run test:all
```

### Tipos Específicos
```bash
# Testes unitários
npm run test:unit

# Testes de integração
npm run test:integration

# Testes E2E
npm run test:e2e

# Testes de performance
npm run test:performance

# Testes de segurança
npm run test:security
```

### Com Cobertura
```bash
npm run test:coverage
```

### Modo Watch
```bash
npm run test:watch
```

## Estrutura dos Testes

### Testes Unitários
- **Localização**: `src/__tests__/unit/`
- **Objetivo**: Testar funções e classes isoladamente
- **Exemplo**: `src/lib/services/__tests__/subscription-intent-service.test.ts`

### Testes de Integração
- **Localização**: `src/__tests__/integration/`
- **Objetivo**: Testar interação entre componentes e APIs
- **Exemplo**: `src/__tests__/integration/checkout-iugu-api.test.ts`

### Testes E2E
- **Localização**: `src/__tests__/e2e/`
- **Objetivo**: Testar fluxos completos do usuário
- **Framework**: Playwright
- **Exemplo**: `src/__tests__/e2e/checkout-flow.spec.ts`

## Boas Práticas

### 1. Nomenclatura
- Use `describe()` para agrupar testes relacionados
- Use `it()` ou `test()` com descrições claras
- Arquivos devem terminar com `.test.ts` ou `.spec.ts`

### 2. Estrutura AAA
```typescript
it('should do something', async () => {
  // Arrange
  const input = { /* dados */ }
  
  // Act
  const result = await service.doSomething(input)
  
  // Assert
  expect(result.success).toBe(true)
})
```

### 3. Mocks
- Mocke dependências externas
- Use `jest.clearAllMocks()` no `beforeEach`
- Mantenha os mocks realistas

### 4. Testes Assíncronos
- Use `async/await` para operações assíncronas
- Retorne promises quando necessário
- Teste casos de erro

## Cobertura de Código

### Thresholds
- **Branches**: 80%
- **Functions**: 80%
- **Lines**: 80%
- **Statements**: 80%

### Relatórios
- **Texto**: Console
- **HTML**: `coverage/lcov-report/index.html`
- **JSON**: `coverage/coverage-final.json`
- **LCOV**: `coverage/lcov.info`

## CI/CD

### GitHub Actions
- **Trigger**: Push e Pull Requests
- **Jobs**: Test, Performance, Security, Build
- **Arquivo**: `.github/workflows/test.yml`

### Execução Local
```bash
# Verificar ambiente
node scripts/run-all-tests.js --check-only

# Executar todos os testes
npm run test:all

# Gerar relatório apenas
npm run test:report
```

## Debug

### Jest
```bash
# Debug com VS Code
# Adicionar breakpoint com debugger
# Usar test.only para isolar

# Verbose output
npm test -- --verbose

# Update snapshots
npm test -- --updateSnapshot
```

### Playwright
```bash
# Modo UI
npm run test:e2e:ui

# Debug
npm run test:e2e:debug

# Trace
npx playwright test --trace on
```

## Exemplos

### Teste Unitário
```typescript
import { SubscriptionIntentService } from '@/lib/services/subscription-intent-service'

describe('SubscriptionIntentService', () => {
  let service: SubscriptionIntentService

  beforeEach(() => {
    service = new SubscriptionIntentService()
  })

  it('should create intent successfully', async () => {
    const result = await service.createIntent({
      email: 'test@example.com',
      planId: 'basic'
    })

    expect(result.success).toBe(true)
    expect(result.data.id).toBeDefined()
  })
})
```

### Teste de Integração
```typescript
import { POST } from '@/app/api/checkout/route'

describe('Checkout API', () => {
  it('should process checkout successfully', async () => {
    const request = new Request('http://localhost/api/checkout', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com' })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })
})
```

### Teste E2E
```typescript
import { test, expect } from '@playwright/test'

test('checkout flow', async ({ page }) => {
  await page.goto('/checkout')
  
  await page.fill('[data-testid="email"]', 'test@example.com')
  await page.click('[data-testid="submit"]')
  
  await expect(page).toHaveURL(/success/)
})
```

## Recursos

### Documentação
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Testing Library](https://testing-library.com/docs/)
- [Guia de Testes do Projeto](../../docs/TESTING_GUIDE.md)

### Ferramentas
- **Jest Runner**: Extensão VS Code
- **Playwright Test Runner**: Extensão VS Code
- **Coverage Gutters**: Visualização de cobertura

## Problemas Comuns

### 1. Mocks não funcionando
Verifique se o mock está configurado antes da importação:
```typescript
jest.mock('@/module', () => ({ /* mock */ }))
import { Module } from '@/module'
```

### 2. Testes assíncronos
Use `async/await` ou retorne a promise:
```typescript
it('should handle async', async () => {
  await asyncOperation()
  // ou
  return expect(asyncOperation()).resolves.toBe(expected)
})
```

### 3. Variáveis de ambiente
Configure no `jest.setup.js` ou no `beforeEach`:
```typescript
process.env.NODE_ENV = 'test'
```

## Contribuição

1. Crie testes para novas funcionalidades
2. Mantenha a cobertura acima dos thresholds
3. Siga as convenções de nomenclatura
4. Documente casos complexos
5. Revise testes em Pull Requests

## Suporte

Para dúvidas ou problemas:
- Verifique o [Guia de Testes](../../docs/TESTING_GUIDE.md)
- Consulte a documentação oficial
- Abra uma issue no repositório