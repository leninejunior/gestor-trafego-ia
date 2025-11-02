# Data Cleanup Cron Job

Cron job executado diariamente para manter o sistema de cache de dados históricos otimizado e dentro dos limites de retenção configurados.

## Visão Geral

Este cron job implementa o **Requisito 2.3**: Sistema remove automaticamente dados além do limite de retenção configurado.

## Agendamento

- **Frequência**: Diariamente
- **Horário**: 2:00 AM UTC
- **Configuração**: `vercel.json` → `crons` → `/api/cron/cleanup`

## Operações Executadas

### 1. Criação de Partições Futuras

Cria partições mensais para os próximos 3 meses, garantindo que novos dados possam ser inseridos sem erros.

```typescript
const partitions = await cleanupService.createMonthlyPartitions(3);
```

**Benefícios**:
- Previne erros de inserção por falta de partição
- Mantém estrutura de particionamento consistente
- Otimiza performance de queries

### 2. Limpeza de Dados Expirados

Remove dados históricos que excedem o período de retenção configurado no plano de cada cliente.

```typescript
const cleanupResults = await cleanupService.deleteExpiredDataForAllClients();
```

**Processo**:
1. Busca todos os clientes
2. Para cada cliente:
   - Obtém o plano ativo do usuário
   - Consulta `data_retention_days` do plano
   - Calcula data de corte (hoje - retention_days)
   - Remove registros anteriores à data de corte
3. Registra resultados em logs

**Exemplo**:
- Cliente com plano "Basic" (90 dias de retenção)
- Data atual: 2025-10-27
- Data de corte: 2025-07-29
- Ação: Remove todos os registros antes de 2025-07-29

### 3. Logging de Operações

Todas as operações são registradas na tabela `cleanup_logs` para auditoria e monitoramento.

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

## Autenticação

O cron job é protegido por um secret token:

```bash
# .env
CRON_SECRET=your-secret-token-here
```

**Vercel** automaticamente adiciona o header de autorização:
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

### Métricas Importantes

1. **Taxa de Sucesso**: % de execuções bem-sucedidas
2. **Registros Removidos**: Total de dados limpos por execução
3. **Duração**: Tempo de execução (alerta se > 5 minutos)
4. **Falhas**: Execuções que falharam

### Alertas Recomendados

- ⚠️ Falha em 2+ execuções consecutivas
- ⚠️ Duração > 5 minutos
- ⚠️ Nenhuma partição criada quando esperado
- ⚠️ 0 registros removidos por 7+ dias (pode indicar problema)

## Execução Manual

Admins podem executar a limpeza manualmente:

```bash
POST /api/admin/cleanup/trigger
Content-Type: application/json

{
  "operation": "all"
}
```

**Operações disponíveis**:
- `delete_expired`: Remove dados expirados
- `create_partitions`: Cria partições futuras
- `archive_partitions`: Arquiva partições antigas
- `all`: Executa todas as operações

## Troubleshooting

### Problema: Cron não está executando

**Verificações**:
1. Confirme que `CRON_SECRET` está configurado no Vercel
2. Verifique logs do Vercel: Dashboard → Deployments → Logs
3. Confirme que o cron está configurado em `vercel.json`

### Problema: Falhas frequentes

**Possíveis causas**:
1. Timeout (> 10s no Vercel Free)
   - Solução: Otimizar queries ou processar em lotes
2. Permissões insuficientes
   - Solução: Verificar RLS policies
3. Partições faltando
   - Solução: Executar `create_partitions` manualmente

### Problema: Dados não sendo removidos

**Verificações**:
1. Confirme que `plan_limits` está configurado
2. Verifique se clientes têm planos ativos
3. Confirme que `data_retention_days` está correto
4. Verifique logs: `SELECT * FROM cleanup_logs WHERE status = 'failed'`

## Performance

### Otimizações Implementadas

1. **Batch Processing**: Processa todos os clientes em uma execução
2. **Índices**: Queries otimizadas com índices em `client_id` e `date`
3. **Particionamento**: Deletes são mais rápidos em partições
4. **Logging Assíncrono**: Não bloqueia operações principais

### Limites

- **Vercel Free**: 10s timeout
- **Vercel Pro**: 60s timeout
- **Vercel Enterprise**: 900s timeout

Para grandes volumes de dados, considere:
- Processar clientes em lotes menores
- Executar em horários de baixo tráfego
- Usar Edge Functions para operações mais longas

## Exemplo de Logs

```sql
-- Ver últimas 10 execuções
SELECT 
  job_type,
  status,
  records_affected,
  duration_ms,
  created_at
FROM cleanup_logs
ORDER BY created_at DESC
LIMIT 10;

-- Ver estatísticas dos últimos 30 dias
SELECT * FROM get_cleanup_log_summary(30);

-- Ver falhas recentes
SELECT * FROM get_recent_cleanup_failures(5);
```

## Manutenção

### Limpeza de Logs Antigos

Os logs de limpeza são mantidos por 90 dias. Para limpar manualmente:

```sql
SELECT cleanup_old_logs();
```

### Verificação de Saúde

Execute periodicamente para verificar o estado do sistema:

```typescript
const stats = await cleanupService.getCleanupStats();
console.log('Total de clientes:', stats.total_clients);
console.log('Total de partições:', stats.total_partitions);
```

## Referências

- [CleanupService](../../../lib/services/README-cleanup-service.md)
- [Cleanup Functions SQL](../../../../database/cleanup-functions.sql)
- [Cleanup Logs Schema](../../../../database/cleanup-logs-schema.sql)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)

