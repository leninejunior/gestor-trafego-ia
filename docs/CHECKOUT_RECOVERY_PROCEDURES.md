# Procedimentos de Recovery - Sistema de Checkout e Pagamentos

## Visão Geral

Este documento define procedimentos detalhados para recuperação de falhas críticas no sistema de checkout e pagamentos, incluindo cenários de disaster recovery, backup/restore, e recuperação de dados.

## Classificação de Incidentes

### Severidade 1 - Crítica
- Sistema de checkout completamente indisponível
- Perda de dados de pagamento
- Falha completa da integração com Iugu
- Corrupção de banco de dados

### Severidade 2 - Alta
- Taxa de falha de checkout > 50%
- Webhooks não processando por > 30 minutos
- Performance severamente degradada (>30s response time)
- Falha parcial de criação de contas

### Severidade 3 - Média
- Taxa de falha de checkout 10-50%
- Webhooks com delay < 30 minutos
- Performance degradada (5-30s response time)
- Problemas de sincronização de status

### Severidade 4 - Baixa
- Falhas individuais de checkout
- Webhooks com retry bem-sucedido
- Performance lenta (2-5s response time)
- Problemas de UI/UX

## Procedimentos de Recovery por Severidade

### Severidade 1 - Recovery Crítico

#### 1.1 Sistema de Checkout Indisponível

**Sintomas:**
- HTTP 500/503 em todas as APIs de checkout
- Timeout em todas as requisições
- Falha de conectividade com banco de dados

**Procedimento de Recovery:**

```bash
# 1. Verificação inicial
echo "=== RECOVERY CRÍTICO - CHECKOUT INDISPONÍVEL ==="
date

# 2. Verificar status dos serviços
systemctl status postgresql
systemctl status nginx
systemctl status app

# 3. Verificar logs de erro
tail -n 100 /var/log/app/error.log
tail -n 100 /var/log/postgresql/postgresql.log

# 4. Verificar conectividade de rede
ping -c 3 api.iugu.com
curl -I https://api.iugu.com/v1/ping

# 5. Verificar espaço em disco
df -h
du -sh /var/log/*

# 6. Reiniciar serviços se necessário
systemctl restart postgresql
systemctl restart app
systemctl restart nginx

# 7. Verificar recovery
curl -I /api/health/checkout
```

**Rollback Plan:**
```bash
# Se recovery falhar, ativar modo de manutenção
cp /etc/nginx/maintenance.conf /etc/nginx/sites-enabled/default
systemctl reload nginx

# Notificar usuários via status page
curl -X POST https://status.exemplo.com/api/incidents \
  -H "Authorization: Bearer <status_token>" \
  -d '{"message": "Sistema de checkout em manutenção"}'
```

#### 1.2 Perda de Dados de Pagamento

**Sintomas:**
- Subscription intents desapareceram
- Dados de webhook corrompidos
- Inconsistência entre Iugu e sistema interno

**Procedimento de Recovery:**

```sql
-- 1. Verificar extensão da perda
SELECT 
  DATE(created_at) as date,
  COUNT(*) as intents_count
FROM subscription_intents 
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date;

-- 2. Verificar backups disponíveis
SELECT 
  backup_date,
  table_name,
  record_count
FROM backup_logs 
WHERE backup_date > NOW() - INTERVAL '7 days'
ORDER BY backup_date DESC;
```

```bash
# 3. Restaurar do backup mais recente
echo "Iniciando restore do backup..."

# Parar aplicação
systemctl stop app

# Restaurar dados críticos
pg_restore -d checkout_db \
  --table=subscription_intents \
  --table=webhook_logs \
  /backups/checkout_$(date -d yesterday +%Y%m%d).dump

# Verificar integridade pós-restore
psql -d checkout_db -c "
  SELECT COUNT(*) FROM subscription_intents;
  SELECT COUNT(*) FROM webhook_logs;
  SELECT COUNT(*) FROM payment_analytics;
"

# Reiniciar aplicação
systemctl start app
```

**Sincronização com Iugu:**
```bash
# Script para sincronizar dados com Iugu
node scripts/sync-with-iugu.js --date=$(date -d yesterday +%Y-%m-%d)
```

#### 1.3 Corrupção de Banco de Dados

**Sintomas:**
- Erros de integridade referencial
- Índices corrompidos
- Queries falhando consistentemente

**Procedimento de Recovery:**

```sql
-- 1. Verificar integridade
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(tablename::regclass)) as size
FROM pg_tables 
WHERE schemaname = 'public';

-- 2. Verificar índices corrompidos
REINDEX DATABASE checkout_db;

-- 3. Verificar constraints
SELECT 
  conname,
  contype,
  conrelid::regclass as table_name
FROM pg_constraint 
WHERE NOT convalidated;

-- 4. Reparar integridade referencial
ALTER TABLE subscription_intents 
  VALIDATE CONSTRAINT subscription_intents_plan_id_fkey;
```

