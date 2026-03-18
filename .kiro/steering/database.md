# Database Structure

## ⚠️ REGRA CRÍTICA: Documentação de Schema

**SEMPRE que modificar o schema do banco de dados, você DEVE:**

1. ✅ Atualizar a documentação relevante
2. ✅ Atualizar o CHANGELOG.md com as mudanças
3. ✅ Criar/atualizar scripts de migração em `database/migrations/`
4. ✅ Atualizar guias de troubleshooting se aplicável
5. ✅ Verificar se há impacto em RLS policies

**Arquivos que podem precisar atualização:**
- `database/migrations/README.md` - Guia de migrações
- `CHANGELOG.md` - Histórico de mudanças
- Documentação específica da feature (ex: `GOOGLE_ADS_SCHEMA_FIX.md`)
- `docs/TROUBLESHOOTING.md` ou guias específicos
- Arquivos de steering relevantes

**Nunca deixe o schema e a documentação desincronizados!**

---

## 📝 Última Atualização: 2025-12-12

### ✅ CRÍTICO: RLS de meta_campaigns Aplicado

**Problema:** Tabela `meta_campaigns` tinha RLS habilitado mas SEM políticas, bloqueando todo acesso.

**Solução:** Migração `database/migrations/add-meta-campaigns-rls.sql`

**Políticas Criadas:**
- `meta_campaigns`: 5 políticas (SELECT, INSERT, UPDATE, DELETE, service_role)
- `meta_campaign_insights`: 3 políticas (SELECT, INSERT, service_role)

**Status:** ✅ Aplicado via Supabase MCP Power

**Impacto:** Usuários autenticados agora conseguem acessar suas campanhas via API.

**Guia:** `CORRECAO_RLS_META_CAMPAIGNS.md`

---

### ✅ Migração Aplicada: Tabelas de Hierarquia Meta Ads

**Problema:** Tabelas `meta_adsets` e `meta_ads` não existiam no banco

**Solução:** Migração `database/migrations/add-meta-hierarchy-tables.sql`

**Tabelas Criadas:**
- `meta_adsets` - Conjuntos de anúncios (2 registros sincronizados)
- `meta_ads` - Anúncios individuais (13 registros sincronizados)
- `meta_adset_insights` - Métricas de adsets
- `meta_ad_insights` - Métricas de ads

**Status:** ✅ Aplicado com sucesso via Supabase MCP Power

**Dados Sincronizados:**
- 16 campanhas
- 2 conjuntos de anúncios
- 13 anúncios
- Cliente: BM Coan (act_3656912201189816)

**Guia:** `APLICAR_META_HIERARCHY_MIGRATION.md`

---

### 2025-12-05 - Correção: Coluna subscription_intent_transitions

**Erro:** `column "intent_id" does not exist` ao buscar status de pagamento

**Causa:** Código usava `intent_id` mas a coluna correta é `subscription_intent_id`

**Arquivos Corrigidos:**
- `src/lib/services/subscription-intent-state-machine.ts`
- `src/app/api/admin/subscription-intents/[intentId]/route.ts`

---

### Problema Identificado: Cache do Schema Desatualizado

**Erro:** `PGRST204 - Could not find the 'client_id' column of 'google_ads_audit_log'`

**Causa:** Cache do PostgREST (Supabase API) desatualizado

**Solução Criada:**
- Migração: `database/migrations/05-force-schema-reload.sql`
- Guia: `APLICAR_MIGRACAO_SCHEMA_RELOAD.md`
- Diagnóstico: `scripts/diagnose-google-403.js`

**Status:** Aguardando aplicação manual no Supabase SQL Editor

---

## Key Tables

### Organizations & Memberships
- `organizations` - Tabela de organizações
- `memberships` - Associação usuário-organização (NÃO `organization_members`)
  - Campos: `user_id`, `organization_id`, `role`
  - ⚠️ IMPORTANTE: Use `organization_id` e NÃO `org_id`! A coluna `org_id` NÃO existe nesta tabela!

### Clients
- `clients` - Clientes das organizações
  - Campos: `id`, `name`, `org_id`
  - Relacionamento: `org_id` → `organizations(id)`

### Balance Alerts (Sistema de Alertas de Saldo)
- `ad_account_balances` - Cache de saldos das contas Meta Ads
  - Campos: `client_id`, `ad_account_id`, `balance`, `status`, `projected_days_remaining`
- `balance_alerts` - Configuração de alertas por conta
  - Campos: `client_id`, `ad_account_id`, `threshold_amount`, `alert_type`, `is_active`
