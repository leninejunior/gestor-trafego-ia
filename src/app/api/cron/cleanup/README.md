# Data Cleanup Cron Job

Cron job executado diariamente para manter o sistema de cache de dados histÃ³ricos otimizado e dentro dos limites de retenÃ§Ã£o configurados.

## VisÃ£o Geral

Este cron job implementa o **Requisito 2.3**: Sistema remove automaticamente dados alÃ©m do limite de retenÃ§Ã£o configurado.

## Agendamento

- **FrequÃªncia**: Diariamente
- **HorÃ¡rio**: 2:00 AM UTC
- **ConfiguraÃ§Ã£o**: `deploy.json` â†’ `crons` â†’ `/api/cron/cleanup`

## OperaÃ§Ãµes Executadas

### 1. CriaÃ§Ã£o de PartiÃ§Ãµes Futuras

Cria partiÃ§Ãµes mensais para os prÃ³ximos 3 meses, garantindo que novos dados possam ser inseridos sem erros.

```typescript
const partitions = await cleanupService.createMonthlyPartitions(3);
```

**BenefÃ­cios**:
- Previne erros de inserÃ§Ã£o por falta de partiÃ§Ã£o
- MantÃ©m estrutura de particionamento consistente
- Otimiza performance de queries

### 2. Limpeza de Dados Expirados

Remove dados histÃ³ricos que excedem o perÃ­odo de retenÃ§Ã£o configurado no plano de cada cliente.

```typescript
const cleanupResults = await cleanupService.deleteExpiredDataForAllClients();
```

**Processo**:
1. Busca todos os clientes
2. Para cada cliente:
   - ObtÃ©m o plano ativo do usuÃ¡rio
   - Consulta `data_retention_days` do plano
   - Calcula data de corte (hoje - retention_days)
   - Remove registros anteriores Ã  data de corte
3. Registra resultados em logs

**Exemplo**:
- Cliente com plano "Basic" (90 dias de retenÃ§Ã£o)
- Data atual: 2025-10-27
- Data de corte: 2025-07-29
- AÃ§Ã£o: Remove todos os registros antes de 2025-07-29

### 3. Logging de OperaÃ§Ãµes

Todas as operaÃ§Ãµes sÃ£o registradas na tabela `cleanup_logs` para auditoria e monitoramento.

```typescript
await logCleanupOperation({
  job_type: 'delete_expired_data',
  status: 'success',
  records_affected: totalDeleted,
  details: { ... },
  started_at: startTime,
  completed_at: endTime,
  duration_ms: duration
});
```

## AutenticaÃ§Ã£o

O cron job Ã© protegido por um secret token:

```bash
# .env
CRON_SECRET=your-secret-token-here
```

**plataforma de deploy** automaticamente adiciona o header de autorizaÃ§Ã£o:
```
Authorization: Bearer ${CRON_SECRET}
```

## Resposta da API

### Sucesso (200)

```json
{
  "success": true,
  "summary": {
    "started_at": "2025-10-27T02:00:00.000Z",
    "completed_at": "2025-10-27T02:01:30.000Z",
    "duration_ms": 90000
  },
  "partitions": {
    "total_checked": 3,
    "new_created": 1,
    "partition_names": ["campaign_insights_history_2025_11"]
  },
  "cleanup": {
    "clients_processed": 25,
    "total_records_deleted": 15420,
    "clients_with_deletions": 18
  },
  "statistics": {
    "total_clients": 25,
    "total_partitions": 12,
    "oldest_partition_date": "2024-11-01",
    "newest_partition_date": "2025-11-01"
  }
}
```

### Erro (500)

```json
{
  "success": false,
  "error": "Failed to delete expired data: ...",
  "started_at": "2025-10-27T02:00:00.000Z",
  "completed_at": "2025-10-27T02:00:15.000Z",
  "duration_ms": 15000
}
```

## Monitoramento

### Visualizar Logs

```bash
# Via API
GET /api/admin/cleanup/logs?days=7&status=failed
```

### MÃ©tricas Importantes

1. **Taxa de Sucesso**: % de execuÃ§Ãµes bem-sucedidas
2. **Registros Removidos**: Total de dados limpos por execuÃ§Ã£o
3. **DuraÃ§Ã£o**: Tempo de execuÃ§Ã£o (alerta se > 5 minutos)
4. **Falhas**: ExecuÃ§Ãµes que falharam

