# Google Ads API v22 - Referência Rápida

## 🚀 Quick Start

### Variáveis de Ambiente

```bash
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
GOOGLE_ADS_DEVELOPER_TOKEN=xxxxxxxxxxxxxxxx
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Iniciar OAuth Flow

```typescript
// POST /api/google/auth
const response = await fetch('/api/google/auth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ clientId: 'uuid-do-cliente' })
});

const { authUrl } = await response.json();
window.location.href = authUrl;
```

### Listar Contas Acessíveis

```typescript
// GET /api/google/accounts?clientId=xxx
const accounts = await fetch(`/api/google/accounts?clientId=${clientId}`)
  .then(r => r.json());

// Retorna:
[
  {
    customerId: "1234567890",
    descriptiveName: "Minha Conta",
    currencyCode: "BRL",
    timeZone: "America/Sao_Paulo",
    canManageClients: false
  }
]
```

### Selecionar Contas

```typescript
// POST /api/google/accounts/select
await fetch('/api/google/accounts/select', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    clientId: 'uuid-do-cliente',
    selectedAccounts: ['1234567890', '0987654321']
  })
});
```

### Sincronizar Campanhas

```typescript
// POST /api/google/sync
await fetch('/api/google/sync', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ clientId: 'uuid-do-cliente' })
});
```

## 📡 Headers da API

### Headers Obrigatórios

```typescript
{
  'Authorization': `Bearer ${access_token}`,
  'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
  'Content-Type': 'application/json'
}
```

### Com MCC (Manager Account)

```typescript
{
  'Authorization': `Bearer ${access_token}`,
  'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
  'login-customer-id': '1234567890', // MCC ID
  'Content-Type': 'application/json'
}
```

## 🔐 Gerenciamento de Tokens

### Obter Token Válido

```typescript
import { getGoogleTokenManager } from '@/lib/google/token-manager';

const tokenManager = getGoogleTokenManager();
const validToken = await tokenManager.ensureValidToken(connectionId);
```

### Refresh Manual

```typescript
const result = await tokenManager.refreshAccessToken(
  connectionId,
  refreshToken
);

if (result.success) {
  console.log('Token renovado:', result.accessToken);
} else {
  console.error('Erro:', result.error);
}
```

### Revogar Token

```typescript
await tokenManager.revokeTokens(connectionId);
```

## 🔍 Google Ads Query Language (GAQL)

### Estrutura Básica

```sql
SELECT
  [campos]
FROM [recurso]
WHERE [condições]
ORDER BY [campo]
LIMIT [número]
```

### Exemplo: Campanhas

```sql
SELECT
  campaign.id,
  campaign.name,
  campaign.status,
  campaign_budget.amount_micros,
  metrics.impressions,
  metrics.clicks,
  metrics.cost_micros
FROM campaign
WHERE campaign.status != 'REMOVED'
  AND segments.date BETWEEN '2024-01-01' AND '2024-01-31'
ORDER BY metrics.impressions DESC
LIMIT 100
```

### Exemplo: Grupos de Anúncios

```sql
SELECT
  ad_group.id,
  ad_group.name,
  ad_group.status,
  campaign.name,
  metrics.impressions,
  metrics.clicks
FROM ad_group
WHERE ad_group.status = 'ENABLED'
  AND campaign.id = 12345
```

### Exemplo: Anúncios

```sql
SELECT
  ad_group_ad.ad.id,
  ad_group_ad.ad.name,
  ad_group_ad.status,
  ad_group.name,
  campaign.name,
  metrics.impressions,
  metrics.clicks,
  metrics.conversions
FROM ad_group_ad
WHERE ad_group_ad.status = 'ENABLED'
  AND segments.date = '2024-01-20'
```

## 🛠️ Usando o Client

### Inicializar Client

```typescript
import { getGoogleAdsClient } from '@/lib/google/client';

const client = getGoogleAdsClient({
  accessToken: 'ya29.xxx',
  refreshToken: '1//xxx',
  developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
  customerId: '1234567890',
  loginCustomerId: '9876543210', // Opcional: MCC ID
  connectionId: 'uuid-da-conexao' // Recomendado: para refresh automático
});
```

### Listar Campanhas

```typescript
const campaigns = await client.getCampaigns({
  startDate: '2024-01-01',
  endDate: '2024-01-31'
});

campaigns.forEach(campaign => {
  console.log(`${campaign.name}: ${campaign.metrics.impressions} impressões`);
});
```

### Obter Métricas de Campanha

```typescript
const metrics = await client.getCampaignMetrics(
  '12345', // Campaign ID
  {
    startDate: '2024-01-01',
    endDate: '2024-01-31'
  }
);

console.log('Custo total:', metrics.cost);
console.log('Conversões:', metrics.conversions);
console.log('ROAS:', metrics.roas);
```

### Informações da Conta

```typescript
const accountInfo = await client.getAccountInfo();

console.log('Nome:', accountInfo.descriptiveName);
console.log('Moeda:', accountInfo.currencyCode);
console.log('É MCC?', accountInfo.canManageClients);
```

## 📊 Conversões de Valores

### Micros para Moeda

```typescript
// Google retorna valores em micros (1/1,000,000)
const costMicros = 5000000; // 5 milhões de micros
const cost = costMicros / 1_000_000; // 5.00 BRL
```

### Moeda para Micros

```typescript
const budget = 100.50; // 100.50 BRL
const budgetMicros = Math.round(budget * 1_000_000); // 100500000
```

### Percentuais

```typescript
// CTR vem como decimal (0.05 = 5%)
const ctr = 0.05;
const ctrPercent = ctr * 100; // 5%

