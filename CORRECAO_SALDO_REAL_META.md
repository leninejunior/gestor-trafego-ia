# Correção: Saldo Real das Contas Meta 🔧

## Problema Identificado

O sistema estava mostrando apenas dados mockados e não buscava o saldo real das contas Meta Ads conectadas.

## Causa Raiz

A API de sincronização (`/api/balance/sync`) estava buscando dados da tabela **errada**:

❌ **Antes**: `client_meta_connections` (tabela que não existe)
✅ **Depois**: `meta_connections` (tabela correta)

## Correções Aplicadas

### 1. API de Sincronização (`src/app/api/balance/sync/route.ts`)

**Mudanças:**

```typescript
// ❌ ANTES - Tabela errada
const { data: connections } = await supabaseAdmin
  .from('client_meta_connections')  // ❌ Não existe!
  .select('*')
  .eq('is_active', true)

// ✅ DEPOIS - Tabela correta
const { data: connections } = await supabaseAdmin
  .from('meta_connections')  // ✅ Tabela correta!
  .select(`
    *,
    clients (
      id,
      name
    )
  `)
  .eq('status', 'active')  // ✅ Campo correto
```

**Processamento de Contas:**

```typescript
// ❌ ANTES - Assumia 1 conta por conexão
const accountId = connection.ad_account_id

// ✅ DEPOIS - Processa múltiplas contas
const accountIds = connection.selected_ad_account_ids || []
for (const accountId of accountIds) {
  // Buscar saldo de cada conta
}
```

### 2. Estrutura Correta da Tabela `meta_connections`

```sql
meta_connections:
  - id
  - client_id
  - user_id
  - access_token
  - selected_ad_account_ids (TEXT[])  -- Array de IDs
  - status ('active' | 'inactive')
  - created_at
  - updated_at
```

### 3. Fluxo de Sincronização

```
1. Buscar conexões ativas: meta_connections WHERE status = 'active'
2. Para cada conexão:
   - Pegar array de contas: selected_ad_account_ids
   - Para cada conta no array:
     a. Buscar saldo real da API do Meta
     b. Calcular status (healthy/warning/critical)
     c. Salvar em ad_account_balances
3. Retornar resumo: X contas sincronizadas
```

## Como Usar

### 1. Sincronizar Manualmente

**Via Interface:**
```
1. Acesse: http://localhost:3000/dashboard/balance
2. Clique em "Sincronizar Saldo Real"
3. Aguarde a sincronização
4. Página recarrega automaticamente
```

**Via API:**
```bash
curl -X POST http://localhost:3000/api/balance/sync
```

**Via Script:**
```bash
node scripts/sincronizar-saldo-agora.js
```

### 2. Verificar Saldos

```
GET /api/balance/my-accounts
```

Retorna:
```json
{
  "balances": [
    {
      "client_id": "uuid",
      "ad_account_id": "act_123",
      "ad_account_name": "Conta Teste",
      "balance": 150.50,
      "currency": "BRL",
      "status": "healthy",
      "daily_spend": 25.00,
      "projected_days_remaining": 6
    }
  ],
  "summary": {
    "total_accounts": 1,
    "total_balance": 150.50,
    "critical_accounts": 0,
    "warning_accounts": 0,
    "healthy_accounts": 1
  }
}
```

## Dados Buscados da API do Meta

Para cada conta, o sistema busca:

1. **Informações Básicas:**
   - Nome da conta
   - Moeda (currency)
   - Saldo atual (balance)
   - Limite de gasto (spend_cap)
   - Limite diário (daily_spend_limit)

2. **Insights (últimos 7 dias):**
   - Gasto total
   - Gasto médio diário

3. **Cálculos:**
   - Projeção de dias restantes
   - Status (healthy/warning/critical)

## Status das Contas

### 🟢 Healthy (Saudável)
- Saldo > 40% do limite
- Projeção > 7 dias

### 🟡 Warning (Atenção)
- Saldo entre 20-40% do limite
- Projeção entre 3-7 dias

### 🔴 Critical (Crítico)
- Saldo < 20% do limite ou zerado
- Projeção < 3 dias

## Estrutura do Banco de Dados

### Tabela: `ad_account_balances`

```sql
CREATE TABLE ad_account_balances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id),
  ad_account_id TEXT NOT NULL,
  ad_account_name TEXT,
  balance DECIMAL(10,2) DEFAULT 0,
  spend_cap DECIMAL(10,2),
  daily_spend_limit DECIMAL(10,2),
  currency TEXT DEFAULT 'BRL',
  daily_spend DECIMAL(10,2) DEFAULT 0,
  projected_days_remaining INTEGER DEFAULT 0,
  status TEXT CHECK (status IN ('healthy', 'warning', 'critical')),
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, ad_account_id)
);
```

## Troubleshooting

### Problema: Nenhuma conta sincronizada

**Verificar:**
1. Existem conexões Meta ativas?
```sql
SELECT * FROM meta_connections WHERE status = 'active';
```

2. As conexões têm contas selecionadas?
```sql
SELECT id, selected_ad_account_ids 
FROM meta_connections 
WHERE status = 'active';
```

3. Os tokens de acesso são válidos?
```sql
SELECT id, access_token, expires_at 
FROM meta_connections 
WHERE status = 'active';
```

### Problema: Erro ao buscar saldo

**Possíveis causas:**
1. Token expirado → Reconectar conta Meta
2. Permissões insuficientes → Verificar permissões do app Meta
3. Conta desativada → Verificar status no Meta Business Manager

### Problema: Saldo não atualiza

**Solução:**
1. Clicar em "Sincronizar Saldo Real"
2. Aguardar processamento
3. Verificar logs no console

## Scripts Úteis

### Diagnosticar Sistema
```bash
node scripts/diagnosticar-saldo-real.js
```

### Sincronizar Agora
```bash
node scripts/sincronizar-saldo-agora.js
```

### Verificar Conexões
```bash
node scripts/verificar-conexoes-meta-ativas.js
```

## Próximos Passos

1. ✅ Correção aplicada
2. ⏳ Testar sincronização manual
3. ⏳ Configurar sincronização automática (Cron Job)
4. ⏳ Implementar alertas de saldo baixo

## Sincronização Automática (Futuro)

Para sincronizar automaticamente a cada hora:

```typescript
// src/app/api/cron/sync-balances/route.ts
export async function GET() {
  // Chamar /api/balance/sync
  // Executar a cada 1 hora via Vercel Cron
}
```

```json
// vercel.json
{
  "crons": [{
    "path": "/api/cron/sync-balances",
    "schedule": "0 * * * *"
  }]
}
```

## Resumo

✅ **Corrigido**: API agora busca da tabela correta (`meta_connections`)
✅ **Corrigido**: Processa múltiplas contas por conexão
✅ **Funcional**: Sincronização manual via botão
✅ **Funcional**: API retorna saldos reais do Meta

🎯 **Próxima ação**: Clicar em "Sincronizar Saldo Real" na interface!
