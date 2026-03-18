# Guia de Troubleshooting - Sistema de Checkout e Pagamentos

## Visão Geral

Este guia fornece procedimentos detalhados para diagnosticar e resolver problemas no sistema de checkout e pagamentos, incluindo falhas de API, problemas de webhook, e questões de integração com o Iugu.

## Problemas Comuns

### 1. Falhas no Checkout

#### Sintomas
- Erro 500 na API de checkout
- Timeout na criação de intenção
- Falha na criação do cliente Iugu

#### Diagnóstico

```bash
# 1. Verificar logs da API
curl -H "Authorization: Bearer <admin_token>" \
  /api/admin/subscription-intents/analytics

# 2. Verificar conectividade com Iugu
curl -H "Authorization: Bearer <admin_token>" \
  /api/health/iugu

# 3. Verificar status do banco de dados
curl -H "Authorization: Bearer <admin_token>" \
  /api/health/dependencies
```

#### Soluções

**Erro de Validação (400)**
```sql
-- Verificar planos ativos
SELECT id, name, status, monthly_price, annual_price 
FROM subscription_plans 
WHERE status = 'active';

-- Verificar se o plano existe
SELECT * FROM subscription_plans WHERE id = '<plan_id>';
```

**Erro de Conectividade Iugu (502)**
```bash
# Verificar variáveis de ambiente
node scripts/check-env.js

# Testar API do Iugu diretamente
curl -X GET "https://api.iugu.com/v1/customers" \
  -H "Authorization: Basic <base64_token>"
```

**Erro de Banco de Dados (500)**
```sql
-- Verificar conexões ativas
SELECT count(*) FROM pg_stat_activity;

-- Verificar locks
SELECT * FROM pg_locks WHERE NOT granted;

-- Verificar espaço em disco
SELECT pg_size_pretty(pg_database_size(current_database()));
```

### 2. Problemas de Webhook

#### Sintomas
- Webhooks não processados
- Status de pagamento não atualizado
- Contas não criadas automaticamente

#### Diagnóstico

```sql
-- Verificar webhooks recentes
SELECT 
  event_type,
  status,
  COUNT(*) as count,
  MAX(created_at) as last_received
FROM webhook_logs 
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY event_type, status;

-- Verificar webhooks falhando
SELECT 
  id,
  event_type,
  error_message,
  retry_count,
  created_at
FROM webhook_logs 
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT 10;
```

#### Soluções

**Webhook Não Recebido**
```bash
# 1. Verificar configuração no Iugu
# Acessar painel Iugu > Configurações > Webhooks
# URL deve ser: https://seu-dominio.com/api/webhooks/iugu

# 2. Testar endpoint manualmente
curl -X POST /api/webhooks/iugu \
  -H "Content-Type: application/json" \
  -d '{
    "event": "invoice.status_changed",
    "data": {
      "id": "test_invoice_123",
      "status": "paid"
    }
  }'
```

**Webhook Processamento Falhando**
```sql
-- Reprocessar webhook específico
SELECT * FROM webhook_logs WHERE id = '<webhook_id>';

-- Verificar intent relacionado
SELECT si.* 
FROM subscription_intents si
JOIN webhook_logs wl ON wl.subscription_intent_id = si.id
WHERE wl.id = '<webhook_id>';
```

**Conta Não Criada Automaticamente**
```sql
-- Verificar se usuário já existe
SELECT * FROM auth.users WHERE email = '<user_email>';

-- Verificar organizações criadas
SELECT * FROM organizations WHERE name = '<organization_name>';

-- Verificar memberships
SELECT om.*, o.name as org_name, u.email
FROM organization_memberships om
JOIN organizations o ON om.organization_id = o.id
JOIN auth.users u ON om.user_id = u.id
WHERE u.email = '<user_email>';
```

### 3. Problemas de Status

#### Sintomas
- Status não atualizado em tempo real
- Intent preso em "processing"
- Expiração não funcionando

#### Diagnóstico

```sql
-- Verificar intents presos
SELECT 
  id,
  status,
  created_at,
  updated_at,
  expires_at,
  EXTRACT(EPOCH FROM (NOW() - updated_at))/60 as minutes_stuck
FROM subscription_intents 
WHERE status IN ('pending', 'processing')
  AND updated_at < NOW() - INTERVAL '30 minutes'
ORDER BY updated_at;

-- Verificar transições de status
SELECT 
  sit.*,
  si.status as current_status
FROM subscription_intent_transitions sit
JOIN subscription_intents si ON sit.subscription_intent_id = si.id
WHERE sit.subscription_intent_id = '<intent_id>'
ORDER BY sit.created_at DESC;
```

