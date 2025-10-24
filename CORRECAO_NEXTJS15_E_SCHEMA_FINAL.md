# Correção Next.js 15 e Schema - FINAL

## Problemas Identificados

### 1. Next.js 15 - Params como Promise
**Erro:** `params` is a Promise and must be unwrapped with `await`
**Causa:** No Next.js 15, os parâmetros de rota são Promises que precisam ser aguardadas

### 2. Coluna Inexistente
**Erro:** Could not find the 'max_campaigns' column
**Causa:** A tabela real não tem a coluna `max_campaigns`

## Schema Real da Tabela
```
["id","name","description","price_monthly","price_yearly","max_ad_accounts","max_users","max_clients","features","is_active","created_at","updated_at"]
```

## Correções Aplicadas

### 1. Correção do Next.js 15 - Params como Promise

**Antes:**
```typescript
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const planId = extractPlanId(params, request);
}

function extractPlanId(params: { id?: string }, request: NextRequest): string | null {
  let planId = params?.id;
}
```

**Depois:**
```typescript
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const planId = await extractPlanId(params, request);
}

async function extractPlanId(params: Promise<{ id?: string }>, request: NextRequest): Promise<string | null> {
  const resolvedParams = await params;
  let planId = resolvedParams?.id;
}
```

### 2. Correção das Colunas do Schema

**Antes:**
```typescript
if (updates.limits.campaigns !== undefined) updateData.max_campaigns = updates.limits.campaigns;
```

**Depois:**
```typescript
if (updates.limits.clients !== undefined) updateData.max_clients = updates.limits.clients;
if (updates.limits.users !== undefined) updateData.max_users = updates.limits.users;
if (updates.limits.ad_accounts !== undefined) updateData.max_ad_accounts = updates.limits.ad_accounts;
// Note: max_campaigns doesn't exist in the current schema, so we skip it
```

## Mapeamento Correto das Colunas

| Frontend | Database | Status |
|----------|----------|--------|
| `monthly_price` | `price_monthly` | ✅ CORRIGIDO |
| `annual_price` | `price_yearly` | ✅ CORRIGIDO |
| `limits.clients` | `max_clients` | ✅ CORRIGIDO |
| `limits.users` | `max_users` | ✅ CORRIGIDO |
| `limits.ad_accounts` | `max_ad_accounts` | ✅ CORRIGIDO |
| `limits.campaigns` | ❌ NÃO EXISTE | ✅ REMOVIDO |

## Como Testar

1. Acesse: http://localhost:3000/admin/plans
2. Clique em "Edit Plan" em qualquer plano
3. Modifique algum campo (nome, descrição, preço, limites)
4. Clique em "Update Plan"

## Resultado Esperado
- ✅ Não deve mais aparecer erro sobre `params` Promise
- ✅ Não deve mais aparecer erro sobre `max_campaigns` column
- ✅ Plano deve ser atualizado com sucesso
- ✅ Dados devem ser salvos corretamente no banco

## Logs para Verificar
O servidor deve mostrar:
```
✅ Plan ID found: [uuid]
✅ Data validated successfully
✅ Plan updated successfully
```

## Arquivos Corrigidos
- ✅ `src/app/api/admin/plans/[id]/route.ts` - Correção do Next.js 15
- ✅ `src/lib/services/plan-manager.ts` - Correção do schema
- ✅ `src/app/api/admin/plans/route.ts` - Mapeamento correto