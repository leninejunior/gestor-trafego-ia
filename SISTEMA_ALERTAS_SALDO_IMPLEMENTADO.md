# Sistema de Alertas de Saldo - Implementado ✅

## 📋 Resumo

Sistema completo de monitoramento de saldo das contas Meta Ads com alertas automáticos de saldo baixo e saldo zerado.

## 🎯 Funcionalidades Implementadas

### 1. Monitoramento de Saldo em Tempo Real
- ✅ Busca automática de saldo das contas Meta Ads
- ✅ Cálculo de projeção de dias restantes
- ✅ Status visual (Saudável, Atenção, Crítico)
- ✅ Atualização periódica dos valores

### 2. Alertas Configuráveis
- ✅ Alerta de saldo baixo (threshold configurável)
- ✅ Alerta de saldo zerado (crítico automático)
- ✅ Alertas por conta individual
- ✅ Ativação/desativação de alertas

### 3. Notificações Multi-Canal
- ✅ Email (estrutura pronta)
- ✅ Push Notification (estrutura pronta)
- ✅ WhatsApp via Evolution API (integrado)
- ✅ Histórico de notificações enviadas

### 4. Interface Administrativa
- ✅ Dashboard de saldo com KPIs
- ✅ Cards visuais por conta
- ✅ Configuração de alertas
- ✅ Histórico de alertas
- ✅ Gráficos e estatísticas

## 📁 Arquivos Criados

### Database Schema
```
database/balance-alerts-schema.sql
```
- Tabela `balance_alerts` - Configuração de alertas
- Tabela `alert_history` - Histórico de envios
- Tabela `alert_recipients` - Destinatários
- Tabela `whatsapp_config` - Configuração WhatsApp
- Views e Functions auxiliares

### APIs
```
src/app/api/admin/balance/
├── accounts/route.ts          # Buscar saldo das contas
├── alerts/route.ts            # Listar e criar alertas
├── alerts/[alertId]/route.ts  # Gerenciar alerta específico
└── history/route.ts           # Histórico de alertas
```

### Serviços
```
src/lib/services/balance-alert-service.ts
```
- Verificação automática de alertas
- Disparo de notificações
- Integração com WhatsApp
- Gerenciamento de histórico

### Componentes UI
```
src/components/balance/
├── balance-status-card.tsx           # Card de status visual
└── balance-alert-config-dialog.tsx   # Dialog de configuração
```

### Cron Job
```
src/app/api/cron/check-balance-alerts/route.ts
vercel-cron-balance-alerts.json
```

### Scripts
```
scripts/testar-alertas-saldo.js
```

## 🚀 Como Usar

### 1. Aplicar Schema no Supabase

```sql
-- Execute no SQL Editor do Supabase
-- Arquivo: database/balance-alerts-schema.sql
```

### 2. Configurar Variáveis de Ambiente

```env
# .env
NEXT_PUBLIC_SUPABASE_URL=sua_url
SUPABASE_SERVICE_ROLE_KEY=sua_chave
CRON_SECRET=sua_chave_secreta_para_cron
```

### 3. Testar Sistema

```bash
# Testar criação de alertas
node scripts/testar-alertas-saldo.js

# Testar API de saldo
curl http://localhost:3000/api/admin/balance/accounts

# Testar verificação de alertas
curl -X POST http://localhost:3000/api/cron/check-balance-alerts \
  -H "Authorization: Bearer SEU_CRON_SECRET"
```

### 4. Acessar Interface

```
http://localhost:3000/admin/balance
```

## 📊 Estrutura de Dados

### Balance Alert
```typescript
{
  id: string
  client_id: string
  ad_account_id: string
  ad_account_name: string
  threshold_amount: number
  alert_type: 'low_balance' | 'no_balance' | 'daily_limit' | 'weekly_limit'
  current_balance: number
  is_active: boolean
  last_checked_at: timestamp
  last_alert_sent_at: timestamp
}
```

### Account Balance
```typescript
{
  account_id: string
  account_name: string
  currency: string
  balance: number
  daily_spend_limit: number
  account_spend_limit: number
  current_spend: number
  daily_spend: number
  projected_days_remaining: number
  status: 'healthy' | 'warning' | 'critical'
}
```

## 🔔 Tipos de Alertas

### 1. Saldo Baixo (low_balance)
- Dispara quando: `saldo <= threshold_amount`
- Frequência: A cada 24 horas
- Severidade: ⚠️ Atenção

### 2. Saldo Zerado (no_balance)
- Dispara quando: `saldo <= 0`
- Frequência: A cada 2 horas
- Severidade: 🚨 Crítico

### 3. Limite Diário (daily_limit)
- Dispara quando: gasto diário atinge limite
- Status: 🚧 Em desenvolvimento

### 4. Limite Semanal (weekly_limit)
- Dispara quando: gasto semanal atinge limite
- Status: 🚧 Em desenvolvimento

## 🎨 Status Visuais

### 🟢 Saudável (Healthy)
- Saldo > 40% do limite
- Projeção > 7 dias
- Cor: Verde