#### Soluções

**Intent Preso em Processing**
```sql
-- Forçar expiração se necessário
UPDATE subscription_intents 
SET status = 'expired',
    metadata = metadata || jsonb_build_object(
      'forced_expiration', true,
      'forced_at', NOW(),
      'reason', 'Manual intervention - stuck in processing'
    )
WHERE id = '<intent_id>' 
  AND status = 'processing'
  AND expires_at < NOW();
```

**Limpeza Manual de Expirados**
```sql
-- Executar limpeza manual
SELECT cleanup_expired_intents(7); -- últimos 7 dias
```

### 4. Problemas de Performance

#### Sintomas
- API lenta (>5 segundos)
- Timeout em consultas
- Alto uso de CPU/memória

#### Diagnóstico

```sql
-- Verificar queries lentas
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  rows
FROM pg_stat_statements 
WHERE query LIKE '%subscription_intents%'
ORDER BY mean_time DESC
LIMIT 10;

-- Verificar índices não utilizados
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE idx_scan = 0;

-- Verificar tamanho das tabelas
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size(tablename::regclass)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(tablename::regclass) DESC;
```

#### Soluções

**Otimização de Queries**
```sql
-- Adicionar índices se necessário
CREATE INDEX CONCURRENTLY idx_subscription_intents_user_status_created 
ON subscription_intents(user_email, status, created_at);

-- Atualizar estatísticas
ANALYZE subscription_intents;
ANALYZE webhook_logs;
ANALYZE payment_analytics;
```

**Limpeza de Dados Antigos**
```sql
-- Limpar dados antigos
SELECT cleanup_expired_intents(90);
SELECT cleanup_webhook_logs(180);

-- Vacuum para recuperar espaço
VACUUM ANALYZE subscription_intents;
VACUUM ANALYZE webhook_logs;
```

## Procedimentos de Recovery

### 1. Recovery de Webhook Perdido

Quando um webhook é perdido e o pagamento não é processado:

```sql
-- 1. Identificar intent não processado
SELECT * FROM subscription_intents 
WHERE status = 'processing' 
  AND created_at < NOW() - INTERVAL '1 hour';

-- 2. Verificar no Iugu se pagamento foi confirmado
-- (Usar API do Iugu ou painel administrativo)

-- 3. Se confirmado, processar manualmente
UPDATE subscription_intents 
SET status = 'completed',
    completed_at = NOW(),
    metadata = metadata || jsonb_build_object(
      'manual_completion', true,
      'completed_by', 'admin',
      'reason', 'Webhook perdido - pagamento confirmado no Iugu'
    )
WHERE id = '<intent_id>';

-- 4. Criar conta manualmente se necessário
-- (Usar API de criação de conta ou painel admin)
```

### 2. Recovery de Falha de Criação de Conta

Quando o pagamento é confirmado mas a conta não é criada:

```sql
-- 1. Verificar intent completado sem usuário
SELECT * FROM subscription_intents 
WHERE status = 'completed' 
  AND user_id IS NULL;

-- 2. Criar conta manualmente via API
curl -X POST /api/admin/accounts/create-from-intent \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"intent_id": "<intent_id>"}'
```

### 3. Recovery de Dados Corrompidos

```sql
-- Backup antes de qualquer correção
CREATE TABLE subscription_intents_backup AS 
SELECT * FROM subscription_intents 
WHERE created_at > NOW() - INTERVAL '7 days';

-- Verificar integridade referencial
SELECT si.id, si.plan_id
FROM subscription_intents si
LEFT JOIN subscription_plans sp ON si.plan_id = sp.id
WHERE sp.id IS NULL;

-- Corrigir referências quebradas se necessário
-- (Caso por caso, dependendo do problema)
```

## Monitoramento Proativo

### 1. Alertas Automáticos

