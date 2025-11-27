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

## 📝 Última Atualização: 2025-11-25

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
  - Campos: `user_id`, `organization_id`, `role`, `org_id`

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
- `meta_adsets` - Conjuntos de anúncios
- `meta_ads` - Anúncios individuais

### Google Ads
- `google_ads_connections` - Conexões Google Ads
- `google_campaigns` - Campanhas do Google
- `google_adgroups` - Grupos de anúncios
- `google_ads` - Anúncios individuais

### Subscriptions
- `subscription_plans` - Planos de assinatura
- `subscriptions` - Assinaturas ativas
- `subscription_intents` - Intenções de assinatura

## Important Notes

1. **Use `memberships` table** - NOT `organization_members`
2. **Organization ID field** - Use `org_id` OR `organization_id` (check table structure)
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
