# Sistema de Monitoramento

Sistema completo de observabilidade e alertas para o cache de dados históricos multi-plataforma.

## Componentes

### 1. ObservabilityService

Coleta e gerencia métricas de observabilidade do sistema.

**Métricas Disponíveis:**

- **Taxa de Sucesso por Plataforma**: Percentual de syncs bem-sucedidos
- **Tempo Médio de Sync**: Duração média das sincronizações
- **Uso de Storage**: Armazenamento utilizado por cliente
- **Chamadas de API**: Volume de chamadas por plataforma
- **Saúde do Sistema**: Métricas gerais de status

**Exemplo de Uso:**

```typescript
import { ObservabilityService } from '@/lib/monitoring/observability-service';

const observability = new ObservabilityService();

// Obter taxa de sucesso por plataforma
const syncMetrics = await observability.getSyncSuccessRateByPlatform();

// Obter uso de storage por cliente
const storageMetrics = await observability.getStorageUsageByClient();

// Registrar métricas de sync
await observability.recordSyncMetrics(syncConfigId, {
  status: 'completed',
  durationMs: 45000,
  recordsSynced: 1250,
  recordsFailed: 0,
  apiCallsMade: 15,
});
```

### 2. AlertService

Gerencia alertas automáticos do sistema.

**Tipos de Alertas:**

- **storage_limit**: Storage atingiu 80% da capacidade
- **consecutive_failures**: 3+ falhas consecutivas de sync
- **token_expired**: Tokens OAuth expirados ou próximos de expirar
- **performance_degraded**: Performance abaixo do esperado

**Exemplo de Uso:**

```typescript
import { AlertService } from '@/lib/monitoring/alert-service';

const alertService = new AlertService();

// Executar todas as verificações
const alerts = await alertService.runAllChecks();

// Obter alertas ativos
const activeAlerts = await alertService.getActiveAlerts('critical');

// Reconhecer alerta
await alertService.acknowledgeAlert(alertId);

// Resolver alerta
await alertService.resolveAlert(alertId);
```

### 3. Database Functions

Funções SQL otimizadas para consultas de métricas.

**Funções Disponíveis:**

```sql
-- Métricas de storage por cliente
SELECT * FROM get_storage_metrics_by_client();

-- Uso total de storage
SELECT * FROM get_total_storage_usage();

-- Resumo de métricas de sync
SELECT * FROM get_sync_metrics_summary('2025-01-01', '2025-01-31');

-- Top clientes por uso de storage
SELECT * FROM get_top_storage_clients(10);

-- Estatísticas de falhas
SELECT * FROM get_sync_failure_stats(24);

-- Resumo de alertas
SELECT * FROM get_alerts_summary();
```

## API Endpoints

### System Health

```
GET /api/admin/monitoring/system-health
```

Retorna métricas gerais de saúde do sistema.

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

Retorna logs de sincronização com filtros.

**Query Parameters:**
- `platform`: meta | google
- `status`: completed | failed | partial
- `limit`: número de registros (padrão: 50)
- `offset`: offset para paginação (padrão: 0)

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

Executa verificações de alertas periodicamente.

```
GET /api/cron/alert-checker
Authorization: Bearer {CRON_SECRET}
```

**Configuração Vercel:**

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

- ✅ Métricas em tempo real
- ✅ Visualização de alertas ativos
- ✅ Logs de sincronização
- ✅ Auto-refresh a cada 30 segundos
- ✅ Reconhecer e resolver alertas
- ✅ Filtros por plataforma e status

## Configuração

### Variáveis de Ambiente

```env
# Secret para cron jobs
CRON_SECRET=your-secret-key

# Limites de storage (opcional)
STORAGE_LIMIT_MB=10240  # 10GB
```

### Database Setup

Execute os scripts SQL na ordem:

1. `database/historical-data-cache-schema.sql` (se ainda não executado)
2. `database/observability-functions.sql`
3. `database/alerts-schema.sql`

```bash
# Via Supabase CLI
supabase db push

# Ou via SQL Editor no Supabase Dashboard
```

## Thresholds Padrão

| Alerta | Threshold | Intervalo |
|--------|-----------|-----------|
| Storage Limit | 80% | 60 min |
| Consecutive Failures | 3 falhas | 30 min |
| Token Expiration | 24h antes | 120 min |
| Performance Degraded | 5 min avg | 60 min |

## Monitoramento de Performance

### Métricas Coletadas

1. **Sync Performance**
   - Duração média por plataforma
   - Taxa de sucesso
   - Volume de dados sincronizados

2. **Storage Usage**
   - Uso total em MB
   - Uso por cliente
   - Crescimento ao longo do tempo

3. **API Calls**
   - Total de chamadas
   - Chamadas nas últimas 24h/7d
   - Média por sync

4. **System Health**
   - Clientes ativos
   - Syncs pendentes
   - Falhas recentes

## Troubleshooting

### Alertas Não Aparecem

1. Verificar se cron job está configurado
2. Verificar logs do cron: `/api/cron/alert-checker`
3. Verificar RLS policies na tabela `system_alerts`

### Métricas Incorretas

1. Verificar se funções SQL foram criadas
2. Executar `SELECT * FROM get_sync_metrics_summary()` manualmente
3. Verificar logs de sync na tabela `sync_logs`

### Performance Lenta

1. Verificar índices nas tabelas
2. Analisar query plans: `EXPLAIN ANALYZE`
3. Considerar particionamento adicional

## Próximos Passos

- [ ] Integração com Slack para notificações
- [ ] Webhooks para alertas críticos
- [ ] Exportação de métricas para Prometheus
- [ ] Dashboards customizáveis
- [ ] Alertas baseados em ML

## Referências

- Requirements: 9.1, 9.2, 9.3, 9.4
- Design: Monitoring & Observability section
- Database: `observability-functions.sql`, `alerts-schema.sql`
