# Google Ads Integration Troubleshooting Guide

## Overview

Este guia fornece soluções para problemas comuns na integração Google Ads, incluindo diagnósticos, correções e prevenção de problemas.

## Problemas de Autenticação

### 1. Erro "AUTHENTICATION_ERROR"

**Sintomas:**
- API retorna erro 401 ou "AUTHENTICATION_ERROR"
- Usuário não consegue conectar conta Google Ads
- Sync falha com erro de autenticação

**Possíveis Causas:**
1. Token de acesso expirado
2. Refresh token inválido ou revogado
3. Configuração OAuth incorreta
4. Permissões insuficientes na conta Google Ads

**Diagnóstico:**
```sql
-- Verificar status dos tokens
SELECT 
  c.id,
  c.customer_id,
  c.status,
  c.token_expires_at,
  CASE 
    WHEN c.token_expires_at < NOW() THEN 'EXPIRED'
    WHEN c.token_expires_at < NOW() + INTERVAL '5 minutes' THEN 'EXPIRING_SOON'
    ELSE 'VALID'
  END as token_status
FROM google_ads_connections c
WHERE client_id = 'CLIENT_UUID';
```

**Soluções:**

1. **Token Expirado:**
```bash
# Forçar refresh do token via API
curl -X POST "/api/google/auth/refresh" \
  -H "Content-Type: application/json" \
  -d '{"clientId": "CLIENT_UUID"}'
```

2. **Refresh Token Inválido:**
```sql
-- Marcar conexão como expirada
UPDATE google_ads_connections 
SET status = 'expired' 
WHERE client_id = 'CLIENT_UUID';
```
- Usuário precisa reconectar a conta

3. **Verificar Configuração OAuth:**
```bash
# Verificar variáveis de ambiente
node scripts/check-google-ads-env.js
```

### 2. Erro "PERMISSION_DENIED"

**Sintomas:**
- Erro 403 ao acessar campanhas
- "Insufficient permissions" na API

**Diagnóstico:**
```javascript
// Verificar scopes da conexão
const connection = await googleAdsRepository.getConnection(clientId);
console.log('Customer ID:', connection.customer_id);
console.log('Status:', connection.status);
```

**Soluções:**
1. Verificar se o usuário tem acesso à conta Google Ads
2. Confirmar que a conta não foi removida/suspensa
3. Reconectar com permissões adequadas

## Problemas de Sincronização

### 1. Sync Lento ou Travado

**Sintomas:**
- Sincronização demora mais de 10 minutos
- Status permanece "syncing" indefinidamente
- Timeout em requests

**Diagnóstico:**
```sql
-- Verificar syncs em andamento
SELECT 
  sl.id,
  sl.sync_type,
  sl.status,
  sl.started_at,
  NOW() - sl.started_at as duration,
  sl.campaigns_synced,
  sl.error_message
FROM google_ads_sync_logs sl
INNER JOIN google_ads_connections c ON c.id = sl.connection_id
WHERE c.client_id = 'CLIENT_UUID'
  AND sl.status IN ('syncing', 'queued')
ORDER BY sl.started_at DESC;
```

**Soluções:**

1. **Rate Limiting:**
```javascript
// Verificar logs de rate limit
const logs = await googleSyncService.getErrorLogs(clientId, 'RATE_LIMIT_EXCEEDED');
console.log('Rate limit hits:', logs.length);
```

2. **Muitas Campanhas:**
```sql
-- Verificar número de campanhas
SELECT COUNT(*) as campaign_count
FROM google_ads_campaigns
WHERE client_id = 'CLIENT_UUID';
```

3. **Forçar Reset de Sync:**
```sql
-- Marcar syncs travados como failed
UPDATE google_ads_sync_logs 
SET status = 'failed', 
    error_message = 'Timeout - reset by admin',
    completed_at = NOW()
WHERE status IN ('syncing', 'queued')
  AND started_at < NOW() - INTERVAL '30 minutes';
```

### 2. Dados Desatualizados

**Sintomas:**
- Métricas não refletem dados recentes
- Última sincronização muito antiga
- Campanhas não aparecem no dashboard

