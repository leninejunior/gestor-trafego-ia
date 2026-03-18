# Guia de Testes do Projeto

## Visão Geral

Este projeto utiliza uma estratégia de testes multicamadas para garantir a qualidade e confiabilidade do código:

- **Testes Unitários**: Testam funções e classes isoladamente
- **Testes de Integração**: Testam a interação entre componentes e APIs
- **Testes E2E (End-to-End)**: Testam fluxos completos do usuário

## Frameworks Utilizados

### Jest
- **Framework principal** para testes unitários e de integração
- **Configuração**: [`jest.config.js`](../jest.config.js)
- **Setup**: [`jest.setup.js`](../jest.setup.js)

### Playwright
- **Framework** para testes E2E
- **Configuração**: [`playwright.config.ts`](../playwright.config.ts)
- **Diretório**: `src/__tests__/e2e/`

### Testing Library
- **React Testing Library** para testes de componentes
- **Jest DOM** para ambiente de teste

## Estrutura de Diretórios

```
src/
├── __tests__/
│   ├── unit/              # Testes unitários
│   ├── integration/        # Testes de integração
│   ├── e2e/              # Testes E2E (Playwright)
│   ├── components/         # Testes de componentes
│   ├── hooks/             # Testes de hooks
│   ├── services/          # Testes de serviços
│   └── performance/       # Testes de performance
├── lib/
│   └── services/
│       └── __tests__/      # Testes unitários de serviços
└── app/
    └── api/
        └── __tests__/      # Testes de integração de APIs
```

## Como Escrever Testes

### Testes Unitários

#### Estrutura Básica
```typescript
import { describe, it, expect, beforeEach, jest } from '@jest/globals'

describe('NomeDoServiço', () => {
  let service: NomeDoServiço

  beforeEach(() => {
    jest.clearAllMocks()
    service = new NomeDoServiço()
  })

  it('should do something correctly', async () => {
    // Arrange
    const input = { /* dados de entrada */ }
    
    // Act
    const result = await service.doSomething(input)
    
    // Assert
    expect(result.success).toBe(true)
    expect(result.data).toEqual(expectedOutput)
  })
})
```

#### Mock de Dependências
```typescript
// Mock de módulos
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => mockQueryBuilder),
      insert: jest.fn(() => mockQueryBuilder),
      // ... outros métodos
    }))
  }))
}))

// Mock de APIs
jest.mock('@/lib/iugu/client', () => ({
  IuguClient: {
    createCustomer: jest.fn(),
    createPaymentToken: jest.fn(),
    // ... outros métodos
  }
}))
```

### Testes de Integração

#### Testes de APIs
```typescript
import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

describe('API Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Mock de variáveis de ambiente
    process.env.TEST_VAR = 'test-value'
  })

  it('should handle POST request correctly', async () => {
    // Arrange
    const requestBody = { /* dados */ }
    const request = new NextRequest(url, {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: { 'Content-Type': 'application/json' }
    })

    // Mock de dependências
    mockSupabaseClient.from().select().eq().single.mockResolvedValue({
      data: mockData,
      error: null
    })

    // Act
    const response = await POST(request)

    // Assert
    expect(response.status).toBe(200)
    const responseData = await response.json()
    expect(responseData.success).toBe(true)
  })
})
```

### Testes E2E com Playwright

#### Estrutura Básica
```typescript
import { test, expect } from '@playwright/test'

test.describe('Checkout Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock de APIs
    await page.route('**/api/checkout', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, checkout_url: 'https://test.com' })
      })
    })
  })

  test('should complete checkout flow', async ({ page }) => {
    // Act
    await page.goto('/checkout')
    await page.fill('[data-testid="email"]', 'test@example.com')
    await page.click('[data-testid="submit"]')
    
    // Assert
    await expect(page).toHaveURL(/checkout/)
    await expect(page.locator('[data-testid="success"]')).toBeVisible()
  })
})
```

## Boas Práticas

### 1. Nomenclatura
- **Arquivos**: `nome-do-componente.test.ts` ou `nome-do-servico.test.ts`
- **Descrições**: Use `describe()` para agrupar testes relacionados
- **Testes**: Use `it()` com descrições claras do que está sendo testado

### 2. Estrutura AAA (Arrange, Act, Assert)
```typescript
it('should validate user input', async () => {
  // Arrange
  const invalidInput = { email: 'invalid-email' }
  
  // Act
  const result = await service.validate(invalidInput)
  
  // Assert
  expect(result.success).toBe(false)
  expect(result.errors).toContain('Email inválido')
})
```

### 3. Testes de Erro
```typescript
it('should handle database errors gracefully', async () => {
  // Arrange
  mockSupabaseClient.from().select().mockRejectedValue(
    new Error('Database connection failed')
  )
  
  // Act & Assert
  await expect(service.getData()).rejects.toThrow('Database error')
})
```

### 4. Testes Assíncronos
```typescript
it('should handle async operations', async () => {
  // Use async/await para operações assíncronas
  const result = await service.asyncOperation()
  expect(result).toBeDefined()
})
```

### 5. Mock de APIs Externas
```typescript
// Mock de fetch global
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ data: 'mock' })
  })
)

// Mock de Next.js APIs
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((body, init) => ({
      status: init?.status || 200,
      json: async () => body
    }))
  }
}))
```

## Cobertura de Código