### 🟡 Atenção (Warning)
- Saldo entre 20% e 40% do limite
- Projeção entre 3 e 7 dias
- Cor: Amarelo

### 🔴 Crítico (Critical)
- Saldo < 20% do limite ou zerado
- Projeção < 3 dias
- Cor: Vermelho

## 📱 Integração WhatsApp

### Configurar Evolution API

```sql
INSERT INTO whatsapp_config (
  organization_id,
  evolution_api_url,
  evolution_api_key,
  instance_name,
  phone_number,
  is_active
) VALUES (
  'sua_org_id',
  'https://sua-evolution-api.com',
  'sua_api_key',
  'sua_instancia',
  '5511999999999',
  true
);
```

### Formato da Mensagem

**Saldo Zerado:**
```
🚨 *ALERTA CRÍTICO - SALDO ZERADO*

Conta: Nome da Conta
ID: act_123456789
Saldo atual: R$ 0,00

⚠️ Suas campanhas podem ser pausadas a qualquer momento!
Por favor, adicione créditos imediatamente.
```

**Saldo Baixo:**
```
⚠️ *ALERTA - SALDO BAIXO*

Conta: Nome da Conta
ID: act_123456789
Saldo atual: R$ 50,00
Limite configurado: R$ 100,00

Considere adicionar créditos em breve para evitar interrupções.
```

## ⚙️ Configuração do Cron Job

### Vercel

1. Adicionar ao `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/check-balance-alerts",
      "schedule": "0 * * * *"
    }
  ]
}
```

2. Configurar variável de ambiente:
```
CRON_SECRET=sua_chave_secreta
```

### Frequência Recomendada
- **Produção**: A cada 1 hora (`0 * * * *`)
- **Desenvolvimento**: Manual ou a cada 6 horas

## 📈 Métricas e KPIs

### Dashboard Principal
- Saldo Total de todas as contas
- Gasto Diário médio
- Número de contas críticas
- Dias restantes (projeção mais crítica)

### Por Conta
- Saldo atual vs. limite
- Gasto diário vs. limite diário
- Projeção de dias restantes
- Status visual

### Histórico
- Total de alertas enviados
- Taxa de sucesso de envio
- Alertas por tipo
- Contas mais alertadas

## 🔒 Segurança

### RLS Policies
- ✅ Usuários só veem alertas de suas organizações
- ✅ Apenas admins podem criar/editar alertas
- ✅ Histórico isolado por organização

### Validações
- ✅ Threshold mínimo > 0
- ✅ Pelo menos um tipo de notificação ativo
- ✅ Verificação de permissões em todas as APIs

## 🧪 Testes

### Teste Manual
```bash
# 1. Criar alertas de teste
node scripts/testar-alertas-saldo.js

# 2. Verificar alertas criados
curl http://localhost:3000/api/admin/balance/alerts

# 3. Simular verificação
curl -X POST http://localhost:3000/api/cron/check-balance-alerts

# 4. Ver histórico
curl http://localhost:3000/api/admin/balance/history
```

### Teste de Integração
1. Conectar conta Meta Ads
2. Configurar alerta com threshold alto
3. Aguardar verificação automática
4. Verificar recebimento de notificação

## 📝 Próximos Passos

### Melhorias Futuras
- [ ] Integração com Telegram
- [ ] Alertas de limite diário/semanal
- [ ] Previsão de esgotamento com ML
- [ ] Recomendações automáticas de recarga
- [ ] Dashboard de tendências
- [ ] Exportação de relatórios
- [ ] Alertas personalizados por horário
- [ ] Integração com sistema de pagamentos

### Otimizações
- [ ] Cache de saldos (Redis)
- [ ] Batch processing de alertas
- [ ] Rate limiting de notificações
- [ ] Retry automático de envios falhados

## 🐛 Troubleshooting

### Alertas não estão sendo disparados
1. Verificar se o Cron Job está configurado
2. Verificar logs em `/api/cron/check-balance-alerts`
3. Verificar se `is_active = true` nos alertas
4. Verificar se `current_balance` está atualizado

### Notificações não chegam
1. Verificar configuração do WhatsApp em `whatsapp_config`
2. Verificar destinatários em `alert_recipients`
3. Verificar histórico em `alert_history` para erros
4. Testar Evolution API manualmente

### Saldos não atualizam
1. Verificar tokens de acesso Meta
2. Verificar permissões das contas
3. Verificar logs da API `/api/admin/balance/accounts`
4. Verificar rate limits do Meta

## 📞 Suporte

Para dúvidas ou problemas:
1. Verificar logs do Supabase
2. Verificar logs do Vercel
3. Executar script de teste
4. Verificar documentação do Meta Ads API

## ✅ Checklist de Implementação

- [x] Schema do banco de dados
- [x] APIs de saldo e alertas
- [x] Serviço de verificação
- [x] Componentes UI
- [x] Integração WhatsApp
- [x] Cron Job
- [x] Testes
- [x] Documentação

## 🎉 Conclusão

Sistema completo de alertas de saldo implementado e pronto para uso! O sistema monitora automaticamente o saldo das contas Meta Ads e dispara alertas quando necessário, ajudando a evitar interrupções nas campanhas.