```sql
-- Query para detectar problemas
CREATE OR REPLACE VIEW system_health_alerts AS
SELECT 
  'high_failure_rate' as alert_type,
  'Checkout' as component,
  COUNT(*) as count,
  'Alta taxa de falha no checkout' as message
FROM subscription_intents 
WHERE created_at > NOW() - INTERVAL '1 hour'
  AND status = 'failed'
HAVING COUNT(*) > 10

UNION ALL

SELECT 
  'stuck_processing' as alert_type,
  'Webhook' as component,
  COUNT(*) as count,
  'Intents presos em processamento' as message
FROM subscription_intents 
WHERE status = 'processing'
  AND updated_at < NOW() - INTERVAL '30 minutes'
HAVING COUNT(*) > 5

UNION ALL

SELECT 
  'webhook_failures' as alert_type,
  'Webhook' as component,
  COUNT(*) as count,
  'Muitas falhas de webhook' as message
FROM webhook_logs 
WHERE created_at > NOW() - INTERVAL '1 hour'
  AND status = 'failed'
HAVING COUNT(*) > 20;
```

### 2. Dashboard de Saúde

```sql
-- Métricas para dashboard
SELECT 
  'checkout_success_rate' as metric,
  ROUND(
    COUNT(*) FILTER (WHERE status IN ('completed', 'processing')) * 100.0 / 
    NULLIF(COUNT(*), 0), 2
  ) as value,
  '%' as unit
FROM subscription_intents 
WHERE created_at > NOW() - INTERVAL '24 hours'

UNION ALL

SELECT 
  'avg_processing_time' as metric,
  ROUND(
    AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 60)::numeric, 2
  ) as value,
  'minutes' as unit
FROM subscription_intents 
WHERE status = 'completed'
  AND created_at > NOW() - INTERVAL '24 hours'

UNION ALL

SELECT 
  'webhook_success_rate' as metric,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'processed') * 100.0 / 
    NULLIF(COUNT(*), 0), 2
  ) as value,
  '%' as unit
FROM webhook_logs 
WHERE created_at > NOW() - INTERVAL '24 hours';
```

## Scripts de Diagnóstico

### 1. Script de Verificação Completa

```bash
#!/bin/bash
# health-check.sh

echo "=== Sistema de Checkout - Verificação de Saúde ==="

# Verificar APIs
echo "1. Testando APIs..."
curl -s -o /dev/null -w "%{http_code}" /api/health/checkout
echo " - Checkout API: $?"

curl -s -o /dev/null -w "%{http_code}" /api/health/iugu  
echo " - Iugu Integration: $?"

# Verificar banco de dados
echo "2. Verificando banco de dados..."
psql -c "SELECT COUNT(*) FROM subscription_intents WHERE created_at > NOW() - INTERVAL '1 hour';"

# Verificar webhooks
echo "3. Verificando webhooks..."
psql -c "SELECT status, COUNT(*) FROM webhook_logs WHERE created_at > NOW() - INTERVAL '1 hour' GROUP BY status;"

# Verificar alertas
echo "4. Verificando alertas..."
psql -c "SELECT * FROM system_health_alerts;"

echo "=== Verificação Concluída ==="
```

### 2. Script de Limpeza

```bash
#!/bin/bash
# cleanup.sh

echo "=== Executando Limpeza do Sistema ==="

# Limpar intents expirados
psql -c "SELECT cleanup_expired_intents(30);"

# Limpar webhook logs antigos
psql -c "SELECT cleanup_webhook_logs(90);"

# Atualizar analytics
psql -c "SELECT update_payment_analytics();"

# Vacuum
psql -c "VACUUM ANALYZE subscription_intents;"
psql -c "VACUUM ANALYZE webhook_logs;"

echo "=== Limpeza Concluída ==="
```

## Contatos de Emergência

### Escalação de Problemas

1. **Nível 1 - Problemas Menores**
   - Falhas individuais de checkout
   - Webhooks com retry bem-sucedido
   - Consultas de status lentas

2. **Nível 2 - Problemas Moderados**
   - Taxa de falha > 10%
   - Webhooks falhando consistentemente
   - Performance degradada

3. **Nível 3 - Problemas Críticos**
   - Sistema de checkout indisponível
   - Perda de dados
   - Falha completa de integração com Iugu

### Informações para Suporte

Ao reportar problemas, incluir:

- Timestamp do problema
- IDs de intent afetados
- Logs de erro relevantes
- Métricas de performance
- Passos para reproduzir

### Logs Importantes

```bash
# Logs da aplicação
tail -f /var/log/app/checkout.log

# Logs do banco de dados
tail -f /var/log/postgresql/postgresql.log

# Logs de webhook
tail -f /var/log/app/webhook.log
```

Este guia deve ser atualizado conforme novos problemas são identificados e soluções são desenvolvidas.