# Correção do Schema de Planos - FINAL

## Problema Identificado
O erro 500 "Failed to update subscription plan" estava ocorrendo porque:
- O PlanManager estava tentando usar colunas que não existem na tabela `subscription_plans`
- Havia mapeamento incorreto entre os nomes das colunas do frontend e do banco de dados

## Correções Aplicadas

### 1. PlanManager - Método updatePlan()
**Antes:**
```typescript
if (updates.annual_price !== undefined) updateData.annual_price = updates.annual_price;
if (updates.limits) updateData.limits = updates.limits;
if (updates.is_popular !== undefined) updateData.is_popular = updates.is_popular;
```

**Depois:**
```typescript
if (updates.annual_price !== undefined) updateData.annual_price = updates.annual_price;
if (updates.limits) {
  // Map limits to the correct column names
  if (updates.limits.clients !== undefined) updateData.max_clients = updates.limits.clients;
  if (updates.limits.campaigns !== undefined) updateData.max_campaigns = updates.limits.campaigns;
}
// Note: is_popular is not in the current schema, so we'll skip it for now
```

### 2. PlanManager - Método createPlan()
- Corrigido mapeamento de `limits` para `max_clients` e `max_campaigns`
- Removido campo `is_popular` que não existe no schema

### 3. API de Listagem de Planos
**Antes:**
```typescript
monthly_price: plan.price_monthly,
annual_price: plan.price_yearly,
```

**Depois:**
```typescript
// The columns are already correctly named in the database
limits: {
  clients: plan.max_clients,
  campaigns: plan.max_campaigns,
  // Add default values for fields that might not exist
  users: 1,
  api_calls: 10000,
  storage_gb: 10
},
```

## Schema Real da Tabela subscription_plans
```sql
CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    monthly_price DECIMAL(10,2) NOT NULL DEFAULT 0,  -- ✅ Correto
    annual_price DECIMAL(10,2) NOT NULL DEFAULT 0,   -- ✅ Correto
    features JSONB NOT NULL DEFAULT '{}',
    max_clients INTEGER NOT NULL DEFAULT 0,          -- ✅ Mapeado corretamente
    max_campaigns INTEGER NOT NULL DEFAULT 0,        -- ✅ Mapeado corretamente
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Como Testar

1. Acesse: http://localhost:3000/admin/plans
2. Clique em "Edit Plan" em qualquer plano
3. Modifique algum campo (nome, descrição, preço, limites)
4. Clique em "Update Plan"

## Resultado Esperado
- ✅ Não deve mais aparecer erro 500
- ✅ Plano deve ser atualizado com sucesso
- ✅ Dados devem ser salvos corretamente no banco

## Logs para Verificar
O servidor deve mostrar:
```
✅ Plan ID found: [uuid]
✅ Data validated successfully
✅ Plan updated successfully
```

## Próximos Passos
Se ainda houver problemas:
1. Verificar se a tabela `subscription_plans` existe no Supabase
2. Verificar se há planos cadastrados na tabela
3. Verificar logs do servidor para identificar outros erros