### Configuração
- **Threshold mínimo**: 80%
- **Relatório**: Gerado em `coverage/`
- **Exclusões**: Configuradas em `jest.config.js`

### Comandos
```bash
# Executar todos os testes com cobertura
npm run test:coverage

# Verificar cobertura específica
npm run test:coverage -- --coverageReporters=text-lcov | coveralls

# Gerar relatório HTML
npm run test:coverage -- --coverageReporters=html
```

## Testes de Performance

### Tipos de Testes
1. **Load Testing**: Testar sob carga
2. **Stress Testing**: Testar sob estresse
3. **Benchmarking**: Medir performance

### Exemplo
```typescript
describe('Performance Tests', () => {
  it('should handle 100 concurrent requests', async () => {
    const startTime = Date.now()
    const promises = Array(100).fill(null).map(() => 
      service.processRequest()
    )
    
    await Promise.all(promises)
    
    const duration = Date.now() - startTime
    expect(duration).toBeLessThan(5000) // 5 segundos máximo
  })
})
```

## Testes de Segurança

### Tipos de Testes
1. **Input Validation**: Validar entradas maliciosas
2. **Authentication**: Testar fluxos de autenticação
3. **Authorization**: Verificar permissões
4. **Data Exposure**: Verificar vazamento de dados

### Exemplo
```typescript
it('should sanitize user input', async () => {
  const maliciousInput = '<script>alert("xss")</script>'
  const result = await service.processInput(maliciousInput)
  
  expect(result).not.toContain('<script>')
  expect(result).toContain('<script>')
})
```

## Debug de Testes

### 1. Logs Detalhados
```typescript
// Adicionar logs para debug
console.log('Test input:', input)
console.log('Mock calls:', mockFunction.mock.calls)
```

### 2. Inspeção de Mocks
```typescript
// Verificar se mock foi chamado
expect(mockFunction).toHaveBeenCalled()
expect(mockFunction).toHaveBeenCalledWith(expectedArgs)
expect(mockFunction).toHaveBeenCalledTimes(expectedCount)
```

### 3. Debug com VS Code
- Usar extensão Jest Runner
- Adicionar breakpoints com `debugger`
- Usar `test.only` para isolar testes

## Integração Contínua

### GitHub Actions
- **Trigger**: Push e Pull Requests
- **Jobs**: Test, Performance, Security, Build
- **Notificações**: Slack/Discord em caso de falha

### Execução Local
```bash
# Executar todos os testes
npm test

# Executar em modo watch
npm run test:watch

# Executar apenas testes unitários
npm run test:unit

# Executar apenas testes de integração
npm run test:integration

# Executar apenas testes E2E
npm run test:e2e
```

## Métricas e Qualidade

### Indicadores
- **Cobertura de Código**: > 80%
- **Taxa de Sucesso**: > 95%
- **Performance**: < 5s para APIs críticas
- **Segurança**: Zero vulnerabilidades críticas

### Ferramentas
- **SonarQube**: Análise estática
- **Codecov**: Cobertura de código
- **Lighthouse**: Performance e acessibilidade

## Padrões do Projeto

### 1. Estrutura de Testes
- Cada módulo deve ter seu próprio arquivo de teste
- Testes devem ser independentes
- Usar factories para dados de teste

### 2. Mock Strategy
- Mockar dependências externas
- Usar dados realistas nos mocks
- Limpar mocks entre testes

### 3. Testes de Componentes
- Testar comportamento, não implementação
- Usar data-testid para seletores
- Testar estados de loading e erro

## Troubleshooting Comum

### 1. Problemas de Mock
```typescript
// Problema: Mock não está funcionando
// Solução: Verificar se o mock está configurado antes da importação
jest.mock('@/module', () => ({ /* mock */ }))
import { Module } from '@/module'
```

### 2. Problemas de Async
```typescript
// Problema: Teste termina antes da promise
// Solução: Usar await ou retornar a promise
it('should handle async', async () => {
  await asyncOperation()
  // ou
  return expect(asyncOperation()).resolves.toBe(expected)
})
```

### 3. Problemas de Ambiente
```typescript
// Problema: Variáveis de ambiente não definidas
// Solução: Configurar no beforeEach ou no setup
process.env.NODE_ENV = 'test'
```

## Recursos Adicionais

### Documentação
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Testing Library](https://testing-library.com/docs/)

### Ferramentas Úteis
- **Jest Runner**: Extensão VS Code
- **Playwright Test Runner**: Extensão VS Code
- **Coverage Gutters**: Visualização de cobertura

### Exemplos no Projeto
- [`src/lib/services/__tests__/subscription-intent-service.test.ts`](../src/lib/services/__tests__/subscription-intent-service.test.ts)
- [`src/__tests__/integration/checkout-iugu-api.test.ts`](../src/__tests__/integration/checkout-iugu-api.test.ts)
- [`src/__tests__/e2e/checkout-flow.spec.ts`](../src/__tests__/e2e/checkout-flow.spec.ts)

## Conclusão

Seguir este guia ajudará a manter a qualidade e consistência dos testes no projeto. Lembre-se:

1. **Testes são documentação viva** do código
2. **Cada teste deve ter um propósito claro**
3. **Mantenha os testes simples e focados**
4. **Atualize os testes quando o código mudar**
5. **Use a cobertura como guia, não como objetivo**

Para dúvidas ou sugestões de melhoria deste guia, consulte a equipe de desenvolvimento.