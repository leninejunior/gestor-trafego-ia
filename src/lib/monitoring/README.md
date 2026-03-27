# Sistema de Monitoramento

Sistema completo de observabilidade e alertas para o cache de dados histÃ³ricos multi-plataforma.

## Componentes

### 1. ObservabilityService

Coleta e gerencia mÃ©tricas de observabilidade do sistema.

**MÃ©tricas DisponÃ­veis:**

- **Taxa de Sucesso por Plataforma**: Percentual de syncs bem-sucedidos
- **Tempo MÃ©dio de Sync**: DuraÃ§Ã£o mÃ©dia das sincronizaÃ§Ãµes
- **Uso de Storage**: Armazenamento utilizado por cliente
- **Chamadas de API**: Volume de chamadas por plataforma
- **SaÃºde do Sistema**: MÃ©tricas gerais de status

**Exemplo de Uso:**

```typescript
import { ObservabilityService } from '@/lib/monitoring/observability-service';

const observability = new ObservabilityService();

// Obter taxa de sucesso por plataforma
const syncMetrics = await observability.getSyncSuccessRateByPlatform();

// Obter uso de storage por cliente
const storageMetrics = await observability.getStorageUsageByClient();

// Registrar mÃ©tricas de sync
await observability.recordSyncMetrics(syncConfigId, {
  status: 'completed',
  durationMs: 45000,
  recordsSynced: 1250,
  recordsFailed: 0,
  apiCallsMade: 15,
});
```

### 2. AlertService

Gerencia alertas automÃ¡ticos do sistema.

**Tipos de Alertas:**

- **storage_limit**: Storage atingiu 80% da capacidade
- **consecutive_failures**: 3+ falhas consecutivas de sync
- **token_expired**: Tokens OAuth expirados ou prÃ³ximos de expirar
- **performance_degraded**: Performance abaixo do esperado

**Exemplo de Uso:**

```typescript
import { AlertService } from '@/lib/monitoring/alert-service';

const alertService = new AlertService();

// Executar todas as verificaÃ§Ãµes
const alerts = await alertService.runAllChecks();

// Obter alertas ativos
const activeAlerts = await alertService.getActiveAlerts('critical');

// Reconhecer alerta
await alertService.acknowledgeAlert(alertId);

// Resolver alerta
await alertService.resolveAlert(alertId);
```

### 3. Database Functions

FunÃ§Ãµes SQL otimizadas para consultas de mÃ©tricas.

**FunÃ§Ãµes DisponÃ­veis:**

```sql
-- MÃ©tricas de storage por cliente
SELECT * FROM get_storage_metrics_by_client();

-- Uso total de storage
SELECT * FROM get_total_storage_usage();

-- Resumo de mÃ©tricas de sync
SELECT * FROM get_sync_metrics_summary('2025-01-01', '2025-01-31');

-- Top clientes por uso de storage
SELECT * FROM get_top_storage_clients(10);

-- EstatÃ­sticas de falhas
SELECT * FROM get_sync_failure_stats(24);

-- Resumo de alertas
SELECT * FROM get_alerts_summary();
```

## API Endpoints

### System Health

```
GET /api/admin/monitoring/system-health
```

Retorna mÃ©tricas gerais de saÃºde do sistema.

**Response:**
```json
{
  "success": true,
  "data": {
    "total_clients": 45,
    "active_sync_configs": 38,
    "pending_syncs": 5,
    "failed_syncs_last_24h": 2,
    "storage_usage_mb": 1250.45,
    "avg_sync_duration_ms": 32500
  }
}
```

### Sync Logs

```
GET /api/admin/monitoring/sync-logs?platform=meta&status=failed&limit=50
```

Retorna logs de sincronizaÃ§Ã£o com filtros.

**Query Parameters:**
- `platform`: meta | google
- `status`: completed | failed | partial
- `limit`: nÃºmero de registros (padrÃ£o: 50)
- `offset`: offset para paginaÃ§Ã£o (padrÃ£o: 0)

### Alerts