**Diagnóstico:**
```sql
-- Verificar última sincronização
SELECT 
  c.customer_id,
  c.last_sync_at,
  NOW() - c.last_sync_at as time_since_sync,
  COUNT(camp.id) as total_campaigns,
  MAX(m.date) as latest_metrics_date
FROM google_ads_connections c
LEFT JOIN google_ads_campaigns camp ON camp.connection_id = c.id
LEFT JOIN google_ads_metrics m ON m.campaign_id = camp.id
WHERE c.client_id = 'CLIENT_UUID'
GROUP BY c.id, c.customer_id, c.last_sync_at;
```

**Soluções:**

1. **Forçar Sync Manual:**
```bash
curl -X POST "/api/google/sync" \
  -H "Content-Type: application/json" \
  -d '{"clientId": "CLIENT_UUID", "fullSync": true}'
```

2. **Limpar Cache:**
```javascript
// Via API de cache
await cacheService.invalidatePattern(`google:campaigns:${clientId}:*`);
await cacheService.invalidatePattern(`google:metrics:${clientId}:*`);
```

3. **Verificar Cron Jobs:**
```sql
-- Verificar execução dos cron jobs
SELECT * FROM cron_job_logs 
WHERE job_name = 'google-sync' 
ORDER BY executed_at DESC 
LIMIT 10;
```

## Problemas de Performance

### 1. Queries Lentas

**Sintomas:**
- Dashboard demora para carregar
- Timeout em requests de métricas
- Alta utilização de CPU no banco

**Diagnóstico:**
```sql
-- Verificar queries lentas
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  rows
FROM pg_stat_statements 
WHERE query LIKE '%google_ads_%'
ORDER BY mean_time DESC
LIMIT 10;
```

**Soluções:**

1. **Verificar Índices:**
```sql
-- Verificar uso de índices
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read
FROM pg_stat_user_indexes 
WHERE tablename LIKE 'google_ads_%'
  AND idx_scan < 100
ORDER BY tablename;
```

2. **Otimizar Queries:**
```sql
-- Exemplo de query otimizada para métricas
EXPLAIN ANALYZE
SELECT 
  c.campaign_name,
  SUM(m.impressions) as total_impressions,
  SUM(m.clicks) as total_clicks,
  SUM(m.cost) as total_cost
FROM google_ads_campaigns c
INNER JOIN google_ads_metrics m ON m.campaign_id = c.id
WHERE c.client_id = 'CLIENT_UUID'
  AND m.date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY c.id, c.campaign_name;
```

3. **Implementar Cache:**
```javascript
// Cache de métricas agregadas
const cacheKey = `google:aggregated:${clientId}:${dateRange}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);
```

### 2. Alto Uso de Memória

**Sintomas:**
- Processo Node.js usando muita RAM
- Out of memory errors
- Performance degradada

**Diagnóstico:**
```javascript
// Monitorar uso de memória
console.log('Memory usage:', process.memoryUsage());

// Verificar tamanho dos resultados
const campaigns = await googleAdsRepository.getCampaigns(clientId);
console.log('Campaigns count:', campaigns.length);
```

**Soluções:**

1. **Implementar Paginação:**
```javascript
// Paginar resultados grandes
const limit = 50;
const offset = page * limit;
const campaigns = await googleAdsRepository.getCampaigns(clientId, { limit, offset });
```

2. **Streaming de Dados:**
```javascript
// Para exports grandes
const stream = await googleAdsRepository.getMetricsStream(clientId, dateRange);
stream.pipe(csvWriter);
```

## Problemas de Dados

### 1. Métricas Inconsistentes

**Sintomas:**
- Valores diferentes entre dashboard e Google Ads
- Métricas zeradas ou muito altas
- Dados duplicados

**Diagnóstico:**
```sql
-- Verificar duplicatas
SELECT 
  campaign_id,
  date,
  COUNT(*) as duplicate_count
FROM google_ads_metrics
GROUP BY campaign_id, date
HAVING COUNT(*) > 1;

-- Verificar valores anômalos
SELECT 
  campaign_id,
  date,
  impressions,
  clicks,
  cost,
  CASE 
    WHEN clicks > impressions THEN 'INVALID_CTR'
    WHEN cost < 0 THEN 'NEGATIVE_COST'
    WHEN impressions = 0 AND clicks > 0 THEN 'IMPOSSIBLE_CLICKS'
    ELSE 'OK'
  END as validation_status