### Severidade 2 - Recovery de Alta Prioridade

#### 2.1 Alta Taxa de Falha de Checkout

**Procedimento de Diagnóstico:**

```sql
-- Analisar padrão de falhas
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY DATE_TRUNC('hour', created_at)), 2) as percentage
FROM subscription_intents 
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at), status
ORDER BY hour DESC, count DESC;

-- Identificar erros comuns
SELECT 
  metadata->>'error_code' as error_code,
  COUNT(*) as count,
  array_agg(DISTINCT metadata->>'error_message') as error_messages
FROM subscription_intents 
WHERE status = 'failed'
  AND created_at > NOW() - INTERVAL '6 hours'
GROUP BY metadata->>'error_code'
ORDER BY count DESC;
```

**Procedimento de Recovery:**

```bash
# 1. Identificar causa raiz
if [[ $(curl -s -o /dev/null -w "%{http_code}" https://api.iugu.com/v1/ping) != "200" ]]; then
  echo "CAUSA: Iugu API indisponível"
  # Ativar modo degradado
  export CHECKOUT_MODE=degraded
  systemctl restart app
fi

# 2. Verificar rate limiting
if [[ $(grep "rate limit" /var/log/app/error.log | wc -l) -gt 10 ]]; then
  echo "CAUSA: Rate limiting do Iugu"
  # Implementar backoff exponencial
  export IUGU_RATE_LIMIT_BACKOFF=true
  systemctl restart app
fi

# 3. Verificar recursos do sistema
if [[ $(free | grep Mem | awk '{print $3/$2 * 100.0}' | cut -d. -f1) -gt 90 ]]; then
  echo "CAUSA: Memória insuficiente"
  # Limpar cache e reiniciar
  echo 3 > /proc/sys/vm/drop_caches
  systemctl restart app
fi
```

#### 2.2 Webhooks Não Processando

**Procedimento de Recovery:**

```sql
-- 1. Identificar webhooks pendentes
SELECT 
  event_type,
  status,
  COUNT(*) as count,
  MIN(created_at) as oldest,
  MAX(created_at) as newest
FROM webhook_logs 
WHERE status IN ('received', 'failed')
  AND created_at > NOW() - INTERVAL '2 hours'
GROUP BY event_type, status;

-- 2. Reprocessar webhooks falhados
UPDATE webhook_logs 
SET status = 'received',
    retry_count = 0,
    error_message = NULL
WHERE status = 'failed'
  AND retry_count < 5
  AND created_at > NOW() - INTERVAL '1 hour';
```

```bash
# 3. Forçar processamento manual
node scripts/process-pending-webhooks.js --force

# 4. Verificar worker de webhook
systemctl status webhook-processor
systemctl restart webhook-processor
```

### Severidade 3 - Recovery de Prioridade Média

#### 3.1 Performance Degradada

**Procedimento de Otimização:**

```sql
-- 1. Identificar queries lentas
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  rows
FROM pg_stat_statements 
WHERE mean_time > 1000  -- > 1 segundo
ORDER BY mean_time DESC
LIMIT 10;

-- 2. Analisar locks
SELECT 
  blocked_locks.pid AS blocked_pid,
  blocked_activity.usename AS blocked_user,
  blocking_locks.pid AS blocking_pid,
  blocking_activity.usename AS blocking_user,
  blocked_activity.query AS blocked_statement,
  blocking_activity.query AS current_statement_in_blocking_process
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;

-- 3. Otimizar índices
ANALYZE subscription_intents;
ANALYZE webhook_logs;
REINDEX INDEX CONCURRENTLY idx_subscription_intents_status;
```

```bash
# 4. Limpeza de dados antigos
psql -c "SELECT cleanup_expired_intents(7);"
psql -c "SELECT cleanup_webhook_logs(30);"
psql -c "VACUUM ANALYZE;"
```

## Backup e Restore

### Backup Automático

```bash
#!/bin/bash
# backup-checkout-system.sh

BACKUP_DIR="/backups/checkout"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="checkout_db"

echo "Iniciando backup do sistema de checkout - $DATE"

# 1. Backup completo do banco
pg_dump -Fc $DB_NAME > "$BACKUP_DIR/full_${DATE}.dump"

# 2. Backup incremental de tabelas críticas
pg_dump -Fc -t subscription_intents -t webhook_logs $DB_NAME > "$BACKUP_DIR/critical_${DATE}.dump"

# 3. Backup de configurações
cp -r /etc/app/checkout "$BACKUP_DIR/config_${DATE}/"

# 4. Backup de logs recentes
tar -czf "$BACKUP_DIR/logs_${DATE}.tar.gz" /var/log/app/checkout*.log

# 5. Verificar integridade do backup
pg_restore --list "$BACKUP_DIR/full_${DATE}.dump" > /dev/null
if [ $? -eq 0 ]; then
  echo "Backup verificado com sucesso"
else
  echo "ERRO: Backup corrompido!"
  exit 1
fi

# 6. Limpar backups antigos (manter 30 dias)
find $BACKUP_DIR -name "*.dump" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

echo "Backup concluído: $BACKUP_DIR/full_${DATE}.dump"
```

