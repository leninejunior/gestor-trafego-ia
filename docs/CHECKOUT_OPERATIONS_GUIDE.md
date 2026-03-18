# Guia de Operações - Sistema de Checkout e Pagamentos

## Visão Geral

Este guia fornece procedimentos operacionais para administradores e equipe de suporte do sistema de checkout e pagamentos, incluindo tarefas diárias, monitoramento, e resolução de problemas comuns.

## Tarefas Diárias

### 1. Verificação Matinal do Sistema

```bash
#!/bin/bash
# daily-health-check.sh

echo "=== VERIFICAÇÃO DIÁRIA - $(date) ==="

# 1. Status geral do sistema
echo "1. Status dos Serviços:"
systemctl status app | grep "Active:"
systemctl status postgresql | grep "Active:"
systemctl status redis | grep "Active:"

# 2. Métricas das últimas 24h
echo -e "\n2. Métricas das Últimas 24h:"
psql -d checkout_db -c "
SELECT 
  'Checkouts Iniciados' as metric,
  COUNT(*) as value
FROM subscription_intents 
WHERE created_at > NOW() - INTERVAL '24 hours'

UNION ALL

SELECT 
  'Checkouts Completados' as metric,
  COUNT(*) as value
FROM subscription_intents 
WHERE status = 'completed' 
  AND created_at > NOW() - INTERVAL '24 hours'

UNION ALL

SELECT 
  'Taxa de Conversão (%)' as metric,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / 
    NULLIF(COUNT(*), 0), 2
  ) as value
FROM subscription_intents 
WHERE created_at > NOW() - INTERVAL '24 hours';
"

# 3. Webhooks processados
echo -e "\n3. Status dos Webhooks:"
psql -d checkout_db -c "
SELECT 
  status,
  COUNT(*) as count
FROM webhook_logs 
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status
ORDER BY count DESC;
"

# 4. Alertas ativos
echo -e "\n4. Verificando Alertas:"
curl -s /api/admin/alerts | jq '.active_alerts | length'

# 5. Performance
echo -e "\n5. Performance:"
curl -s -w "Tempo de resposta checkout: %{time_total}s\n" -o /dev/null /api/health/checkout

echo -e "\n=== VERIFICAÇÃO CONCLUÍDA ==="
```

### 2. Limpeza Automática

```bash
#!/bin/bash
# daily-cleanup.sh

echo "=== LIMPEZA DIÁRIA - $(date) ==="

# 1. Limpar intents expirados (mais de 7 dias)
echo "1. Limpando intents expirados..."
EXPIRED_COUNT=$(psql -d checkout_db -t -c "SELECT cleanup_expired_intents(7);")
echo "Removidos: $EXPIRED_COUNT intents expirados"

# 2. Limpar webhook logs antigos (mais de 90 dias)
echo "2. Limpando webhook logs antigos..."
WEBHOOK_COUNT=$(psql -d checkout_db -t -c "SELECT cleanup_webhook_logs(90);")
echo "Removidos: $WEBHOOK_COUNT webhook logs"

# 3. Atualizar analytics do dia anterior
echo "3. Atualizando analytics..."
psql -d checkout_db -c "SELECT update_payment_analytics(CURRENT_DATE - 1);"

# 4. Vacuum para otimizar performance
echo "4. Otimizando banco de dados..."
psql -d checkout_db -c "VACUUM ANALYZE subscription_intents;"
psql -d checkout_db -c "VACUUM ANALYZE webhook_logs;"

# 5. Limpar cache Redis se necessário
REDIS_MEMORY=$(redis-cli info memory | grep used_memory_human | cut -d: -f2)
echo "5. Uso de memória Redis: $REDIS_MEMORY"

echo -e "\n=== LIMPEZA CONCLUÍDA ==="
```

### 3. Backup Diário