### Alertas Recomendados

- âš ï¸ Falha em 2+ execuÃ§Ãµes consecutivas
- âš ï¸ DuraÃ§Ã£o > 5 minutos
- âš ï¸ Nenhuma partiÃ§Ã£o criada quando esperado
- âš ï¸ 0 registros removidos por 7+ dias (pode indicar problema)

## ExecuÃ§Ã£o Manual

Admins podem executar a limpeza manualmente:

```bash
POST /api/admin/cleanup/trigger
Content-Type: application/json

{
  "operation": "all"
}
```

**OperaÃ§Ãµes disponÃ­veis**:
- `delete_expired`: Remove dados expirados
- `create_partitions`: Cria partiÃ§Ãµes futuras
- `archive_partitions`: Arquiva partiÃ§Ãµes antigas
- `all`: Executa todas as operaÃ§Ãµes

## Troubleshooting

### Problema: Cron nÃ£o estÃ¡ executando

**VerificaÃ§Ãµes**:
1. Confirme que `CRON_SECRET` estÃ¡ configurado no plataforma de deploy
2. Verifique logs do plataforma de deploy: Dashboard â†’ Deployments â†’ Logs
3. Confirme que o cron estÃ¡ configurado em `deploy.json`

### Problema: Falhas frequentes

**PossÃ­veis causas**:
1. Timeout (> 10s no plataforma de deploy Free)
   - SoluÃ§Ã£o: Otimizar queries ou processar em lotes
2. PermissÃµes insuficientes
   - SoluÃ§Ã£o: Verificar RLS policies
3. PartiÃ§Ãµes faltando
   - SoluÃ§Ã£o: Executar `create_partitions` manualmente

### Problema: Dados nÃ£o sendo removidos

**VerificaÃ§Ãµes**:
1. Confirme que `plan_limits` estÃ¡ configurado
2. Verifique se clientes tÃªm planos ativos
3. Confirme que `data_retention_days` estÃ¡ correto
4. Verifique logs: `SELECT * FROM cleanup_logs WHERE status = 'failed'`

## Performance

### OtimizaÃ§Ãµes Implementadas

1. **Batch Processing**: Processa todos os clientes em uma execuÃ§Ã£o
2. **Ãndices**: Queries otimizadas com Ã­ndices em `client_id` e `date`
3. **Particionamento**: Deletes sÃ£o mais rÃ¡pidos em partiÃ§Ãµes
4. **Logging AssÃ­ncrono**: NÃ£o bloqueia operaÃ§Ãµes principais

### Limites

- **plataforma de deploy Free**: 10s timeout
- **plataforma de deploy Pro**: 60s timeout
- **plataforma de deploy Enterprise**: 900s timeout

Para grandes volumes de dados, considere:
- Processar clientes em lotes menores
- Executar em horÃ¡rios de baixo trÃ¡fego
- Usar Edge Functions para operaÃ§Ãµes mais longas

## Exemplo de Logs

```sql
-- Ver Ãºltimas 10 execuÃ§Ãµes
SELECT 
  job_type,
  status,
  records_affected,
  duration_ms,
  created_at
FROM cleanup_logs
ORDER BY created_at DESC
LIMIT 10;

-- Ver estatÃ­sticas dos Ãºltimos 30 dias
SELECT * FROM get_cleanup_log_summary(30);

-- Ver falhas recentes
SELECT * FROM get_recent_cleanup_failures(5);
```

## ManutenÃ§Ã£o

### Limpeza de Logs Antigos

Os logs de limpeza sÃ£o mantidos por 90 dias. Para limpar manualmente:

```sql
SELECT cleanup_old_logs();
```

### VerificaÃ§Ã£o de SaÃºde

Execute periodicamente para verificar o estado do sistema:

```typescript
const stats = await cleanupService.getCleanupStats();
console.log('Total de clientes:', stats.total_clients);
console.log('Total de partiÃ§Ãµes:', stats.total_partitions);
```

## ReferÃªncias

- [CleanupService](../../../lib/services/README-cleanup-service.md)
- [Cleanup Functions SQL](../../../../database/cleanup-functions.sql)
- [Cleanup Logs Schema](../../../../database/cleanup-logs-schema.sql)
- [plataforma de deploy Cron Jobs](https://provedor-deploy.com/docs/cron-jobs)