### Restore Completo

```bash
#!/bin/bash
# restore-checkout-system.sh

BACKUP_FILE=$1
DB_NAME="checkout_db"

if [ -z "$BACKUP_FILE" ]; then
  echo "Uso: $0 <arquivo_backup>"
  exit 1
fi

echo "ATENÇÃO: Este procedimento irá sobrescrever todos os dados!"
read -p "Confirma o restore? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "Restore cancelado"
  exit 0
fi

echo "Iniciando restore do sistema de checkout..."

# 1. Parar aplicação
systemctl stop app
systemctl stop webhook-processor

# 2. Criar backup de segurança atual
pg_dump -Fc $DB_NAME > "/tmp/pre_restore_$(date +%Y%m%d_%H%M%S).dump"

# 3. Restaurar banco de dados
dropdb $DB_NAME
createdb $DB_NAME
pg_restore -d $DB_NAME $BACKUP_FILE

# 4. Verificar integridade pós-restore
psql -d $DB_NAME -c "
  SELECT 'subscription_intents' as table, COUNT(*) as records FROM subscription_intents
  UNION ALL
  SELECT 'webhook_logs' as table, COUNT(*) as records FROM webhook_logs
  UNION ALL
  SELECT 'payment_analytics' as table, COUNT(*) as records FROM payment_analytics;
"

# 5. Reiniciar serviços
systemctl start app
systemctl start webhook-processor

# 6. Verificar funcionamento
sleep 10
curl -f /api/health/checkout || {
  echo "ERRO: Sistema não respondeu após restore"
  exit 1
}

echo "Restore concluído com sucesso"
```

### Restore Seletivo

```bash
#!/bin/bash
# restore-selective.sh

BACKUP_FILE=$1
TABLE_NAME=$2

echo "Restaurando tabela $TABLE_NAME do backup $BACKUP_FILE"

# 1. Backup da tabela atual
pg_dump -Fc -t $TABLE_NAME checkout_db > "/tmp/${TABLE_NAME}_backup_$(date +%Y%m%d_%H%M%S).dump"

# 2. Restaurar tabela específica
pg_restore -d checkout_db -t $TABLE_NAME --clean $BACKUP_FILE

# 3. Verificar dados restaurados
psql -d checkout_db -c "SELECT COUNT(*) FROM $TABLE_NAME;"

echo "Restore seletivo concluído"
```

## Disaster Recovery

### Cenário: Falha Completa do Datacenter

**Procedimento de Ativação do Site Secundário:**

```bash
#!/bin/bash
# activate-dr-site.sh

echo "=== ATIVAÇÃO DO SITE DE DISASTER RECOVERY ==="

# 1. Verificar disponibilidade do site primário
if curl -f --max-time 10 https://primary.exemplo.com/api/health; then
  echo "ATENÇÃO: Site primário ainda responde!"
  read -p "Confirma ativação do DR? (yes/no): " confirm
  if [ "$confirm" != "yes" ]; then
    exit 0
  fi
fi

# 2. Ativar banco de dados secundário
echo "Ativando banco de dados secundário..."
systemctl start postgresql-dr
sleep 30

# 3. Verificar integridade dos dados
psql -h dr-db.exemplo.com -d checkout_db -c "
  SELECT 
    'subscription_intents' as table, 
    COUNT(*) as records,
    MAX(created_at) as last_record
  FROM subscription_intents
  UNION ALL
  SELECT 
    'webhook_logs' as table, 
    COUNT(*) as records,
    MAX(created_at) as last_record
  FROM webhook_logs;
"

# 4. Atualizar DNS para apontar para DR
echo "Atualizando DNS..."
curl -X PUT "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$RECORD_ID" \
  -H "Authorization: Bearer $CF_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"content":"dr.exemplo.com","name":"api.exemplo.com"}'

# 5. Iniciar aplicação no site DR
systemctl start app-dr
systemctl start webhook-processor-dr

# 6. Verificar funcionamento
sleep 30
curl -f https://api.exemplo.com/api/health/checkout || {
  echo "ERRO: Site DR não está respondendo"
  exit 1
}

echo "Site DR ativado com sucesso"
echo "TTL do DNS: 300 segundos"
echo "Monitorar logs em: /var/log/app-dr/"
```

