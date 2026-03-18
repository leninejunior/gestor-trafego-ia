# Google Ads Integration - Guia de Troubleshooting

## 📋 Visão Geral

Este guia fornece soluções para problemas comuns encontrados na integração com Google Ads, incluindo erros de schema, problemas de autenticação, falhas de sincronização e questões de segurança.

## 🔍 Diagnóstico Rápido

### Health Check

Execute o health check para identificar problemas rapidamente:

```bash
node scripts/test-google-health-check.js
```

**O que verifica:**
- ✅ Conectividade com banco de dados
- ✅ Existência de chaves de criptografia
- ✅ Validade de tokens
- ✅ Status de quota da API
- ✅ Integridade do schema

### Connection Diagnostics

Para problemas específicos de conexão:

```bash
node scripts/test-connection-diagnostics.js
```

**O que verifica:**
- ✅ Scopes OAuth corretos
- ✅ Acesso ao Customer ID
- ✅ Permissões da API
- ✅ Validade do refresh token

## 🚨 Problemas Comuns e Soluções

### 1. Erros de Schema

#### Erro: "Could not find the 'algorithm' column"

**Sintoma:**
```
ERROR: Could not find the 'algorithm' column in google_ads_encryption_keys
```

**Causa:** Tabela `google_ads_encryption_keys` não possui colunas necessárias.

**Solução:**
```sql
-- Execute a migração de schema
\i database/migrations/fix-google-ads-schema.sql

-- Verifique se foi aplicada corretamente
\i database/migrations/verify-google-ads-schema.sql
```

**Verificação:**
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'google_ads_encryption_keys'
  AND column_name IN ('algorithm', 'version', 'key_hash');
```

---

#### Erro: "Could not find the 'client_id' column"

**Sintoma:**
```
ERROR: Could not find the 'client_id' column in google_ads_audit_log
```

**Causa:** Tabela `google_ads_audit_log` não possui coluna `client_id`.

**Solução:**
```sql
-- Execute a migração de schema
\i database/migrations/fix-google-ads-schema.sql
```

**Verificação:**
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'google_ads_audit_log'
  AND column_name = 'client_id';
```

---

#### Erro: "column memberships.org_id does not exist"

**Sintoma:**
```
ERROR: column memberships.org_id does not exist
```

**Causa:** Query usando nome de coluna incorreto. A coluna correta é `organization_id`.

**Solução:**
Atualize o código para usar `organization_id`:

```typescript
// ❌ ERRADO
const { data } = await supabase
  .from('memberships')
  .select('org_id')
  .eq('user_id', userId);

// ✅ CORRETO
const { data } = await supabase
  .from('memberships')
  .select('organization_id')
  .eq('user_id', userId);
```

**Verificação:**
```sql
-- Verifique o nome correto da coluna
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'memberships'
  AND column_name LIKE '%org%';
```

---

### 2. Problemas de Autenticação

#### Erro: "Invalid OAuth token"

**Sintoma:**
```
ERROR: Invalid OAuth token or token expired
```

**Causa:** Token de acesso expirado ou inválido.

**Solução:**

1. **Verificar expiração do token:**
```sql
SELECT 
  id,
  customer_id,
  token_expires_at,
  token_expires_at < NOW() as is_expired
FROM google_ads_connections
WHERE client_id = 'YOUR_CLIENT_ID';
```

2. **Forçar refresh do token:**
```typescript
import { refreshGoogleAdsToken } from '@/lib/google/token-manager';

const result = await refreshGoogleAdsToken(connectionId);
if (!result.success) {
  console.error('Token refresh failed:', result.error);
}
```

3. **Reconectar se refresh falhar:**
- Navegue para `/dashboard/google`
- Clique em "Reconectar" na conexão problemática
- Complete o fluxo OAuth novamente

---

#### Erro: "Insufficient OAuth scopes"

**Sintoma:**
```
ERROR: The OAuth token does not have the required scopes
```

**Causa:** Token não possui os scopes necessários para a operação.

**Solução:**

1. **Verificar scopes atuais:**
```bash
node scripts/test-connection-diagnostics.js
```

2. **Scopes necessários:**
```
https://www.googleapis.com/auth/adwords
```