```bash
#!/bin/bash
# daily-backup.sh

BACKUP_DIR="/backups/checkout"
DATE=$(date +%Y%m%d)
RETENTION_DAYS=30

echo "=== BACKUP DIÁRIO - $DATE ==="

# 1. Criar diretório se não existir
mkdir -p $BACKUP_DIR

# 2. Backup completo do banco
echo "1. Fazendo backup do banco de dados..."
pg_dump -Fc checkout_db > "$BACKUP_DIR/checkout_full_$DATE.dump"

# 3. Backup incremental de dados críticos
echo "2. Backup incremental..."
pg_dump -Fc -t subscription_intents -t webhook_logs checkout_db > "$BACKUP_DIR/checkout_critical_$DATE.dump"

# 4. Backup de configurações
echo "3. Backup de configurações..."
tar -czf "$BACKUP_DIR/config_$DATE.tar.gz" /etc/app/

# 5. Verificar integridade
echo "4. Verificando integridade..."
pg_restore --list "$BACKUP_DIR/checkout_full_$DATE.dump" > /dev/null
if [ $? -eq 0 ]; then
  echo "✓ Backup verificado com sucesso"
else
  echo "✗ ERRO: Backup corrompido!"
  exit 1
fi

# 6. Limpar backups antigos
echo "5. Limpando backups antigos..."
find $BACKUP_DIR -name "*.dump" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete

# 7. Enviar para storage remoto (opcional)
if [ -n "$AWS_S3_BUCKET" ]; then
  echo "6. Enviando para S3..."
  aws s3 cp "$BACKUP_DIR/checkout_full_$DATE.dump" "s3://$AWS_S3_BUCKET/backups/"
fi

echo -e "\n=== BACKUP CONCLUÍDO ==="
```

## Monitoramento Contínuo

### 1. Dashboard de Métricas

```sql
-- Query para dashboard principal
CREATE OR REPLACE VIEW operational_dashboard AS
SELECT 
  -- Métricas de hoje
  (SELECT COUNT(*) FROM subscription_intents WHERE DATE(created_at) = CURRENT_DATE) as checkouts_hoje,
  (SELECT COUNT(*) FROM subscription_intents WHERE DATE(created_at) = CURRENT_DATE AND status = 'completed') as pagamentos_hoje,
  (SELECT COALESCE(SUM(sp.monthly_price), 0) FROM subscription_intents si JOIN subscription_plans sp ON si.plan_id = sp.id WHERE DATE(si.created_at) = CURRENT_DATE AND si.status = 'completed' AND si.billing_cycle = 'monthly') as receita_hoje,
  
  -- Métricas da última hora
  (SELECT COUNT(*) FROM subscription_intents WHERE created_at > NOW() - INTERVAL '1 hour') as checkouts_ultima_hora,
  (SELECT COUNT(*) FROM webhook_logs WHERE created_at > NOW() - INTERVAL '1 hour' AND status = 'failed') as webhooks_falhados_ultima_hora,
  
  -- Status do sistema
  (SELECT COUNT(*) FROM subscription_intents WHERE status = 'processing' AND created_at < NOW() - INTERVAL '30 minutes') as intents_presos,
  (SELECT COUNT(*) FROM webhook_logs WHERE status = 'received' AND created_at < NOW() - INTERVAL '10 minutes') as webhooks_pendentes,
  
  -- Performance
  (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/60)::numeric, 2) FROM subscription_intents WHERE status = 'completed' AND created_at > NOW() - INTERVAL '24 hours') as tempo_medio_checkout_minutos;
```

### 2. Alertas Críticos

