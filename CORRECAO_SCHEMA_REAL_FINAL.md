# Correção do Schema Real - FINAL

## Problema Identificado
O erro 500 persistia porque havia inconsistência entre o schema esperado e o schema real da tabela `subscription_plans` no banco de dados.

## Schema Real Descoberto
Através da API de debug, descobrimos que a tabela real tem estas colunas:
```
["id","name","description","price_monthly","price_yearly","max_ad_accounts","max_users","max_clients","features","is_active","created_at","updated_at"]
```

## Diferenças Críticas
**Esperado vs Real:**
- `monthly_price` → `price_monthly` ✅ CORRIGIDO
- `annual_price` → `price_yearly` ✅ CORRIGIDO
- `max_campaigns` → NÃO EXISTE (só tem `max_ad_accounts`, `max_users`, `max_clients`)

## Correções Aplicadas

### 1. PlanManager - updatePlan()
**Antes:**
```typescript
if (updates.monthly_price !== undefined) updateData.monthly_price = updates.monthly_price;
if (updates.annual_price !== undefined) updateData.annual_price = updates.annual_price;
```

**Depois:**
```typescript
if (updates.monthly_price !== undefined) updateData.price_monthly = updates.monthly_price;
if (updates.annual_price !== undefined) updateData.price_yearly = updates.annual_price;
```

### 2. PlanManager - createPlan()
**Antes:**
```typescript
monthly_price: planData.monthly_price,
annual_price: planData.annual_price,
```

**Depois:**
```typescript
price_monthly: planData.monthly_price,
price_yearly: planData.annual_price,
```

### 3. API de Listagem
**Antes:**
```typescript
// The columns are already correctly named in the database
```

**Depois:**
```typescript
// Map database column names to frontend expected names
monthly_price: plan.price_monthly,
annual_price: plan.price_yearly,
```

## Schema Real da Tabela
```sql
CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price_monthly DECIMAL(10,2),     -- ✅ REAL
    price_yearly DECIMAL(10,2),      -- ✅ REAL
    max_ad_accounts INTEGER,         -- ✅ REAL
    max_users INTEGER,               -- ✅ REAL
    max_clients INTEGER,             -- ✅ REAL
    features JSONB,
    is_active BOOLEAN,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

## Como Testar

1. Acesse: http://localhost:3000/admin/plans
2. Clique em "Edit Plan" em qualquer plano
3. Modifique algum campo (nome, descrição, preço)
4. Clique em "Update Plan"

## Resultado Esperado
- ✅ Não deve mais aparecer erro 500
- ✅ Não deve mais aparecer "Could not find column"
- ✅ Plano deve ser atualizado com sucesso
- ✅ Dados devem ser salvos corretamente no banco

## Logs para Verificar
O servidor deve mostrar:
```
✅ Plan ID found: [uuid]
✅ Data validated successfully
✅ Plan updated successfully
```

## API de Debug Criada
- `/api/debug/check-table-schema` - Verifica a estrutura real da tabela
- Útil para identificar problemas de schema no futuro