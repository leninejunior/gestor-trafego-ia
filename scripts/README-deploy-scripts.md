# Scripts de Deploy - Sistema de Checkout e Pagamentos

## Visão Geral

Este diretório contém scripts para deploy seguro e monitoramento do sistema de checkout e pagamentos, incluindo validação automática, testes de smoke e monitoramento pós-deploy.

## Scripts Disponíveis

### 1. deploy-checkout-system.js

Script principal de deploy que executa validação completa do sistema em produção.

**Uso:**
```bash
# Deploy completo com todas as validações
node scripts/deploy-checkout-system.js

# Deploy com rollback automático em caso de falha
node scripts/deploy-checkout-system.js --auto-rollback

# Deploy pulando algumas etapas (para debug)
node scripts/deploy-checkout-system.js --skip-health-checks --skip-smoke-tests
```

**Funcionalidades:**
- Health checks de todos os endpoints críticos
- Smoke tests funcionais completos
- Monitoramento de métricas pós-deploy
- Rollback automático em caso de falha
- Relatório detalhado de deploy

**Parâmetros:**
- `--auto-rollback`: Executa rollback automático se deploy falhar
- `--skip-health-checks`: Pula verificações de saúde
- `--skip-smoke-tests`: Pula testes funcionais
- `--skip-metrics`: Pula coleta de métricas

### 2. post-deploy-monitoring.js

Script de monitoramento contínuo pós-deploy para detectar problemas em tempo real.

**Uso:**
```bash
# Monitoramento padrão (30 minutos)
node scripts/post-deploy-monitoring.js

# Monitoramento personalizado
node scripts/post-deploy-monitoring.js --duration 60 --interval 15

# Monitoramento de longa duração
node scripts/post-deploy-monitoring.js --duration 120 --interval 30
```

**Funcionalidades:**
- Monitoramento contínuo de APIs
- Análise de métricas de negócio
- Detecção de anomalias
- Alertas automáticos
- Integração com Slack (opcional)

**Parâmetros:**
- `--duration <minutos>`: Duração do monitoramento (padrão: 30)
- `--interval <segundos>`: Intervalo entre verificações (padrão: 30)

## Fluxo de Deploy Recomendado

### 1. Pré-Deploy

```bash
# 1. Executar migração (se necessário)
node scripts/migrate-checkout-system.js --auto-rollback

# 2. Validar integridade
node scripts/validate-migration-integrity.js

# 3. Testar schema
node scripts/test-checkout-schema-migration.js
```

### 2. Deploy Principal

```bash
# Deploy com validação completa
node scripts/deploy-checkout-system.js --auto-rollback
```

### 3. Monitoramento Pós-Deploy

```bash
# Monitoramento de 1 hora
node scripts/post-deploy-monitoring.js --duration 60
```

## Validações Executadas

### Health Checks

1. **API Principal** (`/api/health`)
   - Verifica se aplicação está respondendo
   - Timeout: 5 segundos

2. **Checkout API** (`/api/health/checkout`)
   - Valida sistema de checkout
   - Timeout: 10 segundos

3. **Integração Iugu** (`/api/health/iugu`)
   - Testa conectividade com gateway
   - Timeout: 15 segundos

4. **Dependências** (`/api/health/dependencies`)
   - Verifica banco de dados e serviços
   - Timeout: 10 segundos

### Smoke Tests

1. **Criar Subscription Intent**
   - Testa API de checkout completa
   - Valida criação e limpeza de dados

2. **Consultar Status**
   - Testa API de status
   - Valida consulta de intents

3. **Webhook Endpoint**
   - Testa recebimento de webhooks
   - Valida processamento básico

4. **Database Functions**
   - Testa funções críticas do banco
   - Valida integridade funcional

### Métricas Monitoradas

1. **Performance da API**
   - Tempo de resposta médio
   - Tempo de resposta máximo
   - Taxa de disponibilidade

2. **Métricas de Checkout**
   - Total de checkouts (24h)
   - Taxa de conversão
   - Taxa de erro

3. **Métricas de Webhook**
   - Total processados (24h)
   - Taxa de sucesso
   - Taxa de falha

## Configuração de Alertas

### Thresholds Padrão

```javascript
const alertThresholds = {
    errorRate: 5,            // 5% de taxa de erro
    responseTime: 5000,      // 5 segundos
    conversionRate: 70,      // 70% de conversão mínima
    webhookFailureRate: 10   // 10% de falha de webhook
};
```

### Severidades de Alerta

- **🟡 LOW**: Problemas menores, não críticos
- **🟠 MEDIUM**: Problemas que requerem atenção
- **🔴 HIGH**: Problemas sérios que afetam funcionalidade
- **🚨 CRITICAL**: Problemas críticos que requerem ação imediata

### Integração com Slack

Configure a variável de ambiente para receber alertas:

