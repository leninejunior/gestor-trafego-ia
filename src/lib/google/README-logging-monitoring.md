# Google Ads Logging and Monitoring System

Este documento descreve o sistema completo de logging e monitoring para a integraÃ§Ã£o do Google Ads.

## Componentes Principais

### 1. Logger Estruturado (`logger.ts`)

O `GoogleAdsLogger` fornece logging estruturado para todas as operaÃ§Ãµes do Google Ads:

```typescript
import { googleAdsLogger } from '@/lib/google/logger';

// Log de operaÃ§Ãµes bÃ¡sicas
googleAdsLogger.info('Operation completed', { clientId: 'abc123' });
googleAdsLogger.error('API call failed', error, { connectionId: 'conn123' });

// Log de eventos especÃ­ficos
const requestId = googleAdsLogger.apiRequestStart('GET', '/campaigns');
googleAdsLogger.apiRequestComplete(requestId, 200, 1500);

const syncId = googleAdsLogger.syncStart('campaigns');
googleAdsLogger.syncComplete(syncId, result, duration);

// Log de autenticaÃ§Ã£o
googleAdsLogger.authEvent('token_refresh', { connectionId: 'conn123' });

// Log de performance
googleAdsLogger.performance('sync_campaigns', {
  duration: 5000,
  recordsProcessed: 150,
  apiCalls: 10
});
```

### 2. Monitor de Performance (`performance-monitor.ts`)

O `GoogleAdsPerformanceMonitor` rastreia mÃ©tricas de performance em tempo real:

```typescript
import { googleAdsPerformanceMonitor } from '@/lib/google/performance-monitor';

// Iniciar monitoramento
const operationId = googleAdsPerformanceMonitor.startOperation(
  'sync_123',
  'sync_campaigns',
  { clientId: 'abc123' }
);

// Atualizar mÃ©tricas durante a operaÃ§Ã£o
googleAdsPerformanceMonitor.updateOperation(operationId, {
  recordsProcessed: 50,
  apiCalls: 5
});

// Finalizar monitoramento
await googleAdsPerformanceMonitor.finishOperation(operationId, {
  connectionId: 'conn123',
  clientId: 'abc123'
});

// Obter estatÃ­sticas
const stats = await googleAdsPerformanceMonitor.getPerformanceStats('sync_campaigns', 24);
```

### 3. ServiÃ§o de Monitoring (`monitoring.ts`)

O `GoogleAdsMonitoringService` coleta mÃ©tricas agregadas e verifica alertas:

```typescript
import { googleAdsMonitoring } from '@/lib/google/monitoring';

// Coletar mÃ©tricas
const metrics = await googleAdsMonitoring.collectMetrics('24h');

// Verificar alertas
const alerts = await googleAdsMonitoring.checkAlerts();

// Verificar saÃºde do sistema
const health = await googleAdsMonitoring.getHealthStatus();

// Armazenar mÃ©tricas
await googleAdsMonitoring.storeMetrics(metrics);
```

## Schema do Banco de Dados

### Tabelas de Monitoring

1. **`google_ads_metrics_history`** - MÃ©tricas agregadas por perÃ­odo
2. **`google_ads_alerts`** - Alertas ativos e resolvidos
3. **`google_ads_performance_logs`** - Logs detalhados de performance
4. **`google_ads_api_logs`** - Logs de requisiÃ§Ãµes da API

### Aplicar Schema

```bash
node scripts/apply-google-monitoring-schema.js
```

## APIs de Monitoring

### MÃ©tricas
- `GET /api/google/monitoring/metrics` - Obter mÃ©tricas atuais
- `POST /api/google/monitoring/metrics` - Coletar mÃ©tricas manualmente

### Alertas
- `GET /api/google/monitoring/alerts` - Listar alertas
- `POST /api/google/monitoring/alerts` - Verificar alertas manualmente
- `PATCH /api/google/monitoring/alerts` - Resolver/reativar alertas

### SaÃºde do Sistema
- `GET /api/google/monitoring/health` - Status de saÃºde do sistema

## Cron Jobs

### Monitoring AutomÃ¡tico
- **FrequÃªncia**: A cada 15 minutos
- **Endpoint**: `/api/cron/google-monitoring`
- **FunÃ§Ã£o**: Coleta mÃ©tricas e verifica alertas

### ConfiguraÃ§Ã£o plataforma de deploy
```json
{
  "crons": [
    {
      "path": "/api/cron/google-monitoring",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

## Dashboard de Monitoring

### Componente Principal
```typescript
import { GoogleAdsMonitoringDashboard } from '@/components/google/monitoring-dashboard';