FROM google_ads_metrics
WHERE client_id IN (
  SELECT client_id FROM google_ads_campaigns WHERE id = campaign_id
)
AND validation_status != 'OK';
```

**Soluções:**

1. **Remover Duplicatas:**
```sql
-- Remover métricas duplicadas (manter a mais recente)
DELETE FROM google_ads_metrics
WHERE id NOT IN (
  SELECT DISTINCT ON (campaign_id, date) id
  FROM google_ads_metrics
  ORDER BY campaign_id, date, created_at DESC
);
```

2. **Validar Dados na Importação:**
```javascript
// Adicionar validação no sync
function validateMetrics(metrics) {
  return metrics.filter(m => 
    m.impressions >= 0 &&
    m.clicks >= 0 &&
    m.clicks <= m.impressions &&
    m.cost >= 0
  );
}
```

3. **Re-sync Específico:**
```bash
# Re-sincronizar período específico
curl -X POST "/api/google/sync/date-range" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "CLIENT_UUID",
    "dateFrom": "2024-01-01",
    "dateTo": "2024-01-31"
  }'
```

### 2. Campanhas Não Aparecem

**Sintomas:**
- Campanhas existem no Google Ads mas não no sistema
- Lista vazia no dashboard
- Erro ao carregar campanhas

**Diagnóstico:**
```sql
-- Verificar conexões ativas
SELECT 
  c.id,
  c.customer_id,
  c.status,
  COUNT(camp.id) as campaign_count,
  c.last_sync_at
FROM google_ads_connections c
LEFT JOIN google_ads_campaigns camp ON camp.connection_id = c.id
WHERE c.client_id = 'CLIENT_UUID'
GROUP BY c.id;
```

**Soluções:**

1. **Verificar Permissões:**
```javascript
// Testar acesso à API
const accounts = await googleAdsClient.getAccessibleCustomers();
console.log('Accessible accounts:', accounts);
```

2. **Sync Completo:**
```bash
# Forçar sync completo
curl -X POST "/api/google/sync" \
  -H "Content-Type: application/json" \
  -d '{"clientId": "CLIENT_UUID", "fullSync": true, "force": true}'
```

## Problemas de Configuração

### 1. Variáveis de Ambiente

**Sintomas:**
- Erro ao inicializar Google Ads client
- "Missing configuration" errors
- OAuth flow não funciona

**Diagnóstico:**
```bash
# Verificar configuração
node scripts/check-google-ads-env.js
```

**Configuração Necessária:**
```bash
# .env
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_DEVELOPER_TOKEN=your_developer_token
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

**Soluções:**

1. **Verificar Google Cloud Console:**
   - OAuth 2.0 Client configurado
   - Redirect URIs corretos
   - APIs habilitadas

2. **Testar Configuração:**
```javascript
// Testar OAuth flow
const authUrl = await googleOAuthService.getAuthorizationUrl('test-state');
console.log('Auth URL generated:', !!authUrl);
```

### 2. Problemas de CORS

**Sintomas:**
- Erro CORS no browser
- OAuth callback falha
- Requests bloqueados

**Soluções:**

1. **Verificar Configuração Next.js:**
```javascript
// next.config.ts
const nextConfig = {
  async headers() {
    return [
      {
        source: '/api/google/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: process.env.NEXT_PUBLIC_APP_URL },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
        ],
      },
    ];
  },
};
```

2. **Verificar Redirect URIs:**
```
Configurar no Google Cloud Console:
- https://your-domain.com/api/google/callback
- http://localhost:3000/api/google/callback (desenvolvimento)
```

## Comandos de Debug Úteis

### 1. Verificação Geral do Sistema

```bash
# Script de diagnóstico completo
node scripts/diagnose-google-ads.js CLIENT_UUID
```

### 2. Logs Detalhados

```sql
-- Logs de erro recentes
SELECT 
  sl.started_at,
  sl.sync_type,
  sl.status,
  sl.error_message,
  sl.error_code,
  c.customer_id
FROM google_ads_sync_logs sl
INNER JOIN google_ads_connections c ON c.id = sl.connection_id
WHERE sl.status = 'failed'
  AND sl.started_at >= NOW() - INTERVAL '24 hours'
ORDER BY sl.started_at DESC;
```