```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

## Arquivos Gerados

### Relatório de Deploy

```
deploy-report-{timestamp}.json
```

**Conteúdo:**
```json
{
  "startTime": "2024-01-15T10:00:00.000Z",
  "endTime": "2024-01-15T10:05:30.000Z",
  "duration": 330000,
  "phase": "completed",
  "success": true,
  "previousVersion": "1.0.0",
  "newVersion": "1.1.0",
  "healthChecks": {
    "API Principal": {
      "status": "passed",
      "responseTime": 150,
      "details": {...}
    }
  },
  "smokeTests": {
    "Criar Subscription Intent": {
      "status": "passed",
      "result": "Intent criado: uuid",
      "duration": 1250
    }
  },
  "metrics": {
    "checkout": {
      "total_24h": 45,
      "completed_24h": 42,
      "conversion_rate": 93.3
    }
  }
}
```

### Relatório de Monitoramento

```
post-deploy-monitoring-{timestamp}.json
```

**Conteúdo:**
```json
{
  "summary": {
    "startTime": "2024-01-15T10:05:30.000Z",
    "endTime": "2024-01-15T10:35:30.000Z",
    "duration": 1800,
    "totalChecks": 60,
    "totalAlerts": 2,
    "finalHealthStatus": "healthy"
  },
  "alerts": [
    {
      "timestamp": "2024-01-15T10:15:00.000Z",
      "type": "performance_degradation",
      "severity": "medium",
      "message": "Tempo de resposta aumentou...",
      "data": {...}
    }
  ],
  "healthTrend": [...],
  "metrics": {...}
}
```

## Variáveis de Ambiente

### Obrigatórias

```bash
# Aplicação
NEXT_PUBLIC_APP_URL=https://seu-dominio.com
NODE_ENV=production

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Iugu (para testes de integração)
IUGU_API_TOKEN=live_xxx
```

### Opcionais

```bash
# Rollback automático
AUTO_ROLLBACK=true

# Notificações
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...

# Configurações de monitoramento
MONITORING_DURATION=1800  # 30 minutos em segundos
MONITORING_INTERVAL=30    # 30 segundos
```

## Troubleshooting

### Problemas Comuns

#### 1. Health Check Falhando

```
❌ Checkout API: HTTP 500
```

**Diagnóstico:**
```bash
# Verificar logs da aplicação
curl -I https://seu-dominio.com/api/health/checkout

# Verificar conectividade
curl -I https://seu-dominio.com/api/health
```

**Soluções:**
- Verificar se aplicação foi deployada corretamente
- Validar variáveis de ambiente
- Verificar logs do servidor

#### 2. Smoke Test Falhando

```
❌ Criar Subscription Intent: HTTP 400: Validation error
```

**Diagnóstico:**
```bash
# Testar manualmente
curl -X POST https://seu-dominio.com/api/subscriptions/checkout-iugu \
  -H "Content-Type: application/json" \
  -d '{"plan_id":"...","billing_cycle":"monthly",...}'
```

**Soluções:**
- Verificar se planos estão ativos no banco
- Validar schema de dados
- Verificar integração com Iugu

#### 3. Métricas Inconsistentes

```
⚠️ Taxa de conversão caiu drasticamente: 45% vs 85% média anterior
```

**Diagnóstico:**
```bash
# Verificar dados no banco
psql -c "SELECT status, COUNT(*) FROM subscription_intents WHERE created_at > NOW() - INTERVAL '1 hour' GROUP BY status;"
```

**Soluções:**
- Investigar problemas no fluxo de checkout
- Verificar processamento de webhooks
- Validar integridade dos dados

### Comandos de Debug

```bash
# Verificar status da aplicação
curl -s https://seu-dominio.com/api/health | jq '.'

# Testar endpoint específico
curl -s -w "%{http_code} %{time_total}s\n" -o /dev/null https://seu-dominio.com/api/health/checkout

# Verificar métricas recentes
psql -c "SELECT * FROM subscription_intents WHERE created_at > NOW() - INTERVAL '1 hour' ORDER BY created_at DESC LIMIT 10;"

# Monitorar logs em tempo real
tail -f /var/log/app/checkout.log
```

## Rollback de Emergência

Se o deploy falhar e rollback automático não funcionar:

```bash
# 1. Rollback da aplicação (implementar conforme sua infraestrutura)
# Exemplo com Docker:
docker service update --rollback checkout-app

# 2. Rollback do banco (se necessário)
node scripts/rollback-checkout-migration.js --force

# 3. Verificar saúde após rollback
node scripts/deploy-checkout-system.js --skip-smoke-tests
```

## Integração com CI/CD

### GitHub Actions

```yaml
name: Deploy Checkout System

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run migration
        run: node scripts/migrate-checkout-system.js --auto-rollback
        
      - name: Deploy application
        run: node scripts/deploy-checkout-system.js --auto-rollback
        
      - name: Post-deploy monitoring
        run: node scripts/post-deploy-monitoring.js --duration 30
```

### Vercel

```json
{
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/node"
    }
  ],
  "functions": {
    "scripts/deploy-checkout-system.js": {
      "maxDuration": 300
    }
  }
}
```

## Suporte

Para problemas com deploy:

1. Verificar logs detalhados nos relatórios gerados
2. Executar comandos de debug específicos
3. Consultar documentação de troubleshooting
4. Em emergência, executar rollback manual

**Contato:** Equipe de DevOps / SRE