3. **Reconectar com scopes corretos:**
- Desconecte a conta atual
- Reconecte garantindo que todos os scopes sejam aprovados
- Verifique que não há restrições na conta Google Ads

---

#### Erro: "Customer ID not accessible"

**Sintoma:**
```
ERROR: Customer ID XXX-XXX-XXXX is not accessible with current credentials
```

**Causa:** 
- Customer ID incorreto
- Conta não tem acesso ao Customer ID
- Permissões insuficientes

**Solução:**

1. **Verificar Customer ID:**
```sql
SELECT customer_id, account_name 
FROM google_ads_connections
WHERE client_id = 'YOUR_CLIENT_ID';
```

2. **Validar formato:**
- Deve estar no formato: `XXX-XXX-XXXX`
- Sem espaços ou caracteres especiais

3. **Verificar acesso na conta Google Ads:**
- Login em ads.google.com
- Verifique se a conta tem acesso ao Customer ID
- Confirme permissões de administrador ou leitura

4. **Atualizar Customer ID se necessário:**
```sql
UPDATE google_ads_connections
SET customer_id = 'CORRECT-CUSTOMER-ID'
WHERE id = 'CONNECTION_ID';
```

---

### 3. Problemas de Sincronização

#### Erro: "Sync returns 0 campaigns"

**Sintoma:**
```
INFO: Sync completed successfully but returned 0 campaigns
```

**Causa:** 
- Filtros muito restritivos
- Customer ID incorreto
- Campanhas não atendem critérios de status
- Problema com GAQL query

**Solução:**

1. **Verificar logs detalhados:**
```bash
# Ativar logging detalhado
export DEBUG=google:*
node scripts/test-campaign-sync.js
```

2. **Verificar GAQL query:**
```sql
-- Query padrão usada
SELECT
  campaign.id,
  campaign.name,
  campaign.status,
  campaign.advertising_channel_type,
  metrics.impressions,
  metrics.clicks,
  metrics.cost_micros
FROM campaign
WHERE campaign.status IN ('ENABLED', 'PAUSED')
  AND segments.date DURING LAST_30_DAYS
```

3. **Testar com filtros mais amplos:**
```typescript
// Remover filtro de data temporariamente
const query = `
  SELECT campaign.id, campaign.name, campaign.status
  FROM campaign
  WHERE campaign.status != 'REMOVED'
`;
```

4. **Verificar na interface do Google Ads:**
- Login em ads.google.com
- Confirme que existem campanhas ativas
- Verifique o status das campanhas

---

#### Erro: "API quota exceeded"

**Sintoma:**
```
ERROR: Rate limit exceeded for Google Ads API
```

**Causa:** Limite de requisições da API atingido.

**Solução:**

1. **Verificar quota atual:**
```bash
node scripts/test-google-health-check.js
```

2. **Implementar backoff exponencial:**
```typescript
async function syncWithRetry(connectionId: string, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await syncCampaigns(connectionId);
    } catch (error) {
      if (error.code === 'RATE_LIMIT_EXCEEDED') {
        const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
}
```

3. **Reduzir frequência de sync:**
```typescript
// Aumentar intervalo entre syncs
const SYNC_INTERVAL = 60 * 60 * 1000; // 1 hora em vez de 15 minutos
```

4. **Solicitar aumento de quota:**
- Acesse Google Cloud Console
- Navegue para "APIs & Services" > "Quotas"
- Solicite aumento para Google Ads API

---

### 4. Problemas de Criptografia

#### Erro: "Encryption key not found"

**Sintoma:**
```
ERROR: No active encryption key found
```

**Causa:** Nenhuma chave de criptografia ativa no banco.

**Solução:**

1. **Verificar chaves existentes:**
```sql
SELECT id, version, is_active, expires_at 
FROM google_ads_encryption_keys
ORDER BY version DESC;
```

2. **Criar nova chave se necessário:**
```typescript
import { rotateEncryptionKey } from '@/lib/google/crypto-service';

await rotateEncryptionKey();
```

3. **Verificar variáveis de ambiente:**
```bash
# Verificar se ENCRYPTION_KEY está definida
echo $ENCRYPTION_KEY

# Ou no .env
grep ENCRYPTION_KEY .env
```

---

#### Erro: "Decryption failed"

