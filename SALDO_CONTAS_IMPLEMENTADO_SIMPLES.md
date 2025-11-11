# Sistema de Saldo de Contas - Implementado ✅

## 🎯 O que foi implementado

Sistema **SIMPLES** para mostrar o saldo das contas Meta Ads para **TODOS OS USUÁRIOS** (não só admin).

### Funcionalidades

- ✅ Visualização de saldo no dashboard principal
- ✅ Status visual (Saudável 🟢, Atenção 🟡, Crítico 🔴)
- ✅ Projeção de dias restantes
- ✅ Alertas visuais de saldo baixo/crítico
- ✅ Sincronização automática com Meta Ads API
- ✅ RLS para isolamento por organização

## 📁 Arquivos Criados

### 1. Database Schema
```
database/ad-account-balances-FINAL-SIMPLES.sql
```
- Tabela `ad_account_balances` - Armazena saldos
- View `ad_account_balances_with_status` - Com status calculado
- RLS policies para isolamento

### 2. APIs
```
src/app/api/balance/
├── my-accounts/route.ts  # Buscar saldos do usuário
└── sync/route.ts         # Sincronizar com Meta API
```

### 3. Componente UI
```
src/components/dashboard/account-balances-widget.tsx
```
Widget para mostrar no dashboard

## 🚀 Como Usar

### 1. Aplicar Schema no Supabase

```sql
-- Cole no SQL Editor do Supabase
-- Arquivo: database/ad-account-balances-FINAL-SIMPLES.sql
```

Ou acesse:
```
https://supabase.com/dashboard/project/SEU_PROJETO/sql
```

### 2. Adicionar Widget no Dashboard

Edite `src/app/dashboard/page.tsx`:

```typescript
import { AccountBalancesWidget } from '@/components/dashboard/account-balances-widget'

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Outros componentes */}
      
      {/* Adicione o widget de saldo */}
      <AccountBalancesWidget />
      
      {/* Resto do dashboard */}
    </div>
  )
}
```

### 3. Configurar Sincronização Automática (Opcional)

**Opção A: Cron Job no Vercel**

Adicione ao `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/balance/sync",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

**Opção B: Sincronização Manual**

```bash
curl -X POST http://localhost:3000/api/balance/sync \
  -H "Authorization: Bearer SEU_CRON_SECRET"
```

### 4. Testar

```bash
# 1. Sincronizar saldos
curl -X POST http://localhost:3000/api/balance/sync

# 2. Ver saldos
curl http://localhost:3000/api/balance/my-accounts