```sql
-- Função para detectar problemas críticos
CREATE OR REPLACE FUNCTION check_critical_alerts()
RETURNS TABLE(
  alert_type TEXT,
  severity TEXT,
  message TEXT,
  count BIGINT,
  threshold BIGINT
) AS $$
BEGIN
  -- Alta taxa de falha (>20% na última hora)
  RETURN QUERY
  SELECT 
    'high_failure_rate'::TEXT,
    'critical'::TEXT,
    'Taxa de falha de checkout muito alta'::TEXT,
    COUNT(*) FILTER (WHERE status = 'failed'),
    COUNT(*) / 5 as threshold -- 20%
  FROM subscription_intents 
  WHERE created_at > NOW() - INTERVAL '1 hour'
  HAVING COUNT(*) FILTER (WHERE status = 'failed') > COUNT(*) / 5;
  
  -- Intents presos em processamento
  RETURN QUERY
  SELECT 
    'stuck_processing'::TEXT,
    'high'::TEXT,
    'Intents presos em processamento'::TEXT,
    COUNT(*),
    5::BIGINT as threshold
  FROM subscription_intents 
  WHERE status = 'processing' 
    AND updated_at < NOW() - INTERVAL '30 minutes'
  HAVING COUNT(*) > 5;
  
  -- Webhooks falhando consistentemente
  RETURN QUERY
  SELECT 
    'webhook_failures'::TEXT,
    'high'::TEXT,
    'Muitas falhas de webhook'::TEXT,
    COUNT(*),
    50::BIGINT as threshold
  FROM webhook_logs 
  WHERE created_at > NOW() - INTERVAL '1 hour'
    AND status = 'failed'
  HAVING COUNT(*) > 50;
  
  -- Sistema sem checkouts (possível indisponibilidade)
  RETURN QUERY
  SELECT 
    'no_checkouts'::TEXT,
    'critical'::TEXT,
    'Nenhum checkout nas últimas 2 horas'::TEXT,
    COUNT(*),
    1::BIGINT as threshold
  FROM subscription_intents 
  WHERE created_at > NOW() - INTERVAL '2 hours'
  HAVING COUNT(*) = 0;
END;
$$ LANGUAGE plpgsql;
```

### 3. Script de Monitoramento

```bash
#!/bin/bash
# monitoring-check.sh

echo "=== VERIFICAÇÃO DE MONITORAMENTO - $(date) ==="

# 1. Verificar alertas críticos
echo "1. Verificando alertas críticos..."
ALERTS=$(psql -d checkout_db -t -c "SELECT COUNT(*) FROM check_critical_alerts();")
if [ "$ALERTS" -gt 0 ]; then
  echo "⚠️  ALERTAS CRÍTICOS DETECTADOS: $ALERTS"
  psql -d checkout_db -c "SELECT * FROM check_critical_alerts();"
  
  # Enviar notificação (Slack, email, etc.)
  if [ -n "$SLACK_WEBHOOK" ]; then
    curl -X POST -H 'Content-type: application/json' \
      --data '{"text":"🚨 Alertas críticos detectados no sistema de checkout!"}' \
      $SLACK_WEBHOOK
  fi
else
  echo "✅ Nenhum alerta crítico"
fi

# 2. Verificar performance
echo -e "\n2. Verificando performance..."
RESPONSE_TIME=$(curl -s -w "%{time_total}" -o /dev/null /api/health/checkout)
if (( $(echo "$RESPONSE_TIME > 5.0" | bc -l) )); then
  echo "⚠️  Performance degradada: ${RESPONSE_TIME}s"
else
  echo "✅ Performance OK: ${RESPONSE_TIME}s"
fi

# 3. Verificar conectividade com Iugu
echo -e "\n3. Verificando Iugu..."
IUGU_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://api.iugu.com/v1/ping)
if [ "$IUGU_STATUS" != "200" ]; then
  echo "⚠️  Iugu indisponível: HTTP $IUGU_STATUS"
else
  echo "✅ Iugu OK"
fi

# 4. Verificar espaço em disco
echo -e "\n4. Verificando espaço em disco..."
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 85 ]; then
  echo "⚠️  Espaço em disco baixo: ${DISK_USAGE}%"
else
  echo "✅ Espaço em disco OK: ${DISK_USAGE}%"
fi

# 5. Verificar memória
echo -e "\n5. Verificando memória..."
MEMORY_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
if [ "$MEMORY_USAGE" -gt 90 ]; then
  echo "⚠️  Uso de memória alto: ${MEMORY_USAGE}%"
else
  echo "✅ Memória OK: ${MEMORY_USAGE}%"
fi

echo -e "\n=== VERIFICAÇÃO CONCLUÍDA ==="
```