**Sintoma:**
```
ERROR: Failed to decrypt token
```

**Causa:** 
- Chave de criptografia mudou
- Token corrompido
- Algoritmo incompatível

**Solução:**

1. **Verificar algoritmo:**
```sql
SELECT algorithm, version 
FROM google_ads_encryption_keys
WHERE is_active = true;
```

2. **Tentar fallback para plain text:**
```typescript
// O sistema tenta automaticamente ler tokens em plain text
// se a descriptografia falhar
```

3. **Reconectar a conta:**
- Desconecte a conta problemática
- Reconecte para gerar novos tokens
- Novos tokens serão criptografados corretamente

---

### 5. Problemas de RLS (Row Level Security)

#### Erro: "Permission denied for table"

**Sintoma:**
```
ERROR: new row violates row-level security policy
```

**Causa:** Políticas RLS bloqueando acesso legítimo.

**Solução:**

1. **Verificar membership do usuário:**
```sql
SELECT 
  m.user_id,
  m.organization_id,
  m.role,
  c.id as client_id,
  c.name as client_name
FROM memberships m
JOIN clients c ON c.org_id = m.organization_id
WHERE m.user_id = auth.uid();
```

2. **Verificar políticas RLS:**
```sql
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'google_ads_connections'
ORDER BY policyname;
```

3. **Testar com service role:**
```typescript
// Temporariamente use service role para debug
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

4. **Verificar client_id correto:**
```typescript
// Certifique-se de usar client_id válido
const { data: clients } = await supabase
  .from('clients')
  .select('id')
  .eq('org_id', organizationId);

// Use um dos IDs retornados
```

---

#### Erro: "User can see data from other clients"

**Sintoma:** Usuário vê dados de clientes que não deveria ter acesso.

**Causa:** Políticas RLS não implementadas ou incorretas.

**Solução:**

1. **Verificar se RLS está habilitado:**
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename LIKE 'google_ads%';
```

2. **Aplicar migração de RLS:**
```sql
\i database/migrations/fix-google-ads-schema.sql
```

3. **Testar isolamento:**
```sql
-- Como usuário 1
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims.sub TO 'user-1-uuid';

SELECT * FROM google_ads_connections;
-- Deve retornar apenas conexões do usuário 1

-- Como usuário 2
SET LOCAL request.jwt.claims.sub TO 'user-2-uuid';

SELECT * FROM google_ads_connections;
-- Deve retornar apenas conexões do usuário 2
```

---

### 6. Problemas de Performance

#### Problema: "Queries lentas"

**Sintoma:** Queries demorando mais de 1 segundo.

**Solução:**

1. **Verificar índices:**
```sql
SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename LIKE 'google_ads%'
ORDER BY tablename, indexname;
```

2. **Criar índices faltantes:**
```sql
-- Índice para queries por cliente
CREATE INDEX IF NOT EXISTS idx_google_campaigns_client_date
ON google_ads_campaigns(client_id, created_at DESC);

-- Índice para queries de métricas
CREATE INDEX IF NOT EXISTS idx_google_metrics_campaign_date
ON google_ads_metrics(campaign_id, date DESC);
```

3. **Analisar query plan:**
```sql
EXPLAIN ANALYZE
SELECT * FROM google_ads_campaigns
WHERE client_id = 'YOUR_CLIENT_ID'
ORDER BY created_at DESC
LIMIT 10;
```

---

#### Problema: "Sync muito lento"

**Sintoma:** Sincronização demorando mais de 5 minutos.

**Solução:**

1. **Reduzir período de sync:**
```typescript
// Sincronizar apenas últimos 7 dias em vez de 30
const query = `
  SELECT ...
  FROM campaign
  WHERE segments.date DURING LAST_7_DAYS
`;
```

2. **Implementar sync incremental:**
```typescript
// Sincronizar apenas campanhas modificadas
const lastSync = await getLastSyncTime(connectionId);
const query = `
  SELECT ...
  FROM campaign
  WHERE campaign.modified_time > '${lastSync}'
`;
```

3. **Usar batch processing:**
```typescript
// Processar campanhas em lotes
const BATCH_SIZE = 50;
for (let i = 0; i < campaigns.length; i += BATCH_SIZE) {
  const batch = campaigns.slice(i, i + BATCH_SIZE);
  await processCampaignBatch(batch);
}
```