// Usar no dashboard
<GoogleAdsMonitoringDashboard />
```

### PÃ¡gina do Dashboard
- **URL**: `/dashboard/google/monitoring`
- **Funcionalidades**:
  - Status de saÃºde do sistema
  - MÃ©tricas de performance
  - Alertas ativos
  - EstatÃ­sticas de operaÃ§Ãµes

## Tipos de Alertas

### 1. Error Rate (`error_rate`)
- **Threshold**: 10% de taxa de erro
- **Severidade**: High/Critical
- **AÃ§Ã£o**: Investigar logs de erro

### 2. Sync Failure (`sync_failure`)
- **Threshold**: 20% de falhas de sync
- **Severidade**: High/Critical
- **AÃ§Ã£o**: Verificar conexÃµes e tokens

### 3. Token Expiry (`token_expiry`)
- **Threshold**: Tokens expirados detectados
- **Severidade**: Medium
- **AÃ§Ã£o**: Renovar tokens OAuth

### 4. Rate Limit (`rate_limit`)
- **Threshold**: Muitos hits de rate limit
- **Severidade**: Medium/High
- **AÃ§Ã£o**: Implementar backoff mais agressivo

### 5. Performance (`performance`)
- **Threshold**: OperaÃ§Ãµes muito lentas
- **Severidade**: Medium
- **AÃ§Ã£o**: Otimizar queries e operaÃ§Ãµes

## IntegraÃ§Ã£o com ServiÃ§os

### Sync Service
O sistema de monitoring estÃ¡ integrado automaticamente no `GoogleAdsSyncService`:

```typescript
// Performance monitoring Ã© iniciado automaticamente
const result = await syncService.syncCampaigns(options);

// MÃ©tricas sÃ£o coletadas e armazenadas
// Alertas sÃ£o verificados apÃ³s cada sync
```

### Error Handler
Erros sÃ£o automaticamente categorizados e podem gerar alertas:

```typescript
// Erros crÃ­ticos geram alertas automaticamente
googleAdsLogger.error('Critical sync failure', error, context);
```

## ConfiguraÃ§Ã£o de Ambiente

### VariÃ¡veis NecessÃ¡rias
```env
# Para cron jobs
CRON_SECRET=your-secret-key

# Supabase (jÃ¡ existentes)
NEXT_PUBLIC_SUPABASE_URL=your-url
SUPABASE_SERVICE_ROLE_KEY=your-key
```

## Thresholds ConfigurÃ¡veis

### Performance Monitor
```typescript
const thresholds = {
  maxDuration: 30000,        // 30 segundos
  maxMemoryUsage: 100MB,     // 100MB
  maxApiCalls: 100,          // 100 chamadas
  maxErrorRate: 0.1          // 10%
};
```

### Monitoring Service
```typescript
const alertThresholds = {
  ERROR_RATE: 0.1,           // 10%
  SYNC_FAILURE_RATE: 0.2,   // 20%
  API_RESPONSE_TIME: 5000,   // 5 segundos
  TOKEN_EXPIRY_HOURS: 24,    // 24 horas
  RATE_LIMIT_HITS_PER_HOUR: 10
};
```

## RetenÃ§Ã£o de Dados

### PolÃ­ticas AutomÃ¡ticas
- **MÃ©tricas histÃ³ricas**: 90 dias
- **Logs de performance**: 30 dias
- **Logs de API**: 30 dias
- **Alertas resolvidos**: 30 dias

### Limpeza AutomÃ¡tica
Executada diariamente Ã s 2:00 AM via cron job.

## Troubleshooting

### Logs NÃ£o Aparecem
1. Verificar se as tabelas de monitoring existem
2. Verificar permissÃµes RLS
3. Verificar se o service role estÃ¡ configurado

### Alertas NÃ£o Funcionam
1. Verificar thresholds de alerta
2. Verificar se hÃ¡ dados suficientes para anÃ¡lise
3. Verificar logs do cron job

### Performance Lenta
1. Verificar Ã­ndices do banco de dados
2. Verificar retenÃ§Ã£o de dados
3. Executar limpeza manual se necessÃ¡rio

## PrÃ³ximos Passos

1. **IntegraÃ§Ã£o com ServiÃ§os Externos**:
   - Slack/Discord para alertas
   - Datadog/New Relic para mÃ©tricas
   - PagerDuty para incidentes crÃ­ticos

2. **Dashboard AvanÃ§ado**:
   - GrÃ¡ficos de tendÃªncia
   - ComparaÃ§Ã£o histÃ³rica
   - Drill-down por cliente

3. **Alertas Inteligentes**:
   - Machine learning para detecÃ§Ã£o de anomalias
   - Alertas preditivos
   - Auto-resoluÃ§Ã£o de problemas comuns

4. **OtimizaÃ§Ãµes**:
   - Cache de mÃ©tricas
   - AgregaÃ§Ãµes em tempo real
   - CompressÃ£o de dados histÃ³ricos
