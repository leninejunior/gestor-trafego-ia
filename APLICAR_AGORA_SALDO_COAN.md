# 🚨 APLICAR AGORA - Correção Saldo Coan

## Passo 1: Aplicar Schema no Supabase

Acesse o **SQL Editor** do Supabase e execute:

```sql
ALTER TABLE ad_account_balances 
ADD COLUMN IF NOT EXISTS funding_source_type INTEGER,
ADD COLUMN IF NOT EXISTS funding_source_display TEXT,
ADD COLUMN IF NOT EXISTS spend_cap DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS amount_spent DECIMAL(15, 2);
```

## Passo 2: Sincronizar Saldos

Depois de aplicar o schema, execute:

```bash
# Via script
node scripts/testar-sync-com-pagamento.js

# OU via navegador
# Acesse: http://localhost:3000/api/balance/sync (método POST)
```

## Resultado Esperado

**Conta Coan**:
- ✅ Saldo: R$ 2.856,03 (antes: R$ 104,07)
- ✅ Meio de pagamento: "Saldo disponível (R$2.856,03 BRL)"
- ✅ Limite de gastos: R$ 54.100,85
- ✅ Total gasto: R$ 51.244,82

**Conta Dr Hernia Bauru**:
- ✅ Continua correto

## Por que a diferença?

O Meta Ads tem dois valores:
1. **balance** (R$ 104,07): Saldo base da conta
2. **funding_source_details.display_string** (R$ 2.856,03): Saldo + cupons/créditos promocionais

O sistema agora usa o valor correto que inclui os créditos disponíveis.
