# Correção Final - Saldo Real das Contas Meta ✅

## Problema
Sistema mostrava dados mockados e não buscava saldo real. Erro 500 ao clicar em "Sincronizar".

## Causa Raiz
API de sincronização estava usando tabela e estrutura **erradas**:

1. ❌ Buscava de `meta_connections` (não existe)
2. ❌ Assumia array de contas `selected_ad_account_ids[]`
3. ❌ Campo de status errado

## Estrutura Correta

### Tabela: `client_meta_connections`

```sql
client_meta_connections:
  - id
  - client_id
  - ad_account_id (TEXT) -- UMA conta por conexão
  - access_token
  - account_name
  - currency
  - is_active (BOOLEAN)
  - status
  - created_at
  - updated_at
```

**Importante**: Cada conexão tem **UMA** conta, não um array!

## Correções Aplicadas

### 1. Tabela Correta
```typescript
// ❌ ANTES
.from('meta_connections')
.eq('status', 'active')

// ✅ DEPOIS
.from('client_meta_connections')
.eq('is_active', true)
```

### 2. Processamento de Conta
```typescript
// ❌ ANTES - Assumia array
const accountIds = connection.selected_ad_account_ids || []
for (const accountId of accountIds) { ... }

// ✅ DEPOIS - Uma conta por conexão
const accountId = connection.ad_account_id
if (accountId) { ... }
```

## Como Funciona Agora

1. **Busca Conexões**: `client_meta_connections WHERE is_active = true`
2. **Para cada conexão**:
   - Pega `ad_account_id` (uma conta)
   - Busca saldo real da API do Meta
   - Calcula status (healthy/warning/critical)
   - Salva em `ad_account_balances`
3. **Retorna**: Número de contas sincronizadas

## Testar Agora

### Via Interface
```
1. Acesse: http://localhost:3000/dashboard/balance
2. Clique em "Sincronizar Saldo Real"
3. Aguarde (deve funcionar sem erro 500)
4. Veja os saldos reais aparecerem
```

### Via Terminal
```bash
# Verificar conexões
node scripts/verificar-estrutura-client-meta.js

# Sincronizar
curl -X POST http://localhost:3000/api/balance/sync
```

## Dados Buscados

Para cada conta, o sistema busca da API do Meta:

1. **Informações Básicas**:
   - Nome da conta
   - Moeda (currency)
   - Saldo atual (balance)
   - Limite de gasto (spend_cap)
   - Limite diário (daily_spend_limit)

2. **Insights (últimos 7 dias)**:
   - Gasto total
   - Gasto médio diário

3. **Cálculos**:
   - Projeção de dias restantes
   - Status (healthy/warning/critical)

## Status das Contas

- 🟢 **Healthy**: Saldo > 40% do limite, projeção > 7 dias
- 🟡 **Warning**: Saldo 20-40% do limite, projeção 3-7 dias
- 🔴 **Critical**: Saldo < 20% ou zerado, projeção < 3 dias

## Arquivos Modificados

- ✅ `src/app/api/balance/sync/route.ts` - Corrigido
- ✅ `scripts/verificar-estrutura-client-meta.js` - Novo
- ✅ `scripts/debug-erro-500-sync.js` - Novo

## Próxima Ação

**Clique em "Sincronizar Saldo Real" novamente!** Agora deve funcionar e mostrar os saldos reais de TODAS as contas conectadas. 🚀
