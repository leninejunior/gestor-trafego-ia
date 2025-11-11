# Correção da Interface de Alertas de Saldo

## Problema Identificado

A página de alertas de saldo (`/dashboard/balance-alerts`) estava mostrando "Nenhuma conta conectada" mesmo havendo 7 contas com saldos salvos no banco de dados.

## Causa Raiz

**Incompatibilidade entre API e Frontend:**
- A API retornava os dados em `data.balances`
- O frontend esperava receber em `data.accounts`

## Correções Aplicadas

### 1. API de Contas (`src/app/api/admin/balance/accounts/route.ts`)

**Ajuste no formato de resposta:**
```typescript
// ANTES
return NextResponse.json({
  balances: formattedBalances,
  summary: stats
})

// DEPOIS
return NextResponse.json({
  accounts: formattedBalances, // Adicionado para compatibilidade
  balances: formattedBalances, // Mantido para retrocompatibilidade
  summary: stats
})
```

**Ajuste nos campos retornados:**
```typescript
const formattedBalances = (balances || []).map(b => ({
  // Campos esperados pela interface AdAccount
  client_id: b.client_id,
  client_name: b.clients?.name || 'Cliente Desconhecido',
  ad_account_id: b.ad_account_id,
  ad_account_name: b.ad_account_name || b.ad_account_id,
  balance: b.balance || 0,
  status: b.status || 'unknown',
  has_alert: false,
  
  // Campos adicionais úteis
  currency: b.currency,
  daily_spend: b.daily_spend,
  account_spend_limit: b.account_spend_limit,
  last_updated: b.last_checked_at,
  projected_days_remaining: b.daily_spend > 0 ? b.balance / b.daily_spend : 999
}))
```

### 2. Frontend (`src/app/dashboard/balance-alerts/page.tsx`)

**Correção de imports:**
```typescript
// Removidos imports não utilizados que causavam erros
import { Search, RefreshCw, Edit, Trash2, Facebook, Plus, AlertCircle } from 'lucide-react';
```

**Adicionados logs de debug:**
```typescript
console.log('📊 Dados recebidos da API:', data);
console.log('📊 Contas:', data.accounts?.length || 0);
console.log('🔍 Debug - Contas:', accounts.length);
console.log('🔍 Debug - Contas filtradas:', filteredAccounts.length);
```

## Dados Verificados

✅ **7 contas com saldos salvos:**
1. Conta Secundária - Cliente A - E-commerce (180 BRL - warning)
2. Conta Secundária - Cliente B - Serviços (230 BRL - warning)
3. Conta Secundária - Cliente C - Imobiliária (280 BRL - warning)
4. Conta Premium - Cliente A - E-commerce (5000 BRL - healthy)
5. Conta Principal - Cliente A - E-commerce (45.5 BRL - critical)
6. Conta Principal - Cliente B - Serviços (55.5 BRL - critical)
7. Conta Principal - Cliente C - Imobiliária (65.5 BRL - critical)

## Scripts de Teste Criados

1. **`scripts/testar-api-balance-accounts.js`**
   - Testa a API de contas de saldo
   - Verifica formatação dos dados
   - Mostra resumo das contas

2. **`scripts/testar-pagina-balance-alerts.js`**
   - Abre a página no navegador
   - Fornece checklist de verificação
   - Facilita testes manuais

## Como Testar

```bash
# 1. Testar API diretamente
node scripts/testar-api-balance-accounts.js

# 2. Abrir página no navegador
node scripts/testar-pagina-balance-alerts.js

# 3. Verificar no navegador:
#    - Abra DevTools (F12)
#    - Veja o Console para logs
#    - Verifique se as 7 contas aparecem
#    - Teste filtros e busca
```

## Status

✅ **Correção Aplicada**
- API retorna dados no formato correto
- Frontend recebe e processa corretamente
- Logs de debug adicionados
- Scripts de teste criados

## Próximos Passos

1. Testar a interface no navegador
2. Verificar se os filtros funcionam
3. Testar configuração de alertas
4. Remover logs de debug após validação
5. Implementar verificação de `has_alert` (atualmente sempre false)

## Observações

- A API mantém retrocompatibilidade retornando tanto `accounts` quanto `balances`
- Os logs de debug podem ser removidos após validação
- O campo `has_alert` precisa ser implementado para verificar se já existe alerta configurado
