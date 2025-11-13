# Correção do Saldo da Coan e Informações de Pagamento

## Problema Identificado

A conta **Coan** mostrava **R$ 104,07** no sistema, mas no Meta Ads aparecia **R$ 2.858,92**.

### Causa Raiz

A API do Meta retorna dois valores diferentes:
- `balance`: R$ 104,07 (saldo base em centavos: 10407)
- `funding_source_details.display_string`: "Saldo disponível (R$2.856,03 BRL)" (inclui cupons/créditos)

O sistema estava usando apenas o campo `balance`, ignorando os créditos promocionais.

## Solução Implementada

### 1. Extração do Saldo Real

Atualizado `src/app/api/balance/sync/route.ts` para:
- Buscar `funding_source_details` da API do Meta
- Extrair o saldo do `display_string` usando regex
- Usar o valor maior quando houver créditos disponíveis

```typescript
// Extrair saldo do display_string (ex: "Saldo disponível (R$2.856,03 BRL)")
const match = fundingSourceDisplay?.match(/R\$\s*([\d.,]+)/i)
if (match) {
  const displayBalance = parseFloat(match[1].replace(/\./g, '').replace(',', '.'))
  if (!isNaN(displayBalance) && displayBalance > realBalance) {
    realBalance = displayBalance
  }
}
```

### 2. Novos Campos Adicionados

**Banco de Dados** (`ad_account_balances`):
- `funding_source_type` (INTEGER): Tipo de meio de pagamento
- `funding_source_display` (TEXT): Descrição do meio de pagamento
- `spend_cap` (DECIMAL): Limite de gastos configurado
- `amount_spent` (DECIMAL): Total gasto na conta

**SQL para aplicar**:
```sql
ALTER TABLE ad_account_balances 
ADD COLUMN IF NOT EXISTS funding_source_type INTEGER,
ADD COLUMN IF NOT EXISTS funding_source_display TEXT,
ADD COLUMN IF NOT EXISTS spend_cap DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS amount_spent DECIMAL(15, 2);
```

### 3. Interface Atualizada

Componente `account-balances-widget.tsx` agora mostra:
- 💳 Meio de pagamento (ex: "Saldo disponível (R$2.856,03 BRL)")
- 💰 Limite de gastos configurado
- 💸 Total gasto na conta
- Barra de progresso baseada no spend_cap

## Dados da Conta Coan

```json
{
  "account_id": "3656912201189816",
  "name": "BM Coan",
  "balance": "10407",  // R$ 104,07
  "funding_source_details": {
    "display_string": "Saldo disponível (R$2.856,03 BRL)",
    "type": 20,
    "coupons": [
      // 4 cupons promocionais
    ]
  },
  "spend_cap": "5410085",  // R$ 54.100,85
  "amount_spent": "5124482"  // R$ 51.244,82
}
```

## Como Testar

### 1. Aplicar Schema no Supabase

Execute no SQL Editor:
```sql
ALTER TABLE ad_account_balances 
ADD COLUMN IF NOT EXISTS funding_source_type INTEGER,
ADD COLUMN IF NOT EXISTS funding_source_display TEXT,
ADD COLUMN IF NOT EXISTS spend_cap DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS amount_spent DECIMAL(15, 2);
```

### 2. Sincronizar Saldos

```bash
# Testar sincronização
node scripts/testar-sync-com-pagamento.js

# Ou via API
curl -X POST http://localhost:3000/api/balance/sync
```

### 3. Verificar no Dashboard

Acesse `/dashboard/balance` e verifique:
- ✅ Saldo da Coan deve mostrar R$ 2.856,03
- ✅ Meio de pagamento exibido
- ✅ Limite de gastos: R$ 54.100,85
- ✅ Total gasto: R$ 51.244,82

## Resultado Esperado

**Antes**:
- Coan: R$ 104,07 ❌

**Depois**:
- Coan: R$ 2.856,03 ✅
- Meio de pagamento: "Saldo disponível (R$2.856,03 BRL)" ✅
- Limite: R$ 54.100,85 ✅
- Gasto: R$ 51.244,82 ✅

## Arquivos Modificados

1. `src/app/api/balance/sync/route.ts` - Lógica de sincronização
2. `src/components/dashboard/account-balances-widget.tsx` - Interface
3. `database/add-balance-payment-info.sql` - Schema
4. `scripts/testar-sync-com-pagamento.js` - Script de teste
5. `scripts/investigar-saldo-coan.js` - Script de investigação

## Próximos Passos

1. ✅ Aplicar schema no banco
2. ✅ Sincronizar saldos
3. ✅ Verificar interface
4. 📝 Documentar para outros clientes
