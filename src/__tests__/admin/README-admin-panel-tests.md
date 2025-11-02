# Testes do Painel Administrativo - Subscription Intents

Este diretório contém testes abrangentes para o painel administrativo de gestão de subscription intents, cobrindo todas as funcionalidades e requisitos especificados.

## Estrutura dos Testes

### 1. Testes de Componentes (`subscription-intents-admin-panel.test.tsx`)
- **Escopo**: Testa componentes React individuais
- **Cobertura**: 
  - Renderização de componentes
  - Interações do usuário
  - Estados de loading e erro
  - Validação de props
  - Acessibilidade

### 2. Testes de API (`../api/admin/subscription-intents-api.test.ts`)
- **Escopo**: Testa endpoints administrativos
- **Cobertura**:
  - Autenticação e autorização
  - Validação de dados
  - Operações CRUD
  - Tratamento de erros
  - Performance

### 3. Testes de Integração (`../integration/admin-panel-integration.test.ts`)
- **Escopo**: Testa fluxos completos
- **Cobertura**:
  - Integração entre componentes e APIs
  - Fluxos de dados complexos
  - Consistência de estado
  - Recuperação de erros

### 4. Testes E2E (`../e2e/admin-subscription-intents.spec.ts`)
- **Escopo**: Testa experiência completa do usuário
- **Cobertura**:
  - Navegação entre páginas
  - Fluxos de trabalho reais
  - Responsividade
  - Acessibilidade

## Funcionalidades Testadas

### Gestão de Subscription Intents
- ✅ Listagem com filtros e paginação
- ✅ Visualização de detalhes completos
- ✅ Ações administrativas (ativar, cancelar, reenviar)
- ✅ Busca por múltiplos critérios
- ✅ Ordenação e filtros avançados

### Analytics e Relatórios
- ✅ Métricas de conversão e abandono
- ✅ Gráficos de tendência
- ✅ Performance por plano
- ✅ Exportação de dados (CSV/JSON)
- ✅ Atualização em tempo real

### Segurança e Permissões
- ✅ Validação de permissões de admin
- ✅ Controle de acesso por role
- ✅ Sanitização de dados
- ✅ Auditoria de ações

### Experiência do Usuário
- ✅ Interface responsiva
- ✅ Estados de loading
- ✅ Tratamento de erros
- ✅ Acessibilidade (WCAG)
- ✅ Navegação por teclado

## Executando os Testes

### Testes Unitários e de Integração
```bash
# Todos os testes
npm test

# Testes específicos do admin
npm test -- --testPathPattern=admin

# Com coverage
npm test -- --coverage
```

### Testes E2E
```bash
# Executar testes E2E
npx playwright test admin-subscription-intents

# Com interface gráfica
npx playwright test --ui
```

## Mocks e Fixtures

### Dados de Teste
- `mockSubscriptionIntents`: Lista de intents para testes
- `mockIntentDetails`: Detalhes completos de um intent
- `mockAnalytics`: Dados de analytics e métricas
- `mockUser`: Usuário admin para autenticação

### APIs Mockadas
- Supabase client com todas as operações
- Endpoints administrativos
- Serviços de integração (Iugu)
- Notificações e emails

## Cobertura de Requisitos

### Requirements 3.1, 3.2, 3.3 (Gestão Administrativa)
- ✅ Interface de gestão de intents
- ✅ Visualização detalhada
- ✅ Ações administrativas
- ✅ Ferramentas de troubleshooting

### Requirements 6.1, 6.2, 6.3 (Analytics)
- ✅ Métricas de conversão
- ✅ Gráficos de receita
- ✅ Análise de performance
- ✅ Dashboards em tempo real

### Requirement 6.4 (Testes)
- ✅ Testes de funcionalidades admin
- ✅ Testes de permissões e segurança
- ✅ Testes de geração de relatórios
- ✅ Validação de exports

## Cenários de Teste Críticos

### 1. Fluxo de Ativação Manual
```typescript
test('deve ativar subscription intent manualmente', async () => {
  // 1. Listar intents pendentes
  // 2. Selecionar intent específico
  // 3. Executar ação de ativação
  // 4. Verificar mudança de status
  // 5. Confirmar criação de usuário
});
```

### 2. Exportação de Dados
```typescript
test('deve exportar analytics em CSV', async () => {
  // 1. Navegar para analytics
  // 2. Configurar filtros de período
  // 3. Iniciar exportação
  // 4. Verificar formato e conteúdo
  // 5. Validar integridade dos dados
});
```

### 3. Tratamento de Erros
```typescript
test('deve tratar falha na API graciosamente', async () => {
  // 1. Simular erro de rede
  // 2. Verificar mensagem de erro
  // 3. Testar opção de retry
  // 4. Validar recuperação
});
```

## Métricas de Qualidade

### Cobertura de Código
- **Meta**: >90% de cobertura
- **Componentes**: 95%+
- **APIs**: 90%+
- **Integração**: 85%+

### Performance
- **Tempo de resposta**: <2s para listagem
- **Renderização**: <500ms para componentes
- **Exportação**: <10s para datasets médios

### Acessibilidade
- **WCAG 2.1 AA**: Conformidade completa
- **Navegação por teclado**: 100% funcional
- **Screen readers**: Compatibilidade total

## Troubleshooting

### Problemas Comuns

1. **Testes falhando por timeout**
   - Aumentar timeout nos mocks
   - Verificar promises não resolvidas

2. **Mocks não funcionando**
   - Verificar ordem de importação
   - Limpar mocks entre testes

3. **Testes E2E instáveis**
   - Adicionar waits explícitos
   - Verificar seletores únicos

### Debug
```bash
# Debug testes unitários
npm test -- --verbose --no-cache

# Debug testes E2E
npx playwright test --debug
```

## Contribuindo

### Adicionando Novos Testes
1. Seguir padrões existentes
2. Incluir casos de erro
3. Testar acessibilidade
4. Documentar cenários complexos

### Atualizando Testes
1. Manter compatibilidade
2. Atualizar mocks conforme necessário
3. Verificar cobertura não diminui
4. Testar em diferentes ambientes