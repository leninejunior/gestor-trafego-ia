# Correção: Orçamento NaN nas Campanhas

## Problema Identificado

Na página do cliente, o orçamento das campanhas estava aparecendo como "NaN" (Not a Number).

## Causa Raiz

No componente `CampaignsList`, quando campanhas externas eram passadas como props, havia uma conversão incorreta:

```typescript
// ❌ ERRADO - Estava usando 'spend' ao invés de 'daily_budget'
daily_budget: String(Math.round(c.spend * 100))
```

O problema era que:
1. A API retorna campanhas com `daily_budget` já no formato correto (string em centavos)
2. O código estava tentando converter `c.spend` (que não existe ou é undefined)
3. `Math.round(undefined * 100)` resulta em `NaN`
4. `String(NaN)` resulta em `"NaN"`
5. `parseFloat("NaN")` resulta em `NaN`
6. Formatação de moeda com `NaN` exibe "NaN"

## Correções Aplicadas

### 1. CampaignsList Component (`src/components/meta/campaigns-list.tsx`)

**Correção na conversão de campanhas externas:**
```typescript
// ✅ CORRETO - Usar os valores que já vêm da API
daily_budget: c.daily_budget, // Já vem no formato correto da API
lifetime_budget: c.lifetime_budget,
```

**Proteção adicional na formatação de moeda:**
```typescript
const formatCurrency = (value: string | undefined) => {
  if (!value) return '-';
  const numValue = parseFloat(value);
  if (isNaN(numValue)) return '-'; // ✅ Proteção contra NaN
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(numValue / 100);
};
```

### 2. BudgetEditDialog Component (`src/components/meta/budget-edit-dialog.tsx`)

**Proteção contra NaN ao inicializar valores:**
```typescript
const dailyValue = currentDailyBudget ? parseFloat(currentDailyBudget) : NaN;
const lifetimeValue = currentLifetimeBudget ? parseFloat(currentLifetimeBudget) : NaN;

setDailyBudget(
  !isNaN(dailyValue) ? (dailyValue / 100).toFixed(2) : ''
);
setLifetimeBudget(
  !isNaN(lifetimeValue) ? (lifetimeValue / 100).toFixed(2) : ''
);
```

## Sobre o Erro do Console

O erro mencionado:
```
content_script.js:1 Uncaught TypeError: Cannot read properties of undefined (reading 'control')
```

Este erro é de uma **extensão do navegador** (content_script.js), não do nosso código. Extensões como gerenciadores de senha, preenchimento automático, etc., podem causar esses erros ao tentar interagir com campos de formulário. Não afeta a funcionalidade da aplicação.

## Resultado

✅ Orçamentos agora são exibidos corretamente em formato de moeda brasileira (R$)
✅ Proteção contra valores inválidos implementada
✅ Código mais robusto e resiliente a dados inconsistentes

## Teste

Para testar:
1. Acesse a página de um cliente com campanhas Meta Ads conectadas
2. Verifique se os orçamentos aparecem no formato "R$ XX,XX"
3. Clique em "Orçamento" para editar - os valores devem aparecer corretamente no diálogo