- `alert_history` - Histórico de alertas enviados
  - Campos: `alert_id`, `sent_via`, `recipient`, `status`, `balance_at_send`

### Meta Ads
- `client_meta_connections` - Conexões Meta Ads por cliente
  - Campos: `id`, `client_id`, `ad_account_id`, `account_name` (NÃO `ad_account_name`!), `access_token`, `is_active`
  - ⚠️ IMPORTANTE: Use `account_name` e não `ad_account_name`
- `meta_campaigns` - Campanhas do Meta
  - Campos: `id`, `connection_id`, `external_id`, `name`, `status`, `objective`, `daily_budget`, `lifetime_budget`
  - Relacionamento: `connection_id` → `client_meta_connections(id)`
- `meta_adsets` - Conjuntos de anúncios (Ad Sets)
  - Campos: `id`, `connection_id`, `campaign_id`, `external_id`, `name`, `status`, `daily_budget`, `lifetime_budget`, `optimization_goal`, `billing_event`, `targeting`
  - Relacionamento: `connection_id` → `client_meta_connections(id)`, `campaign_id` → `meta_campaigns(id)`
- `meta_ads` - Anúncios individuais
  - Campos: `id`, `connection_id`, `adset_id`, `external_id`, `name`, `status`, `creative_id`
  - Relacionamento: `connection_id` → `client_meta_connections(id)`, `adset_id` → `meta_adsets(id)`
- `meta_campaign_insights` - Métricas de campanhas por período
- `meta_adset_insights` - Métricas de adsets por período
- `meta_ad_insights` - Métricas de ads por período

### Google Ads
- `google_ads_connections` - Conexões Google Ads
- `google_campaigns` - Campanhas do Google
- `google_adgroups` - Grupos de anúncios
- `google_ads` - Anúncios individuais

### Subscriptions
- `subscription_plans` - Planos de assinatura
  - Campos Stripe: `stripe_product_id`, `stripe_price_id_monthly`, `stripe_price_id_annual`
- `subscriptions` - Assinaturas ativas
- `subscription_intents` - Intenções de assinatura
  - Campos Iugu: `iugu_customer_id`, `iugu_subscription_id`
  - Campos Stripe: `stripe_customer_id`, `stripe_session_id`, `stripe_subscription_id`
  - Campos comuns: `checkout_url`, `user_id`, `metadata`
- `subscription_intent_transitions` - Histórico de transições de estado
  - Campos: `subscription_intent_id` (NÃO `intent_id`!), `from_status`, `to_status`, `reason`, `triggered_by`, `metadata`
  - ⚠️ IMPORTANTE: Use `subscription_intent_id` e não `intent_id`

## Important Notes

1. **Use `memberships` table** - NOT `organization_members`
2. **Organization ID field**:
   - `memberships` → use `organization_id` (NÃO `org_id`!)
   - `clients` → use `org_id`
   - `subscriptions` → use `organization_id`
3. **Client isolation** - Always filter by `client_id` or `org_id`
4. **RLS Policies** - All client data must have RLS enabled

## Common Patterns

### Check user's organization
```sql
SELECT organization_id FROM memberships
WHERE user_id = auth.uid()
```

### Check user's clients
```sql
SELECT c.* FROM clients c
JOIN memberships m ON m.organization_id = c.org_id
WHERE m.user_id = auth.uid()
```

### RLS Policy Pattern
```sql
CREATE POLICY "policy_name"
  ON table_name FOR SELECT
  USING (
    client_id IN (
      SELECT c.id FROM clients c
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );
```


## ⚠️ Padrões Críticos Next.js 15

### Supabase Client (SEMPRE use await!)
```typescript
// ❌ ERRADO - Causa erro "Cannot read properties of undefined"
const supabase = createClient();

// ✅ CORRETO - Next.js 15 requer await
const supabase = await createClient();
```

### Route Params (SEMPRE use await!)
```typescript
// ❌ ERRADO - Next.js 15 params é Promise
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params; // ERRO!
}

// ✅ CORRETO - params deve ser Promise e usar await
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params; // OK!
}
```

### Tabela client_meta_connections
```typescript
// ❌ ERRADO - Coluna não existe
{
  ad_account_name: 'Nome da conta',
  status: 'active'
}

// ✅ CORRETO - Nomes corretos das colunas
{
  account_name: 'Nome da conta',
  is_active: true
}
```

### Tabela memberships (CRÍTICO!)
```typescript
// ❌ ERRADO - Coluna org_id NÃO existe na tabela memberships!
const { data: membership } = await supabase
  .from('memberships')
  .select('org_id')
  .eq('user_id', userId);

// ✅ CORRETO - Use organization_id
const { data: membership } = await supabase
  .from('memberships')
  .select('organization_id')
  .eq('user_id', userId);

// Depois, para buscar clientes:
const { data: clients } = await supabase
  .from('clients')
  .select('*')
  .eq('org_id', membership.organization_id); // clients usa org_id
```