// Conversion rate também
const convRate = 0.025;
const convRatePercent = convRate * 100; // 2.5%
```

## 🔄 Sincronização

### Sync Service

```typescript
import { getGoogleAdsSyncService } from '@/lib/google/sync-service';

const syncService = getGoogleAdsSyncService();

// Sincronizar um cliente
await syncService.syncClient(clientId);

// Sincronizar múltiplos clientes
await syncService.syncMultipleClients([clientId1, clientId2]);

// Sincronizar com período específico
await syncService.syncClientWithDateRange(clientId, {
  startDate: '2024-01-01',
  endDate: '2024-01-31'
});
```

### Sync Queue

```typescript
import { getGoogleAdsSyncQueue } from '@/lib/google/sync-queue-manager';

const queue = getGoogleAdsSyncQueue();

// Adicionar à fila
await queue.enqueue({
  clientId,
  priority: 'high',
  syncType: 'full'
});

// Processar fila
await queue.processQueue();
```

## 🗄️ Repositório de Dados

### Google Ads Repository

```typescript
import { getGoogleAdsRepository } from '@/lib/repositories/google-ads-repository';

const repo = getGoogleAdsRepository();

// Buscar conexões ativas
const connections = await repo.getActiveConnections(clientId);

// Buscar campanhas
const campaigns = await repo.getCampaigns(clientId, {
  startDate: '2024-01-01',
  endDate: '2024-01-31'
});

// Salvar métricas
await repo.saveMetrics(campaignId, metrics, date);
```

## 🚨 Tratamento de Erros

### Error Handler

```typescript
import { GoogleAdsErrorHandler } from '@/lib/google/error-handler';

const errorHandler = new GoogleAdsErrorHandler();

try {
  await client.getCampaigns();
} catch (error) {
  const handled = errorHandler.handleError(error);
  
  if (handled.isRetryable) {
    // Tentar novamente
    await retry();
  } else {
    // Erro permanente
    console.error(handled.message);
  }
}
```

### Códigos de Erro Comuns

```typescript
// 401 - Token inválido ou expirado
if (error.code === 401) {
  await tokenManager.refreshAccessToken(connectionId, refreshToken);
}

// 403 - Sem permissão
if (error.code === 403) {
  console.error('Sem acesso à conta ou developer token não aprovado');
}

// 429 - Rate limit
if (error.code === 429) {
  await sleep(60000); // Aguardar 1 minuto
}

// 500 - Erro do servidor Google
if (error.code === 500) {
  await exponentialBackoff(retryCount);
}
```

## 📈 Monitoramento

### Performance Monitor

```typescript
import { getGoogleAdsPerformanceMonitor } from '@/lib/google/performance-monitor';

const monitor = getGoogleAdsPerformanceMonitor();

// Registrar operação
await monitor.recordOperation({
  operation: 'sync_campaigns',
  clientId,
  duration: 1500, // ms
  success: true
});

// Obter métricas
const metrics = await monitor.getMetrics(clientId);
console.log('Taxa de sucesso:', metrics.successRate);
console.log('Tempo médio:', metrics.avgDuration);
```

### Logging

```typescript
import { googleAdsLogger } from '@/lib/google/logger';

googleAdsLogger.info('Iniciando sincronização', { clientId });
googleAdsLogger.error('Erro na sincronização', { error, clientId });
googleAdsLogger.debug('Token renovado', { connectionId });
```

## 🧪 Testes

### Testar Conexão

```bash
curl http://localhost:3000/api/google/debug-oauth-status?clientId=xxx
```

### Testar API Call

```bash
curl http://localhost:3000/api/google/test-api-call?clientId=xxx
```

### Verificar Status

```bash
curl http://localhost:3000/api/google/check-api-status?clientId=xxx
```

## 📚 Recursos Úteis

### Endpoints da API

- **Base URL:** `https://googleads.googleapis.com/v22`
- **List Customers:** `GET /customers:listAccessibleCustomers`
- **Search:** `POST /customers/{customerId}/googleAds:search`
- **Search Stream:** `POST /customers/{customerId}/googleAds:searchStream`

### Documentação

- **API Reference:** https://developers.google.com/google-ads/api/rest/reference
- **GAQL Fields:** https://developers.google.com/google-ads/api/fields/v22/overview
- **OAuth Guide:** https://developers.google.com/google-ads/api/docs/oauth/overview

### Ferramentas

- **Query Builder:** https://developers.google.com/google-ads/api/fields/v22/overview_query_builder
- **API Explorer:** https://developers.google.com/google-ads/api/rest/reference
- **OAuth Playground:** https://developers.google.com/oauthplayground/

## 🔧 Comandos Úteis

```bash
# Verificar configuração
node scripts/check-env.js

# Testar integração
npm run test:google-ads

# Sincronizar dados
npm run sync:google-ads

# Limpar cache
npm run cache:clear:google

# Ver logs
npm run logs:google-ads
```

## 💡 Dicas

1. **Sempre use connectionId** ao criar o client para refresh automático
2. **Cache queries frequentes** para reduzir chamadas à API
3. **Use batch operations** quando possível
4. **Implemente retry logic** para erros temporários
5. **Monitore rate limits** e ajuste frequência de sync
6. **Criptografe tokens** sempre antes de armazenar
7. **Audite operações** para compliance e debug
8. **Use MCC** para gerenciar múltiplas contas eficientemente

---

**Versão:** v22
**Última atualização:** 2024-01-20
