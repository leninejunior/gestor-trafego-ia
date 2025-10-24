# Correção: Subscriptions Analytics API

## Problema Identificado

Erro 500 na API `/api/admin/subscriptions/analytics`:
```
Failed to load resource: the server responded with a status of 500 (Internal Server Error)
```

## Causa Raiz

A API estava usando nomes incorretos de foreign keys no Supabase:
- ❌ `subscription_plans!subscriptions_plan_id_fkey`
- ❌ `organizations!subscriptions_organization_id_fkey`

## Solução Aplicada

### 1. Correção da Query Supabase

O problema era que o Supabase não conseguia fazer joins automáticos. A solução foi buscar os dados separadamente e fazer o join manualmente no código.

**Antes (com joins que falhavam):**
```typescript
supabase
  .from('subscriptions')
  .select(`
    *,
    subscription_plans:plan_id (
      name,
      monthly_price,
      annual_price
    ),
    organizations:organization_id (
      name
    )
  `)
```

**Depois (queries separadas + join manual):**
```typescript
// Buscar dados separadamente
const [subscriptions, invoices, organizations, plans] = await Promise.all([
  supabase.from('subscriptions').select('*'),
  supabase.from('subscription_invoices').select('*').eq('status', 'paid'),
  supabase.from('organizations').select('id, name, created_at'),
  supabase.from('subscription_plans').select('*').eq('is_active', true)
]);

// Criar maps para joins eficientes
const plansMap = new Map(plans.map(p => [p.id, p]));
const orgsMap = new Map(organizations.map(o => [o.id, o]));

// Enriquecer subscriptions com dados relacionados
const enrichedSubscriptions = subscriptions.map(sub => ({
  ...sub,
  subscription_plans: plansMap.get(sub.plan_id),
  organizations: orgsMap.get(sub.organization_id)
}));
```

### 2. Melhor Tratamento de Erros

Adicionado tratamento individual de erros para cada query:
```typescript
const [
  { data: subscriptions, error: subsError },
  { data: invoices, error: invoicesError },
  { data: organizations, error: orgsError },
  { data: plans, error: plansError }
] = await Promise.all([...]);

// Check for errors
if (subsError) {
  console.error('Subscriptions query error:', subsError);
  throw new Error(`Failed to fetch subscriptions: ${subsError.message}`);
}
// ... outros checks
```

### 3. Nova Página de Subscriptions

Criada página completa em `/admin/subscriptions` com:

#### KPIs Principais
- **MRR** (Monthly Recurring Revenue)
- **ARR** (Annual Recurring Revenue)
- **Assinaturas Ativas**
- **Taxa de Churn**

#### Abas de Análise
1. **Visão Geral**
   - Status das assinaturas
   - Ciclo de cobrança
   - Métricas adicionais (receita, conversão, CLV)

2. **Planos**
   - Distribuição por plano
   - Contagem de assinaturas por plano

3. **Recentes**
   - Últimas 10 assinaturas criadas
   - Detalhes de organização, plano e status

#### Filtros de Período
- 7 dias
- 30 dias
- 90 dias

## Arquivos Modificados

1. ✅ `src/app/api/admin/subscriptions/analytics/route.ts`
   - Corrigido nomes de foreign keys
   - Melhorado tratamento de erros
   - Adicionado logs detalhados

2. ✅ `src/app/admin/subscriptions/page.tsx` (NOVO)
   - Interface completa de analytics
   - Visualização de KPIs
   - Gráficos e tabelas
   - Filtros de período

## Como Testar

1. Acesse como admin: `http://localhost:3000/admin/subscriptions`
2. Verifique os KPIs principais
3. Navegue pelas abas de análise
4. Teste os filtros de período (7, 30, 90 dias)

## Métricas Disponíveis

- **MRR**: Receita recorrente mensal
- **ARR**: Receita recorrente anual
- **Assinaturas Ativas**: Total de assinaturas ativas
- **Taxa de Churn**: Percentual de cancelamentos
- **Taxa de Conversão**: Organizações com assinatura vs total
- **Receita no Período**: Total faturado no período selecionado
- **CLV**: Customer Lifetime Value médio
- **Distribuição por Status**: active, past_due, canceled, trialing
- **Distribuição por Plano**: Basic, Pro, Enterprise
- **Distribuição por Ciclo**: monthly, annual

## Próximos Passos

1. Adicionar gráficos visuais (charts)
2. Exportar relatórios em PDF/Excel
3. Alertas automáticos para métricas críticas
4. Comparação período a período
5. Previsão de receita (forecasting)