## Google Ads Schema

### Tabelas Principais

#### google_ads_encryption_keys
Armazena chaves de criptografia para tokens OAuth com suporte a rotação.

**Colunas importantes:**
- `algorithm` (VARCHAR(50)) - Algoritmo de criptografia (default: 'aes-256-gcm')
- `version` (INTEGER) - Versão da chave para rotação
- `key_hash` (TEXT) - Hash da chave criptografada
- `is_active` (BOOLEAN) - Se a chave está ativa
- `expires_at` (TIMESTAMPTZ) - Data de expiração

**RLS:** Apenas service_role tem acesso

#### google_ads_connections
Conexões OAuth do Google Ads por cliente.

**Colunas importantes:**
- `client_id` (UUID) - FK para clients
- `customer_id` (TEXT) - ID da conta Google Ads (formato: XXX-XXX-XXXX)
- `access_token` (TEXT) - Token de acesso (criptografado)
- `refresh_token` (TEXT) - Token de refresh (criptografado)
- `token_expires_at` (TIMESTAMPTZ) - Expiração do access token
- `is_active` (BOOLEAN) - Status da conexão

**RLS:** Isolamento por client_id via memberships

#### google_ads_campaigns
Campanhas sincronizadas do Google Ads.

**Colunas importantes:**
- `client_id` (UUID) - FK para clients
- `connection_id` (UUID) - FK para google_ads_connections
- `campaign_id` (TEXT) - ID da campanha no Google Ads
- `name` (TEXT) - Nome da campanha
- `status` (TEXT) - Status (ENABLED, PAUSED, REMOVED)
- `budget_amount_micros` (BIGINT) - Orçamento em micros

**RLS:** Isolamento por client_id via memberships

#### google_ads_audit_log
Log de auditoria de todas as operações do Google Ads.

**Colunas importantes:**
- `client_id` (UUID) - FK para clients
- `connection_id` (UUID) - FK para google_ads_connections
- `user_id` (UUID) - FK para auth.users
- `operation` (TEXT) - Tipo de operação (connect, sync, token_refresh)
- `metadata` (JSONB) - Dados estruturados da operação
- `success` (BOOLEAN) - Se a operação foi bem-sucedida
- `error_message` (TEXT) - Mensagem de erro se falhou

**RLS:** Usuários veem apenas logs de seus clientes

### Aplicando Schema do Google Ads

**Ordem de execução:**

1. **Schema base:**
   ```sql
   -- Execute primeiro: database/google-ads-schema.sql
   -- Cria todas as tabelas com estrutura correta
   ```

2. **Verificação:**
   ```bash
   node scripts/test-google-health-check.js
   ```

3. **Se houver problemas de schema:**
   ```sql
   -- Execute: database/migrations/fix-google-ads-schema-simple.sql
   -- Adiciona colunas faltantes e corrige RLS
   ```

### Troubleshooting Comum

**Erro: "relation does not exist"**
- Causa: Schema base não foi aplicado
- Solução: Execute `database/google-ads-schema.sql` no Supabase SQL Editor

**Erro: "column does not exist"**
- Causa: Schema desatualizado
- Solução: Execute `database/migrations/fix-google-ads-schema-simple.sql`

**Erro: "permission denied"**
- Causa: RLS policies bloqueando acesso
- Solução: Verifique membership do usuário e políticas RLS

### Documentação Relacionada

- `GOOGLE_ADS_SCHEMA_FIX.md` - Documentação completa das correções
- `docs/GOOGLE_ADS_TROUBLESHOOTING.md` - Guia de troubleshooting
- `database/migrations/README.md` - Guia de migrações
- `APLICAR_MIGRACAO_URGENTE.md` - Guia rápido de aplicação

---

## Meta Ads Schema

### Tabelas Principais

#### client_meta_connections
Conexões OAuth do Meta Ads por cliente.

**Colunas importantes:**
- `id` (UUID, PK) - ID único da conexão
- `client_id` (UUID) - FK para clients
- `ad_account_id` (TEXT) - ID da conta Meta Ads (formato: act_XXXXX)
- `account_name` (TEXT) - Nome da conta (NÃO `ad_account_name`!)
- `access_token` (TEXT) - Token de acesso OAuth
- `is_active` (BOOLEAN) - Status da conexão

**RLS:** Isolamento por client_id via memberships