## Procedimentos de Suporte

### 1. Consulta de Status de Pagamento

```bash
#!/bin/bash
# check-payment-status.sh

EMAIL=$1
if [ -z "$EMAIL" ]; then
  echo "Uso: $0 <email_do_cliente>"
  exit 1
fi

echo "=== STATUS DE PAGAMENTO - $EMAIL ==="

# 1. Buscar intents do cliente
psql -d checkout_db -c "
SELECT 
  id,
  status,
  plan_id,
  billing_cycle,
  organization_name,
  created_at,
  expires_at,
  completed_at
FROM subscription_intents 
WHERE user_email = '$EMAIL'
ORDER BY created_at DESC
LIMIT 10;
"

# 2. Verificar se tem conta criada
echo -e "\n2. Verificando conta do usuário:"
psql -d checkout_db -c "
SELECT 
  u.id,
  u.email,
  u.created_at,
  u.email_confirmed_at
FROM auth.users u
WHERE u.email = '$EMAIL';
"

# 3. Verificar organizações
echo -e "\n3. Verificando organizações:"
psql -d checkout_db -c "
SELECT 
  o.id,
  o.name,
  om.role,
  o.created_at
FROM organizations o
JOIN organization_memberships om ON o.id = om.organization_id
JOIN auth.users u ON om.user_id = u.id
WHERE u.email = '$EMAIL';
"
```

### 2. Reprocessamento Manual

```bash
#!/bin/bash
# manual-reprocess.sh

INTENT_ID=$1
if [ -z "$INTENT_ID" ]; then
  echo "Uso: $0 <intent_id>"
  exit 1
fi

echo "=== REPROCESSAMENTO MANUAL - $INTENT_ID ==="

# 1. Verificar status atual
echo "1. Status atual:"
psql -d checkout_db -c "
SELECT 
  id,
  status,
  user_email,
  organization_name,
  iugu_subscription_id,
  created_at,
  updated_at
FROM subscription_intents 
WHERE id = '$INTENT_ID';
"

# 2. Verificar webhooks relacionados
echo -e "\n2. Webhooks relacionados:"
psql -d checkout_db -c "
SELECT 
  id,
  event_type,
  status,
  retry_count,
  error_message,
  created_at
FROM webhook_logs 
WHERE subscription_intent_id = '$INTENT_ID'
ORDER BY created_at DESC;
"

# 3. Opções de reprocessamento
echo -e "\n3. Opções disponíveis:"
echo "a) Marcar como completado (se pagamento confirmado no Iugu)"
echo "b) Reprocessar webhooks falhados"
echo "c) Criar conta manualmente"
echo "d) Cancelar intent"

read -p "Escolha uma opção (a/b/c/d): " option

case $option in
  a)
    echo "Marcando como completado..."
    psql -d checkout_db -c "
    UPDATE subscription_intents 
    SET status = 'completed',
        completed_at = NOW(),
        metadata = metadata || jsonb_build_object(
          'manual_completion', true,
          'completed_by', '$USER',
          'completion_reason', 'Manual intervention'
        )
    WHERE id = '$INTENT_ID';
    "
    ;;
  b)
    echo "Reprocessando webhooks..."
    curl -X POST "/api/admin/troubleshooting/reprocess-webhooks" \
      -H "Content-Type: application/json" \
      -d "{\"intent_id\": \"$INTENT_ID\"}"
    ;;
  c)
    echo "Criando conta manualmente..."
    curl -X POST "/api/admin/accounts/create-from-intent" \
      -H "Content-Type: application/json" \
      -d "{\"intent_id\": \"$INTENT_ID\"}"
    ;;
  d)
    read -p "Motivo do cancelamento: " reason
    psql -d checkout_db -c "
    UPDATE subscription_intents 
    SET status = 'expired',
        metadata = metadata || jsonb_build_object(
          'manual_cancellation', true,
          'cancelled_by', '$USER',
          'cancellation_reason', '$reason'
        )
    WHERE id = '$INTENT_ID';
    "
    ;;
  *)
    echo "Opção inválida"
    ;;
esac
```