### Cenário: Corrupção de Dados Críticos

**Procedimento de Recovery Point-in-Time:**

```bash
#!/bin/bash
# point-in-time-recovery.sh

TARGET_TIME=$1  # Formato: 2024-01-15 14:30:00

if [ -z "$TARGET_TIME" ]; then
  echo "Uso: $0 'YYYY-MM-DD HH:MM:SS'"
  exit 1
fi

echo "Iniciando Point-in-Time Recovery para: $TARGET_TIME"

# 1. Parar aplicação
systemctl stop app

# 2. Criar backup do estado atual
pg_dump -Fc checkout_db > "/tmp/pre_pitr_$(date +%Y%m%d_%H%M%S).dump"

# 3. Restaurar backup base mais próximo
BACKUP_FILE=$(find /backups/checkout -name "full_*.dump" -newermt "$TARGET_TIME" | head -1)
echo "Usando backup base: $BACKUP_FILE"

dropdb checkout_db
createdb checkout_db
pg_restore -d checkout_db $BACKUP_FILE

# 4. Aplicar WAL logs até o ponto desejado
pg_ctl stop -D /var/lib/postgresql/data
cp /backups/wal/* /var/lib/postgresql/data/pg_wal/
echo "restore_command = 'cp /backups/wal/%f %p'" >> /var/lib/postgresql/data/recovery.conf
echo "recovery_target_time = '$TARGET_TIME'" >> /var/lib/postgresql/data/recovery.conf
pg_ctl start -D /var/lib/postgresql/data

# 5. Verificar recovery
psql -d checkout_db -c "SELECT NOW(), pg_is_in_recovery();"

echo "Point-in-Time Recovery concluído"
```

## Testes de Recovery

### Teste Mensal de Backup/Restore

```bash
#!/bin/bash
# test-backup-restore.sh

echo "=== TESTE DE BACKUP/RESTORE ==="
TEST_DB="checkout_test_$(date +%Y%m%d)"

# 1. Criar backup de teste
pg_dump -Fc checkout_db > "/tmp/test_backup.dump"

# 2. Criar banco de teste
createdb $TEST_DB

# 3. Restaurar no banco de teste
pg_restore -d $TEST_DB /tmp/test_backup.dump

# 4. Verificar integridade
ORIGINAL_COUNT=$(psql -d checkout_db -t -c "SELECT COUNT(*) FROM subscription_intents;")
RESTORED_COUNT=$(psql -d $TEST_DB -t -c "SELECT COUNT(*) FROM subscription_intents;")

if [ "$ORIGINAL_COUNT" -eq "$RESTORED_COUNT" ]; then
  echo "✓ Teste de backup/restore PASSOU"
else
  echo "✗ Teste de backup/restore FALHOU"
  echo "Original: $ORIGINAL_COUNT, Restaurado: $RESTORED_COUNT"
fi

# 5. Limpeza
dropdb $TEST_DB
rm /tmp/test_backup.dump
```

### Teste de Failover

```bash
#!/bin/bash
# test-failover.sh

echo "=== TESTE DE FAILOVER ==="

# 1. Simular falha do site primário
iptables -A OUTPUT -d primary.exemplo.com -j DROP

# 2. Verificar detecção de falha
timeout 60 bash -c 'while curl -f https://primary.exemplo.com/api/health; do sleep 5; done'

# 3. Ativar site secundário (simulação)
echo "Simulando ativação do site DR..."
sleep 30

# 4. Verificar funcionamento do DR
curl -f https://dr.exemplo.com/api/health/checkout || {
  echo "✗ Teste de failover FALHOU"
  exit 1
}

# 5. Restaurar conectividade
iptables -D OUTPUT -d primary.exemplo.com -j DROP

echo "✓ Teste de failover PASSOU"
```

## Documentação de Incidentes

### Template de Post-Mortem

```markdown
# Post-Mortem: [Título do Incidente]

## Resumo
- **Data/Hora:** 
- **Duração:** 
- **Severidade:** 
- **Impacto:** 
- **Status:** Resolvido/Em andamento

## Timeline
- **HH:MM** - Detecção inicial
- **HH:MM** - Escalação para equipe
- **HH:MM** - Identificação da causa raiz
- **HH:MM** - Implementação da correção
- **HH:MM** - Verificação da resolução

## Causa Raiz
[Descrição detalhada da causa]

## Impacto
- Usuários afetados: X
- Transações perdidas: X
- Receita impactada: R$ X

## Resolução
[Passos tomados para resolver]

## Ações Preventivas
1. [ ] Ação 1 - Responsável - Prazo
2. [ ] Ação 2 - Responsável - Prazo

## Lições Aprendidas
[O que aprendemos com este incidente]
```

Este documento deve ser revisado e atualizado regularmente com base em novos cenários e lições aprendidas.