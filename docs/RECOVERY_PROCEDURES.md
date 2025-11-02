# Recovery Procedures - Sistema de Checkout e Pagamentos

Este documento contém procedures detalhados para recuperação de falhas no sistema de checkout e pagamentos.

## Índice

1. [Procedures de Emergência](#procedures-de-emergência)
2. [Recuperação de Subscription Intents](#recuperação-de-subscription-intents)
3. [Recuperação de Webhook Logs](#recuperação-de-webhook-logs)
4. [Recuperação de Dados de Pagamento](#recuperação-de-dados-de-pagamento)
5. [Recuperação Completa do Sistema](#recuperação-completa-do-sistema)
6. [Validação Pós-Recuperação](#validação-pós-recuperação)

## Procedures de Emergência

### 1. Falha Total do Sistema de Checkout

**Tempo Estimado:** 30-45 minutos  
**Criticidade:** ALTA  
**Pré-requisitos:**
- Acesso ao servidor de produção
- Backup válido das últimas 24 horas
- Acesso ao painel do Iugu

#### Passos:

1. **Ativar Modo de Manutenção**
   ```bash
   # Ativar página de manutenção
   touch /var/www/maintenance.flag
   
   # Verificar se está ativo
   curl -I https://app.exemplo.com/checkout
   # Deve retornar 503 Service Unavailable
   ```

2. **Verificar Status dos Serviços**
   ```bash
   # Verificar banco de dados
   npm run health:database
   
   # Verificar Iugu
   npm run health:iugu
   
   # Verificar circuit breakers
   npm run health:circuit-breakers
   ```

3. **Restaurar Backup Crítico**
   ```bash
   # Listar backups disponíveis
   npm run backup:list
   
   # Restaurar último backup crítico
   npm run backup:restore --type=critical --confirm
   ```

4. **Reprocessar Intents Pendentes**
   ```bash
   # Verificar intents pendentes
   npm run intents:list --status=pending
   
   # Reprocessar intents
   npm run intents:reprocess --batch-size=10
   ```

5. **Validar Recuperação**
   ```bash
   # Testar checkout completo
   npm run test:checkout-flow
   
   # Verificar webhooks
   npm run test:webhook-processing
   ```

6. **Desativar Modo de Manutenção**
   ```bash
   rm /var/www/maintenance.flag
   ```

#### Rollback:
Se a recuperação falhar, restaurar estado anterior:
```bash
npm run backup:restore --backup-id=<PRE_RECOVERY_BACKUP>
```

---

### 2. Falha do Iugu (Serviço Externo)

**Tempo Estimado:** 10-15 minutos  
**Criticidade:** MÉDIA  
**Pré-requisitos:**
- Confirmação de que o Iugu está indisponível
- Sistema de fallback configurado

#### Passos:

1. **Ativar Modo Degradado**
   ```bash
   # Forçar circuit breaker para OPEN
   npm run circuit-breaker:force-open --service=iugu
   
   # Verificar status
   npm run circuit-breaker:status
   ```

2. **Processar Checkouts em Modo Degradado**
   ```bash
   # Verificar intents em modo degradado
   npm run intents:list --status=degraded_pending
   
   # Monitorar criação de novos intents
   npm run intents:monitor --mode=degraded
   ```

3. **Quando Iugu Voltar**
   ```bash
   # Verificar saúde do Iugu
   npm run health:iugu
   
   # Resetar circuit breaker
   npm run circuit-breaker:reset --service=iugu
   
   # Processar intents pendentes
   npm run intents:process-degraded
   ```

---

## Recuperação de Subscription Intents

### Cenário: Perda de Dados de Subscription Intents

**Tempo Estimado:** 20-30 minutos  
**Criticidade:** ALTA

#### Identificação do Problema:
```sql
-- Verificar intents órfãos ou corrompidos
SELECT 
    id, 
    status, 
    created_at, 
    updated_at,
    CASE 
        WHEN updated_at < NOW() - INTERVAL '2 hours' AND status IN ('pending', 'processing') 
        THEN 'STALE'
        ELSE 'OK'
    END as health_status
FROM subscription_intents 
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

#### Recuperação:

1. **Backup Preventivo**
   ```bash
   # Criar backup do estado atual
   npm run backup:create --type=critical --name="pre_intent_recovery"
   ```

2. **Identificar Período Afetado**
   ```bash
   # Analisar logs para identificar período
   npm run logs:analyze --service=checkout --from="2024-01-01 10:00" --to="2024-01-01 12:00"
   ```

3. **Restaurar do Backup**
   ```bash
   # Listar backups disponíveis
   npm run backup:list --table=subscription_intents
   
   # Restaurar período específico
   npm run backup:restore --table=subscription_intents --from="2024-01-01 09:00" --to="2024-01-01 13:00"
   ```

4. **Reconciliar com Iugu**
   ```bash
   # Sincronizar com dados do Iugu
   npm run iugu:sync --reconcile --dry-run
   
   # Aplicar sincronização
   npm run iugu:sync --reconcile --apply
   ```

5. **Validação**
   ```sql
   -- Verificar integridade pós-recuperação
   SELECT 
       COUNT(*) as total_intents,
       COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
       COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
       COUNT(CASE WHEN iugu_customer_id IS NOT NULL THEN 1 END) as with_iugu_data
   FROM subscription_intents 
   WHERE created_at > NOW() - INTERVAL '24 hours';
   ```

---

## Recuperação de Webhook Logs

### Cenário: Perda de Logs de Webhook para Auditoria

**Tempo Estimado:** 15-20 minutos  
**Criticidade:** MÉDIA

#### Recuperação:

1. **Identificar Período Perdido**
   ```sql
   -- Verificar gaps nos logs
   SELECT 
       DATE(created_at) as log_date,
       COUNT(*) as log_count,
       MIN(created_at) as first_log,
       MAX(created_at) as last_log
   FROM webhook_logs 
   WHERE created_at > NOW() - INTERVAL '7 days'
   GROUP BY DATE(created_at)
   ORDER BY log_date;
   ```

2. **Restaurar do Backup**
   ```bash
   # Restaurar logs de webhook
   npm run backup:restore --table=webhook_logs --from="2024-01-01" --to="2024-01-02"
   ```

3. **Recuperar do Sistema de Replicação**
   ```bash
   # Verificar dados replicados
   npm run replication:recover --target=redis-cache --table=webhook_logs
   
   # Recuperar de arquivo
   npm run replication:recover --target=local-backup --table=webhook_logs
   ```

4. **Validação**
   ```sql
   -- Verificar continuidade dos logs
   SELECT 
       event_type,
       COUNT(*) as count,
       MIN(created_at) as first_event,
       MAX(created_at) as last_event
   FROM webhook_logs 
   WHERE created_at BETWEEN '2024-01-01' AND '2024-01-02'
   GROUP BY event_type;
   ```

---

## Recuperação de Dados de Pagamento

### Cenário: Inconsistência entre Sistema e Iugu

**Tempo Estimado:** 45-60 minutos  
**Criticidade:** ALTA

#### Recuperação:

1. **Auditoria Completa**
   ```bash
   # Comparar dados locais com Iugu
   npm run audit:payment-consistency --full-scan
   ```

2. **Identificar Discrepâncias**
   ```bash
   # Gerar relatório de discrepâncias
   npm run audit:generate-report --output=/tmp/payment_audit.json
   ```

3. **Recuperação Seletiva**
   ```bash
   # Recuperar dados específicos do Iugu
   npm run iugu:recover --subscription-ids="sub_123,sub_456"
   
   # Atualizar status locais
   npm run payments:sync-status --reconcile
   ```

4. **Validação Financeira**
   ```bash
   # Verificar totais financeiros
   npm run finance:validate-totals --period="last_30_days"
   ```

---

## Recuperação Completa do Sistema

### Cenário: Disaster Recovery Completo

**Tempo Estimado:** 2-4 horas  
**Criticidade:** CRÍTICA

#### Pré-requisitos:
- Backup completo válido
- Novo ambiente de produção
- Credenciais do Iugu
- DNS configurado

#### Passos:

1. **Preparação do Ambiente**
   ```bash
   # Configurar variáveis de ambiente
   cp .env.production.example .env.production
   
   # Instalar dependências
   npm ci --production
   
   # Configurar banco de dados
   npm run db:setup
   ```

2. **Restauração de Dados**
   ```bash
   # Restaurar backup completo
   npm run backup:restore --type=full --latest
   
   # Verificar integridade
   npm run db:verify-integrity
   ```

3. **Configuração de Serviços**
   ```bash
   # Inicializar circuit breakers
   npm run circuit-breaker:initialize
   
   # Configurar replicação
   npm run replication:setup
   
   # Iniciar monitoramento
   npm run monitoring:start
   ```

4. **Testes de Funcionalidade**
   ```bash
   # Teste completo do sistema
   npm run test:full-system
   
   # Teste de integração com Iugu
   npm run test:iugu-integration
   
   # Teste de webhooks
   npm run test:webhook-flow
   ```

5. **Ativação Gradual**
   ```bash
   # Ativar modo somente leitura
   npm run system:readonly-mode
   
   # Processar intents pendentes
   npm run intents:process-backlog
   
   # Ativar modo completo
   npm run system:full-mode
   ```

---

## Validação Pós-Recuperação

### Checklist de Validação

#### 1. Funcionalidade Básica
- [ ] Página de checkout carrega corretamente
- [ ] Criação de subscription intent funciona
- [ ] Redirecionamento para Iugu funciona
- [ ] Webhook processing funciona

#### 2. Integridade de Dados
- [ ] Subscription intents estão consistentes
- [ ] Webhook logs estão completos
- [ ] Dados financeiros batem com Iugu
- [ ] Usuários conseguem acessar suas assinaturas

#### 3. Monitoramento
- [ ] Circuit breakers estão funcionando
- [ ] Métricas estão sendo coletadas
- [ ] Alertas estão configurados
- [ ] Logs estão sendo gerados

#### 4. Performance
- [ ] Tempo de resposta do checkout < 3s
- [ ] Processing de webhooks < 5s
- [ ] Queries de banco < 1s
- [ ] Circuit breakers respondem adequadamente

### Comandos de Validação

```bash
# Validação completa do sistema
npm run validate:system-health

# Teste de carga básico
npm run test:load --duration=5m --users=10

# Verificação de segurança
npm run security:audit

# Teste de failover
npm run test:failover-scenarios
```

---

## Contatos de Emergência

- **Equipe de DevOps:** devops@empresa.com
- **Suporte Iugu:** suporte@iugu.com
- **Gerente de Produto:** produto@empresa.com
- **CTO:** cto@empresa.com

## Logs e Monitoramento

- **Logs de Sistema:** `/var/log/checkout/`
- **Métricas:** Grafana Dashboard
- **Alertas:** PagerDuty / Slack #alerts
- **Status Page:** status.empresa.com