---

## 🔧 Ferramentas de Diagnóstico

### Scripts Disponíveis

```bash
# Health check completo
node scripts/test-google-health-check.js

# Diagnóstico de conexão
node scripts/test-connection-diagnostics.js

# Teste de OAuth flow
node scripts/test-oauth-flow-e2e.js

# Teste de sincronização
node scripts/test-campaign-sync.js

# Teste de criptografia
node scripts/test-google-encryption.js

# Teste de métricas
node scripts/test-metrics-collection.js
```

### Queries SQL Úteis

```sql
-- Ver todas as conexões e seu status
SELECT 
  c.name as client_name,
  gac.customer_id,
  gac.account_name,
  gac.is_active,
  gac.token_expires_at,
  gac.token_expires_at < NOW() as is_expired,
  gac.last_sync_at
FROM google_ads_connections gac
JOIN clients c ON c.id = gac.client_id
ORDER BY c.name, gac.customer_id;

-- Ver campanhas por cliente
SELECT 
  c.name as client_name,
  COUNT(gc.id) as campaign_count,
  SUM(CASE WHEN gc.status = 'ENABLED' THEN 1 ELSE 0 END) as active_campaigns
FROM clients c
LEFT JOIN google_ads_campaigns gc ON gc.client_id = c.id
GROUP BY c.id, c.name
ORDER BY campaign_count DESC;

-- Ver logs de sync recentes
SELECT 
  gsl.started_at,
  gsl.completed_at,
  gsl.status,
  gsl.campaigns_synced,
  gsl.error_message,
  c.name as client_name
FROM google_ads_sync_logs gsl
JOIN google_ads_connections gac ON gac.id = gsl.connection_id
JOIN clients c ON c.id = gac.client_id
ORDER BY gsl.started_at DESC
LIMIT 20;

-- Ver audit logs recentes
SELECT 
  gal.created_at,
  gal.operation,
  gal.success,
  gal.error_message,
  c.name as client_name,
  u.email as user_email
FROM google_ads_audit_log gal
JOIN clients c ON c.id = gal.client_id
LEFT JOIN auth.users u ON u.id = gal.user_id
ORDER BY gal.created_at DESC
LIMIT 20;
```

---

## 📊 Monitoramento

### Métricas Importantes

1. **Taxa de sucesso de sync:**
```sql
SELECT 
  DATE(started_at) as date,
  COUNT(*) as total_syncs,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful,
  ROUND(100.0 * SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM google_ads_sync_logs
WHERE started_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(started_at)
ORDER BY date DESC;
```

2. **Tokens expirando:**
```sql
SELECT 
  c.name as client_name,
  gac.customer_id,
  gac.token_expires_at,
  gac.token_expires_at - NOW() as time_until_expiry
FROM google_ads_connections gac
JOIN clients c ON c.id = gac.client_id
WHERE gac.is_active = true
  AND gac.token_expires_at < NOW() + INTERVAL '24 hours'
ORDER BY gac.token_expires_at;
```

3. **Erros frequentes:**
```sql
SELECT 
  operation,
  error_message,
  COUNT(*) as error_count
FROM google_ads_audit_log
WHERE success = false
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY operation, error_message
ORDER BY error_count DESC
LIMIT 10;
```

---

## 🆘 Quando Pedir Ajuda

Se após seguir este guia o problema persistir:

1. **Colete informações:**
   - Logs da aplicação
   - Logs do Supabase
   - Output dos scripts de diagnóstico
   - Screenshots de erros

2. **Documente:**
   - Passos para reproduzir
   - Comportamento esperado vs atual
   - Tentativas de solução já realizadas

3. **Consulte:**
   - Documentação oficial do Google Ads API
   - Issues no repositório
   - Equipe de desenvolvimento

---

## 📚 Recursos Adicionais

- [Google Ads API Documentation](https://developers.google.com/google-ads/api/docs/start)
- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [GOOGLE_ADS_SCHEMA_FIX.md](../GOOGLE_ADS_SCHEMA_FIX.md)
- [database/migrations/README.md](../database/migrations/README.md)

---

**Última Atualização:** 24 de novembro de 2024  
**Versão:** 1.0.0