### 3. Sincronização com Iugu

```bash
#!/bin/bash
# sync-with-iugu.sh

INTENT_ID=$1
if [ -z "$INTENT_ID" ]; then
  echo "Uso: $0 <intent_id>"
  exit 1
fi

echo "=== SINCRONIZAÇÃO COM IUGU - $INTENT_ID ==="

# 1. Obter dados do intent
INTENT_DATA=$(psql -d checkout_db -t -c "
SELECT 
  iugu_customer_id,
  iugu_subscription_id,
  user_email
FROM subscription_intents 
WHERE id = '$INTENT_ID';
")

IUGU_CUSTOMER_ID=$(echo $INTENT_DATA | awk '{print $1}')
IUGU_SUBSCRIPTION_ID=$(echo $INTENT_DATA | awk '{print $2}')
USER_EMAIL=$(echo $INTENT_DATA | awk '{print $3}')

# 2. Verificar status no Iugu
if [ -n "$IUGU_SUBSCRIPTION_ID" ]; then
  echo "2. Verificando assinatura no Iugu..."
  curl -X GET "https://api.iugu.com/v1/subscriptions/$IUGU_SUBSCRIPTION_ID" \
    -H "Authorization: Basic $(echo -n $IUGU_API_TOKEN: | base64)" \
    | jq '.status'
fi

# 3. Verificar faturas
if [ -n "$IUGU_CUSTOMER_ID" ]; then
  echo "3. Verificando faturas no Iugu..."
  curl -X GET "https://api.iugu.com/v1/invoices?customer_id=$IUGU_CUSTOMER_ID" \
    -H "Authorization: Basic $(echo -n $IUGU_API_TOKEN: | base64)" \
    | jq '.items[] | {id: .id, status: .status, total: .total}'
fi
```

## Relatórios Operacionais

### 1. Relatório Diário

```sql
-- Relatório de performance diária
SELECT 
  'Métricas do Dia' as categoria,
  'Checkouts Iniciados' as metrica,
  COUNT(*) as valor
FROM subscription_intents 
WHERE DATE(created_at) = CURRENT_DATE

UNION ALL

SELECT 
  'Métricas do Dia',
  'Checkouts Completados',
  COUNT(*)
FROM subscription_intents 
WHERE DATE(created_at) = CURRENT_DATE 
  AND status = 'completed'

UNION ALL

SELECT 
  'Métricas do Dia',
  'Taxa de Conversão (%)',
  ROUND(
    COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / 
    NULLIF(COUNT(*), 0), 2
  )
FROM subscription_intents 
WHERE DATE(created_at) = CURRENT_DATE

UNION ALL

SELECT 
  'Performance',
  'Tempo Médio de Checkout (min)',
  ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/60)::numeric, 2)
FROM subscription_intents 
WHERE DATE(created_at) = CURRENT_DATE 
  AND status = 'completed'

UNION ALL

SELECT 
  'Webhooks',
  'Total Processados',
  COUNT(*)
FROM webhook_logs 
WHERE DATE(created_at) = CURRENT_DATE

UNION ALL

SELECT 
  'Webhooks',
  'Falhas',
  COUNT(*)
FROM webhook_logs 
WHERE DATE(created_at) = CURRENT_DATE 
  AND status = 'failed';
```

### 2. Relatório Semanal