#### meta_campaigns
Campanhas sincronizadas do Meta Ads.

**Colunas importantes:**
- `id` (UUID, PK) - ID interno
- `connection_id` (UUID) - FK para client_meta_connections
- `external_id` (TEXT) - ID da campanha no Meta
- `name` (TEXT) - Nome da campanha
- `status` (TEXT) - Status (ACTIVE, PAUSED, DELETED, ARCHIVED)
- `objective` (TEXT) - Objetivo da campanha
- `daily_budget` (DECIMAL) - Orçamento diário
- `lifetime_budget` (DECIMAL) - Orçamento total

**RLS:** Isolamento por connection_id via memberships

#### meta_adsets
Conjuntos de anúncios (Ad Sets).

**Colunas importantes:**
- `id` (UUID, PK) - ID interno
- `connection_id` (UUID) - FK para client_meta_connections
- `campaign_id` (UUID) - FK para meta_campaigns
- `external_id` (TEXT) - ID do adset no Meta
- `name` (TEXT) - Nome do conjunto
- `status` (TEXT) - Status (ACTIVE, PAUSED, DELETED, ARCHIVED)
- `daily_budget` (DECIMAL) - Orçamento diário
- `lifetime_budget` (DECIMAL) - Orçamento total
- `optimization_goal` (TEXT) - Objetivo de otimização
- `billing_event` (TEXT) - Evento de cobrança
- `targeting` (JSONB) - Configuração de segmentação

**RLS:** Isolamento por connection_id via memberships

#### meta_ads
Anúncios individuais.

**Colunas importantes:**
- `id` (UUID, PK) - ID interno
- `connection_id` (UUID) - FK para client_meta_connections
- `adset_id` (UUID) - FK para meta_adsets
- `external_id` (TEXT) - ID do anúncio no Meta
- `name` (TEXT) - Nome do anúncio
- `status` (TEXT) - Status (ACTIVE, PAUSED, DELETED, ARCHIVED)
- `creative_id` (TEXT) - ID do criativo

**RLS:** Isolamento por connection_id via memberships

#### meta_campaign_insights, meta_adset_insights, meta_ad_insights
Métricas por período para cada nível da hierarquia.

**Colunas comuns:**
- `date_start` (DATE) - Início do período
- `date_stop` (DATE) - Fim do período
- `impressions` (BIGINT) - Impressões
- `clicks` (BIGINT) - Cliques
- `spend` (DECIMAL) - Gasto
- `reach` (BIGINT) - Alcance
- `frequency` (DECIMAL) - Frequência
- `cpm` (DECIMAL) - Custo por mil impressões
- `cpc` (DECIMAL) - Custo por clique
- `ctr` (DECIMAL) - Taxa de cliques
- `conversions` (BIGINT) - Conversões
- `cost_per_conversion` (DECIMAL) - Custo por conversão

### Aplicando Schema do Meta Ads

**Ordem de execução:**

1. **Schema base:**
   ```sql
   -- Execute primeiro: database/meta-ads-schema.sql
   -- Cria tabelas de conexões e campanhas
   ```

2. **Migração de hierarquia:**
   ```sql
   -- Execute: database/migrations/add-meta-hierarchy-tables.sql
   -- Cria tabelas de adsets, ads e insights
   ```

3. **Sincronização de dados:**
   ```bash
   node sync-meta-campaigns.js
   ```

4. **Verificação:**
   ```bash
   node test-meta-real.js
   node check-meta-data.js
   ```

### Troubleshooting Comum

**Erro: "relation meta_adsets does not exist"**
- Causa: Migração de hierarquia não foi aplicada
- Solução: Execute `database/migrations/add-meta-hierarchy-tables.sql`

**Erro: "column billing_event does not exist"**
- Causa: Schema desatualizado
- Solução: Execute `database/migrations/add-meta-hierarchy-tables.sql`

**Erro: "No campaigns found"**
- Causa: Dados não sincronizados
- Solução: Execute `node sync-meta-campaigns.js`

**Hierarquia não mostra adsets/ads:**
- Causa: Tabelas não existem ou dados não sincronizados
- Solução: 
  1. Aplicar migração `add-meta-hierarchy-tables.sql`
  2. Executar `node sync-meta-campaigns.js`
  3. Verificar com `node test-meta-real.js`

### Documentação Relacionada

- `APLICAR_META_HIERARCHY_MIGRATION.md` - Guia de aplicação da migração
- `META_HIERARCHY_PROBLEMA_RESOLVIDO.md` - Diagnóstico completo
- `docs/META_INTEGRATION.md` - Guia de integração Meta Ads
- `database/migrations/README.md` - Guia de migrações