```
GET /api/admin/monitoring/alerts?severity=critical
```

Retorna alertas ativos do sistema.

**Query Parameters:**
- `severity`: info | warning | critical

```
PATCH /api/admin/monitoring/alerts
```

Gerencia alertas (reconhecer ou resolver).

**Body:**
```json
{
  "alert_id": "uuid",
  "action": "acknowledge" | "resolve"
}
```

## Cron Jobs

### Alert Checker

Executa verificaÃ§Ãµes de alertas periodicamente.

```
GET /api/cron/alert-checker
Authorization: Bearer {CRON_SECRET}
```

**ConfiguraÃ§Ã£o plataforma de deploy:**

```json
{
  "crons": [
    {
      "path": "/api/cron/alert-checker",
      "schedule": "*/30 * * * *"
    }
  ]
}
```

## Dashboard Admin

Acesse o dashboard de monitoramento em:

```
/admin/system-monitoring
```

**Recursos:**

- âœ… MÃ©tricas em tempo real
- âœ… VisualizaÃ§Ã£o de alertas ativos
- âœ… Logs de sincronizaÃ§Ã£o
- âœ… Auto-refresh a cada 30 segundos
- âœ… Reconhecer e resolver alertas
- âœ… Filtros por plataforma e status

## ConfiguraÃ§Ã£o

### VariÃ¡veis de Ambiente

```env
# Secret para cron jobs
CRON_SECRET=your-secret-key

# Limites de storage (opcional)
STORAGE_LIMIT_MB=10240  # 10GB
```

### Database Setup

Execute os scripts SQL na ordem:

1. `database/historical-data-cache-schema.sql` (se ainda nÃ£o executado)
2. `database/observability-functions.sql`
3. `database/alerts-schema.sql`

```bash
# Via Supabase CLI
supabase db push

# Ou via SQL Editor no Supabase Dashboard
```

## Thresholds PadrÃ£o

| Alerta | Threshold | Intervalo |
|--------|-----------|-----------|
| Storage Limit | 80% | 60 min |
| Consecutive Failures | 3 falhas | 30 min |
| Token Expiration | 24h antes | 120 min |
| Performance Degraded | 5 min avg | 60 min |

## Monitoramento de Performance

### MÃ©tricas Coletadas

1. **Sync Performance**
   - DuraÃ§Ã£o mÃ©dia por plataforma
   - Taxa de sucesso
   - Volume de dados sincronizados

2. **Storage Usage**
   - Uso total em MB
   - Uso por cliente
   - Crescimento ao longo do tempo

3. **API Calls**
   - Total de chamadas
   - Chamadas nas Ãºltimas 24h/7d
   - MÃ©dia por sync

4. **System Health**
   - Clientes ativos
   - Syncs pendentes
   - Falhas recentes

## Troubleshooting

### Alertas NÃ£o Aparecem

1. Verificar se cron job estÃ¡ configurado
2. Verificar logs do cron: `/api/cron/alert-checker`
3. Verificar RLS policies na tabela `system_alerts`

### MÃ©tricas Incorretas

1. Verificar se funÃ§Ãµes SQL foram criadas
2. Executar `SELECT * FROM get_sync_metrics_summary()` manualmente
3. Verificar logs de sync na tabela `sync_logs`

### Performance Lenta

1. Verificar Ã­ndices nas tabelas
2. Analisar query plans: `EXPLAIN ANALYZE`
3. Considerar particionamento adicional

## PrÃ³ximos Passos

- [ ] IntegraÃ§Ã£o com Slack para notificaÃ§Ãµes
- [ ] Webhooks para alertas crÃ­ticos
- [ ] ExportaÃ§Ã£o de mÃ©tricas para Prometheus
- [ ] Dashboards customizÃ¡veis
- [ ] Alertas baseados em ML

## ReferÃªncias

- Requirements: 9.1, 9.2, 9.3, 9.4
- Design: Monitoring & Observability section
- Database: `observability-functions.sql`, `alerts-schema.sql`