```sql
-- Relatório de tendências semanais
SELECT 
  DATE(created_at) as data,
  COUNT(*) as checkouts_iniciados,
  COUNT(*) FILTER (WHERE status = 'completed') as checkouts_completados,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / 
    NULLIF(COUNT(*), 0), 2
  ) as taxa_conversao_pct,
  COALESCE(SUM(
    CASE 
      WHEN status = 'completed' THEN 
        CASE billing_cycle 
          WHEN 'monthly' THEN sp.monthly_price 
          WHEN 'annual' THEN sp.annual_price 
        END
      ELSE 0 
    END
  ), 0) as receita_total
FROM subscription_intents si
LEFT JOIN subscription_plans sp ON si.plan_id = sp.id
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY data DESC;
```

## Cron Jobs

### 1. Configuração de Cron Jobs

```bash
# /etc/crontab

# Verificação de saúde a cada 5 minutos
*/5 * * * * root /opt/checkout/scripts/monitoring-check.sh >> /var/log/checkout-monitoring.log 2>&1

# Limpeza diária às 2h
0 2 * * * root /opt/checkout/scripts/daily-cleanup.sh >> /var/log/checkout-cleanup.log 2>&1

# Backup diário às 3h
0 3 * * * root /opt/checkout/scripts/daily-backup.sh >> /var/log/checkout-backup.log 2>&1

# Verificação matinal às 8h
0 8 * * * root /opt/checkout/scripts/daily-health-check.sh | mail -s "Checkout System Daily Report" admin@empresa.com

# Relatório semanal às segundas 9h
0 9 * * 1 root psql -d checkout_db -c "\copy (SELECT * FROM weekly_report_view) TO '/tmp/weekly_report.csv' CSV HEADER" && mail -s "Weekly Checkout Report" -a /tmp/weekly_report.csv admin@empresa.com < /dev/null
```

### 2. Jobs de Manutenção

```sql
-- Jobs automáticos no PostgreSQL (pg_cron)

-- Limpeza de intents expirados (diário às 2h)
SELECT cron.schedule('cleanup-expired-intents', '0 2 * * *', 'SELECT cleanup_expired_intents(30);');

-- Atualização de analytics (diário às 1h)
SELECT cron.schedule('update-analytics', '0 1 * * *', 'SELECT update_payment_analytics();');

-- Limpeza de webhook logs (semanal aos domingos às 3h)
SELECT cron.schedule('cleanup-webhook-logs', '0 3 * * 0', 'SELECT cleanup_webhook_logs(90);');

-- Reindex semanal (domingos às 4h)
SELECT cron.schedule('weekly-reindex', '0 4 * * 0', 'REINDEX INDEX CONCURRENTLY idx_subscription_intents_status;');
```

## Contatos e Escalação

### Níveis de Suporte

**Nível 1 - Suporte Básico**
- Consultas de status
- Problemas de usuário individual
- Questões de documentação

**Nível 2 - Suporte Técnico**
- Problemas de performance
- Falhas de webhook
- Questões de integração

**Nível 3 - Engenharia**
- Falhas críticas do sistema
- Problemas de arquitetura
- Mudanças de código

### Informações de Contato

```bash
# Variáveis de ambiente para notificações
export SLACK_WEBHOOK="https://hooks.slack.com/services/..."
export PAGERDUTY_KEY="..."
export EMAIL_ALERTS="admin@empresa.com,devops@empresa.com"
export PHONE_ALERTS="+5511999999999"
```

### Procedimento de Escalação

1. **Detecção do Problema** (0-5 min)
   - Alertas automáticos
   - Monitoramento contínuo
   - Relatórios de usuários

2. **Avaliação Inicial** (5-15 min)
   - Classificar severidade
   - Verificar impacto
   - Coletar informações iniciais

3. **Resposta Imediata** (15-30 min)
   - Implementar workarounds
   - Comunicar status
   - Escalar se necessário

4. **Resolução** (30 min - 4h)
   - Implementar correção
   - Verificar funcionamento
   - Documentar solução

5. **Post-Mortem** (24-48h)
   - Análise de causa raiz
   - Ações preventivas
   - Atualização de documentação

Este guia deve ser revisado mensalmente e atualizado conforme novos procedimentos são desenvolvidos.