### 3. Limpeza de Dados

```sql
-- Limpar dados corrompidos
DELETE FROM google_ads_metrics 
WHERE impressions < 0 OR clicks < 0 OR cost < 0;

-- Reset de conexão problemática
UPDATE google_ads_connections 
SET status = 'expired', last_sync_at = NULL 
WHERE client_id = 'CLIENT_UUID';
```

### 4. Monitoramento em Tempo Real

```bash
# Monitorar logs de sync
tail -f logs/google-ads-sync.log | grep "CLIENT_UUID"

# Monitorar performance
watch -n 5 'psql -c "SELECT COUNT(*) FROM google_ads_sync_logs WHERE status = \"syncing\""'
```

## Prevenção de Problemas

### 1. Monitoramento Proativo

```sql
-- Criar alertas automáticos
CREATE OR REPLACE FUNCTION check_google_ads_health()
RETURNS TABLE (
  issue_type TEXT,
  client_id UUID,
  description TEXT,
  severity TEXT
) AS $$
BEGIN
  -- Conexões expiradas
  RETURN QUERY
  SELECT 
    'expired_connection'::TEXT,
    c.client_id,
    'Connection expired for customer ' || c.customer_id,
    'high'::TEXT
  FROM google_ads_connections c
  WHERE c.status = 'expired' OR c.token_expires_at < NOW();
  
  -- Syncs falhando consistentemente
  RETURN QUERY
  SELECT 
    'sync_failures'::TEXT,
    c.client_id,
    'Multiple sync failures in last 24h',
    'medium'::TEXT
  FROM google_ads_connections c
  WHERE (
    SELECT COUNT(*) 
    FROM google_ads_sync_logs sl 
    WHERE sl.connection_id = c.id 
      AND sl.status = 'failed'
      AND sl.started_at >= NOW() - INTERVAL '24 hours'
  ) >= 3;
  
  -- Dados muito antigos
  RETURN QUERY
  SELECT 
    'stale_data'::TEXT,
    c.client_id,
    'No sync in last 12 hours',
    'low'::TEXT
  FROM google_ads_connections c
  WHERE c.last_sync_at < NOW() - INTERVAL '12 hours';
END;
$$ LANGUAGE plpgsql;
```

### 2. Manutenção Regular

```bash
# Cron job diário para limpeza
0 2 * * * /app/scripts/daily-google-maintenance.sh

# Conteúdo do script:
#!/bin/bash
# Limpar OAuth states expirados
psql -c "SELECT cleanup_expired_oauth_states();"

# Limpar logs antigos
psql -c "DELETE FROM google_ads_sync_logs WHERE created_at < NOW() - INTERVAL '30 days';"

# Verificar saúde do sistema
node scripts/health-check-google.js
```

### 3. Backup de Configurações

```bash
# Backup de conexões (sem tokens)
pg_dump --table=google_ads_connections \
        --data-only \
        --column-inserts \
        --exclude-column=refresh_token \
        --exclude-column=access_token \
        > backup/google_connections_$(date +%Y%m%d).sql
```

## Contato e Suporte

### Logs Importantes para Suporte

Ao reportar problemas, inclua:

1. **ID do Cliente:** UUID do cliente afetado
2. **Timestamp:** Quando o problema ocorreu
3. **Logs de Sync:** Últimos 5 logs de sincronização
4. **Configuração:** Resultado do `check-google-ads-env.js`
5. **Métricas:** Resultado das queries de diagnóstico

### Escalação

1. **Nível 1:** Problemas de usuário (reconexão, dados desatualizados)
2. **Nível 2:** Problemas técnicos (performance, sync failures)
3. **Nível 3:** Problemas de infraestrutura (rate limits, API changes)

### Recursos Externos

- [Google Ads API Documentation](https://developers.google.com/google-ads/api/docs)
- [OAuth 2.0 Troubleshooting](https://developers.google.com/identity/protocols/oauth2/troubleshooting)
- [Google Ads API Forum](https://groups.google.com/g/adwords-api)