# 3. Acessar dashboard
http://localhost:3000/dashboard
```

## 📊 Estrutura de Dados

### Tabela: ad_account_balances

```sql
{
  id: UUID
  client_id: UUID              -- Cliente dono da conta
  ad_account_id: TEXT          -- ID da conta (Meta/Google)
  ad_account_name: TEXT        -- Nome da conta
  platform: TEXT               -- 'meta' ou 'google'
  balance: DECIMAL             -- Saldo atual
  currency: TEXT               -- Moeda (BRL, USD, etc)
  spend_cap: DECIMAL           -- Limite total
  daily_spend_limit: DECIMAL   -- Limite diário
  current_spend: DECIMAL       -- Gasto total atual
  daily_spend: DECIMAL         -- Média de gasto diário
  last_updated: TIMESTAMP      -- Última atualização
}
```

### View: ad_account_balances_with_status

Adiciona campos calculados:
- `balance_percentage` - % do saldo em relação ao limite
- `estimated_days_remaining` - Dias restantes estimados
- `status` - 'healthy', 'warning' ou 'critical'

## 🎨 Status Visuais

### 🟢 Saudável (Healthy)
- Saldo > 40% do limite
- Projeção > 7 dias

### 🟡 Atenção (Warning)
- Saldo entre 20-40% do limite
- Projeção entre 3-7 dias

### 🔴 Crítico (Critical)
- Saldo < 20% do limite ou zerado
- Projeção < 3 dias

## 🔒 Segurança

### RLS Policies

```sql
-- Usuários veem apenas contas da sua organização
CREATE POLICY "Users can view balances for their org clients"
  ON ad_account_balances FOR SELECT
  USING (
    client_id IN (
      SELECT c.id FROM clients c
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );
```

## 📱 Widget no Dashboard

O widget mostra:

1. **Resumo**
   - Saldo total
   - Gasto diário total

2. **Alertas**
   - Contas críticas (vermelho)
   - Contas com saldo baixo (amarelo)

3. **Lista de Contas**
   - Top 5 contas (críticas primeiro)
   - Nome da conta e cliente
   - Saldo atual
   - Dias restantes estimados
   - Barra de progresso

## 🔄 Sincronização

### Como Funciona

1. API `/api/balance/sync` busca todas conexões Meta ativas
2. Para cada conta, busca saldo via Meta Graph API
3. Calcula média de gasto diário (últimos 7 dias)
4. Atualiza ou insere no banco de dados

### Frequência Recomendada

- **Produção**: A cada 6 horas (`0 */6 * * *`)
- **Desenvolvimento**: Manual quando necessário

### Dados Buscados do Meta

```javascript
// Endpoint: /{ad_account_id}
{
  name,              // Nome da conta
  currency,          // Moeda
  balance,           // Saldo (em centavos)
  amount_spent,      // Gasto total
  spend_cap,         // Limite total
  daily_spend_limit  // Limite diário
}

// Endpoint: /{ad_account_id}/insights
{
  spend  // Gasto por dia (últimos 7 dias)
}
```

## 🧪 Testes

### 1. Verificar Tabela

```sql
SELECT * FROM ad_account_balances LIMIT 5;
```

### 2. Verificar View

```sql
SELECT * FROM ad_account_balances_with_status 
WHERE status = 'critical';
```

### 3. Testar API

```bash
# Sincronizar
curl -X POST http://localhost:3000/api/balance/sync

# Ver saldos
curl http://localhost:3000/api/balance/my-accounts
```

## 📈 Próximos Passos (Opcional)

### Melhorias Futuras

- [ ] Alertas por email/WhatsApp quando saldo crítico
- [ ] Histórico de saldo (gráfico de evolução)
- [ ] Previsão de esgotamento com ML
- [ ] Suporte para Google Ads
- [ ] Notificações push no dashboard
- [ ] Exportação de relatórios

### Extensões

- [ ] Adicionar alertas automáticos (tabela separada)
- [ ] Integração com WhatsApp (Evolution API)
- [ ] Dashboard de tendências
- [ ] Recomendações de recarga

## 🐛 Troubleshooting

### Saldos não aparecem

1. Verificar se tabela existe:
```sql
SELECT * FROM pg_tables WHERE tablename = 'ad_account_balances';
```

2. Verificar se há conexões Meta:
```sql
SELECT * FROM client_meta_connections WHERE status = 'active';
```

3. Sincronizar manualmente:
```bash
curl -X POST http://localhost:3000/api/balance/sync
```

### Widget não aparece

1. Verificar se foi adicionado ao dashboard
2. Verificar console do navegador para erros
3. Verificar se API retorna dados:
```bash
curl http://localhost:3000/api/balance/my-accounts
```

### Erro de permissão (RLS)

1. Verificar se usuário tem membership:
```sql
SELECT * FROM memberships WHERE user_id = auth.uid();
```

2. Verificar se cliente pertence à organização:
```sql
SELECT c.*, m.organization_id 
FROM clients c
JOIN memberships m ON m.organization_id = c.org_id
WHERE m.user_id = auth.uid();
```

## ✅ Checklist de Implementação

- [ ] Schema aplicado no Supabase
- [ ] Widget adicionado ao dashboard
- [ ] Sincronização configurada (manual ou cron)
- [ ] Testado com contas reais
- [ ] RLS funcionando corretamente

## 🎉 Conclusão

Sistema simples e eficaz para mostrar saldo das contas no dashboard! 

**Principais vantagens:**
- 🚀 Simples de implementar
- 👥 Disponível para todos os usuários
- 🔒 Seguro com RLS
- 📊 Visual e intuitivo
- 🔄 Sincronização automática

**Próxima ação**: Aplicar o SQL no Supabase e adicionar o widget ao dashboard!

---

**Data**: 07/11/2025
**Status**: ✅ Implementado e pronto para uso
**Complexidade**: Baixa (1 tabela, 2 APIs, 1 componente)
