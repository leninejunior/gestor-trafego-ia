# Google Ads Logging and Monitoring System

Este documento descreve o sistema completo de logging e monitoring para a integração do Google Ads.

## Componentes Principais

### 1. Logger Estruturado (`logger.ts`)

O `GoogleAdsLogger` fornece logging estruturado para todas as operações do Google Ads:

```typescript
import { googleAdsLogger } from '@/lib/google/logger';

// Log de operações básicas
googleAdsLogger.info('Operation completed', { clientId: 'abc123' });
googleAdsLogger.error('API call failed', error, { connectionId: 'conn123' });

// Log de eventos específicos
const requestId = googleAdsLogger.apiRequestStart('GET', '/campaigns');
googleAdsLogger.apiRequestComplete(requestId, 200, 1500);

const syncId = googleAdsLogger.syncStart('campaigns');
googleAdsLogger.syncComplete(syncId, result, duration);

// Log de autenticação
googleAdsLogger.authEvent('token_refresh', { connectionId: 'conn123' });

// Log de performance
googleAdsLogger.performance('sync_campaigns', {
  duration: 5000,
  recordsProcessed: 150,
  apiCalls: 10
});
```

### 2. Monitor de Performance (`performance-monitor.ts`)

O `GoogleAdsPerformanceMonitor` rastreia métricas de performance em tempo real:

```typescript
import { googleAdsPerformanceMonitor } from '@/lib/google/performance-monitor';

// Iniciar monitoramento
const operationId = googleAdsPerformanceMonitor.startOperation(
  'sync_123',
  'sync_campaigns',
  { clientId: 'abc123' }
);

// Atualizar métricas durante a operação
googleAdsPerformanceMonitor.updateOperation(operationId, {
  recordsProcessed: 50,
  apiCalls: 5
});

// Finalizar monitoramento
await googleAdsPerformanceMonitor.finishOperation(operationId, {
  connectionId: 'conn123',
  clientId: 'abc123'
});

// Obter estatísticas
const stats = await googleAdsPerformanceMonitor.getPerformanceStats('sync_campaigns', 24);
```

### 3. Serviço de Monitoring (`monitoring.ts`)

O `GoogleAdsMonitoringService` coleta métricas agregadas e verifica alertas:

```typescript
import { googleAdsMonitoring } from '@/lib/google/monitoring';

// Coletar métricas
const metrics = await googleAdsMonitoring.collectMetrics('24h');

// Verificar alertas
const alerts = await googleAdsMonitoring.checkAlerts();

// Verificar saúde do sistema
const health = await googleAdsMonitoring.getHealthStatus();

// Armazenar métricas
await googleAdsMonitoring.storeMetrics(metrics);
```

## Schema do Banco de Dados

### Tabelas de Monitoring

1. **`google_ads_metrics_history`** - Métricas agregadas por período
2. **`google_ads_alerts`** - Alertas ativos e resolvidos
3. **`google_ads_performance_logs`** - Logs detalhados de performance
4. **`google_ads_api_logs`** - Logs de requisições da API

### Aplicar Schema

```bash
node scripts/apply-google-monitoring-schema.js
```

## APIs de Monitoring

### Métricas
- `GET /api/google/monitoring/metrics` - Obter métricas atuais
- `POST /api/google/monitoring/metrics` - Coletar métricas manualmente

### Alertas
- `GET /api/google/monitoring/alerts` - Listar alertas
- `POST /api/google/monitoring/alerts` - Verificar alertas manualmente
- `PATCH /api/google/monitoring/alerts` - Resolver/reativar alertas

### Saúde do Sistema
- `GET /api/google/monitoring/health` - Status de saúde do sistema

## Cron Jobs

### Monitoring Automático
- **Frequência**: A cada 15 minutos
- **Endpoint**: `/api/cron/google-monitoring`
- **Função**: Coleta métricas e verifica alertas

### Configuração Vercel
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

### Página do Dashboard
- **URL**: `/dashboard/google/monitoring`
- **Funcionalidades**:
  - Status de saúde do sistema
  - Métricas de performance
  - Alertas ativos
  - Estatísticas de operações

## Tipos de Alertas

### 1. Error Rate (`error_rate`)
- **Threshold**: 10% de taxa de erro
- **Severidade**: High/Critical
- **Ação**: Investigar logs de erro

### 2. Sync Failure (`sync_failure`)
- **Threshold**: 20% de falhas de sync
- **Severidade**: High/Critical
- **Ação**: Verificar conexões e tokens

### 3. Token Expiry (`token_expiry`)
- **Threshold**: Tokens expirados detectados
- **Severidade**: Medium
- **Ação**: Renovar tokens OAuth

### 4. Rate Limit (`rate_limit`)
- **Threshold**: Muitos hits de rate limit
- **Severidade**: Medium/High
- **Ação**: Implementar backoff mais agressivo

### 5. Performance (`performance`)
- **Threshold**: Operações muito lentas
- **Severidade**: Medium
- **Ação**: Otimizar queries e operações

## Integração com Serviços

### Sync Service
O sistema de monitoring está integrado automaticamente no `GoogleAdsSyncService`:

```typescript
// Performance monitoring é iniciado automaticamente
const result = await syncService.syncCampaigns(options);

// Métricas são coletadas e armazenadas
// Alertas são verificados após cada sync
```

### Error Handler
Erros são automaticamente categorizados e podem gerar alertas:

```typescript
// Erros críticos geram alertas automaticamente
googleAdsLogger.error('Critical sync failure', error, context);
```

## Configuração de Ambiente

### Variáveis Necessárias
```env
# Para cron jobs
CRON_SECRET=your-secret-key

# Supabase (já existentes)
NEXT_PUBLIC_SUPABASE_URL=your-url
SUPABASE_SERVICE_ROLE_KEY=your-key
```

## Thresholds Configuráveis

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

## Retenção de Dados

### Políticas Automáticas
- **Métricas históricas**: 90 dias
- **Logs de performance**: 30 dias
- **Logs de API**: 30 dias
- **Alertas resolvidos**: 30 dias

### Limpeza Automática
Executada diariamente às 2:00 AM via cron job.

## Troubleshooting

### Logs Não Aparecem
1. Verificar se as tabelas de monitoring existem
2. Verificar permissões RLS
3. Verificar se o service role está configurado

### Alertas Não Funcionam
1. Verificar thresholds de alerta
2. Verificar se há dados suficientes para análise
3. Verificar logs do cron job

### Performance Lenta
1. Verificar índices do banco de dados
2. Verificar retenção de dados
3. Executar limpeza manual se necessário

## Próximos Passos

1. **Integração com Serviços Externos**:
   - Slack/Discord para alertas
   - Datadog/New Relic para métricas
   - PagerDuty para incidentes críticos

2. **Dashboard Avançado**:
   - Gráficos de tendência
   - Comparação histórica
   - Drill-down por cliente

3. **Alertas Inteligentes**:
   - Machine learning para detecção de anomalias
   - Alertas preditivos
   - Auto-resolução de problemas comuns

4. **Otimizações**:
   - Cache de métricas
   - Agregações em tempo real
   - Compressão de dados históricos