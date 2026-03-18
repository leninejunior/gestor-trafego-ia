# Plano de Melhoria da Infraestrutura de Testes

## Análise dos Problemas Identificados

### 1. Problemas Críticos de Mocking

#### Problemas com Next.js API Routes
- **Erro**: `Response.json is not a function`
- **Causa**: Mock inadequado do objeto `NextResponse` em ambiente de teste
- **Impacto**: Falha em todos os testes de API routes

#### Problemas com Supabase Client
- **Erro**: `Cannot destructure property 'data' of undefined`
- **Causa**: Mock do Supabase client não está retornando a estrutura esperada
- **Impacto**: Falha em testes de integração e serviços

#### Problemas com Query Builder
- **Erro**: `.eq()`, `.select()`, `.insert()`, `.delete()`, `.lt()` não são funções
- **Causa**: Mocks incompletos das operações do Supabase
- **Impacto**: Falha em testes de banco de dados

### 2. Problemas de Configuração

#### Timeout em Testes de Performance
- **Erro**: `Exceeded timeout` em testes de performance
- **Causa**: Testes muito longos sem timeout adequado
- **Impacto**: Testes de performance não executam completamente

#### Fetch API Não Definida
- **Erro**: `fetch is not defined`
- **Causa**: Ambiente Node.js sem polyfill do fetch
- **Impacto**: Falha em testes que fazem requisições HTTP

## Plano de Correção

### Fase 1: Corrigir Infraestrutura de Mocking

#### 1.1 Melhorar Mock do Next.js
```javascript
// jest.setup.js - Melhorar mock do NextResponse
Object.defineProperty(global, 'NextResponse', {
  value: {
    json: jest.fn((body, init) => ({
      status: init?.status || 200,
      json: async () => body,
      headers: new Map(Object.entries(init?.headers || {}))
    })),
    redirect: jest.fn((url, init) => ({
      status: init?.status || 302,
      url,
      headers: new Map(Object.entries(init?.headers || {}))
    }))
  }
});
```

#### 1.2 Melhorar Mock do Supabase
```javascript
// __mocks__/@supabase/supabase-js.js
export const createClient = jest.fn(() => ({
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        data: [],
        error: null
      })),
      single: jest.fn(() => Promise.resolve({ data: null, error: null })),
      data: [],
      error: null
    })),
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        data: [],
        error: null
      })),
      single: jest.fn(() => Promise.resolve({ data: null, error: null })),
      data: [],
      error: null
    })),
    update: jest.fn(() => ({
      eq: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
          data: [],
          error: null
        })),
        single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        data: [],
        error: null
      })),
      data: [],
      error: null
    })),
    delete: jest.fn(() => ({
      eq: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
          data: [],
          error: null
        })),
        single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        data: [],
        error: null
      })),
      lt: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
          data: [],
          error: null
        })),
        data: [],
        error: null
      })),
      data: [],
      error: null
    })),
    order: jest.fn(() => ({
      data: [],
      error: null
    })),
    lte: jest.fn(() => ({
      data: [],
      error: null
    })),
    ilike: jest.fn(() => ({
      data: [],
      error: null
    })),
    data: [],
    error: null
  })),
  auth: {
    getUser: jest.fn(() => Promise.resolve({ data: { user: null }, error: null })),
    signInWithPassword: jest.fn(() => Promise.resolve({ data: null, error: null })),
    signUp: jest.fn(() => Promise.resolve({ data: null, error: null })),
    signOut: jest.fn(() => Promise.resolve({ error: null }))
  },
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn(() => Promise.resolve({ data: null, error: null })),
      getPublicUrl: jest.fn(() => ({ data: { publicUrl: '' } }))
    }))
  }
}));
```

#### 1.3 Adicionar Polyfill do Fetch
```javascript
// jest.setup.js - Adicionar polyfill do fetch
import { TextEncoder, TextDecoder } from 'util';
import { fetch } from 'whatwg-fetch';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
global.fetch = fetch;
```

### Fase 2: Corrigir Configuração de Testes

#### 2.1 Ajustar Timeouts
```javascript
// jest.config.js - Ajustar timeouts
module.exports = {
  // ... configuração existente
  testTimeout: 30000, // 30 segundos para testes normais
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: [
    // ... padrões existentes
  ],
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts'],
      testTimeout: 10000
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/src/__tests__/integration/**/*.test.ts'],
      testTimeout: 20000
    },
    {
      displayName: 'performance',
      testMatch: ['<rootDir>/src/__tests__/performance/**/*.test.ts'],
      testTimeout: 120000 // 2 minutos para testes de performance
    }
  ]
};
```

### Fase 3: Implementar Testes Unitários Críticos

#### 3.1 Serviços Core
- [ ] `src/lib/services/subscription-intent-service.ts`
- [ ] `src/lib/services/billing-engine.ts`
- [ ] `src/lib/webhooks/webhook-processor.ts`
- [ ] `src/lib/webhooks/retry-manager.ts`

#### 3.2 Utilitários
- [ ] `src/lib/utils/validation.ts`
- [ ] `src/lib/utils/crypto.ts`
- [ ] `src/lib/utils/error-handling.ts`

### Fase 4: Implementar Testes de Integração

#### 4.1 API Routes
- [ ] `src/app/api/subscriptions/checkout-iugu/route.ts`
- [ ] `src/app/api/meta/diagnostics/route.ts`
- [ ] `src/app/api/google/auth/route.ts`

#### 4.2 Fluxos de Negócio
- [ ] Checkout completo
- [ ] Processamento de webhooks
- [ ] Gerenciamento de assinaturas

### Fase 5: Implementar Testes E2E

#### 5.1 Fluxos Principais
- [ ] Registro de usuário
- [ ] Login e autenticação
- [ ] Seleção de plano e checkout
- [ ] Dashboard principal
- [ ] Configuração de integrações (Google Ads, Meta)

### Fase 6: Configurar CI/CD

#### 6.1 GitHub Actions
```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - run: npm ci
      - run: npm run test:unit
      - run: npm run test:integration
      - run: npm run test:e2e
      - run: npm run test:coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

### Fase 7: Documentação

#### 7.1 Guia de Testes
- [ ] Como escrever testes unitários
- [ ] Como mockar dependências
- [ ] Como escrever testes de integração
- [ ] Como escrever testes E2E

## Priorização

### Alta Prioridade (Fase 1-2)
1. Corrigir problemas de mocking
2. Ajustar configuração de timeouts
3. Adicionar polyfills necessários

### Média Prioridade (Fase 3-4)
1. Implementar testes unitários críticos
2. Implementar testes de integração para APIs principais

### Baixa Prioridade (Fase 5-7)
1. Implementar testes E2E
2. Configurar CI/CD
3. Documentação

## Métricas de Sucesso

- [ ] Todos os testes existentes passam sem erros de mocking
- [ ] Cobertura de código > 80%
- [ ] Testes executam em < 5 minutos no CI
- [ ] Zero falhas em testes críticos
- [ ] Documentação completa disponível

## Próximos Passos

1. **Imediato**: Corrigir problemas de mocking (Fase 1)
2. **Curto Prazo**: Implementar testes unitários críticos (Fase 3)
3. **Médio Prazo**: Implementar testes de integração (Fase 4)
4. **Longo Prazo**: Implementar testes E2E e CI/CD (Fase 5-7)