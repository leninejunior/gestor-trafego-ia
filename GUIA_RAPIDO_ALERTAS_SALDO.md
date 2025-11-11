# Guia Rápido - Sistema de Alertas de Saldo 🚀

## ⚡ Início Rápido (5 minutos)

### 1. Aplicar Schema no Banco de Dados

**Opção A: Via Supabase SQL Editor (Recomendado)**
```
1. Acesse: https://supabase.com/dashboard/project/SEU_PROJETO/sql
2. Abra o arquivo: database/balance-alerts-schema.sql
3. Copie todo o conteúdo
4. Cole no SQL Editor
5. Clique em "Run"
```

**Opção B: Via Script**
```bash
node scripts/aplicar-schema-alertas-saldo.js
```

### 2. Testar Sistema

```bash
node scripts/testar-alertas-saldo.js
```

### 3. Acessar Interface

```
http://localhost:3000/admin/balance
```

## 📱 Como Usar

### Configurar Alerta para uma Conta

1. Acesse `/admin/balance`
2. Clique em "Configurar Alertas"
3. Selecione a conta
4. Defina o limite de saldo (ex: R$ 100,00)
5. Escolha os tipos de notificação
6. Clique em "Salvar"

### Visualizar Saldo das Contas

A página `/admin/balance` mostra:
- 💰 Saldo total de todas as contas
- 📊 Gasto diário médio
- 🚨 Número de contas críticas
- ⏰ Projeção de dias restantes

### Entender os Status

- 🟢 **Saudável**: Saldo > 40% do limite
- 🟡 **Atenção**: Saldo entre 20-40% do limite
- 🔴 **Crítico**: Saldo < 20% ou zerado

## 🔔 Tipos de Alertas

### Alerta de Saldo Baixo
- Dispara quando o saldo fica abaixo do valor configurado
- Frequência: 1x a cada 24 horas
- Exemplo: "Saldo abaixo de R$ 100,00"

### Alerta de Saldo Zerado (Automático)
- Dispara quando o saldo chega a zero
- Frequência: 1x a cada 2 horas
- Sempre ativo (não pode ser desativado)

## 📧 Configurar Notificações

### Email
✅ Estrutura pronta
🚧 Implementação do envio em desenvolvimento

### Push Notification
✅ Estrutura pronta
🚧 Implementação do envio em desenvolvimento

### WhatsApp (Evolution API)

1. Configure a Evolution API:
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

2. Adicione destinatários:
```sql
INSERT INTO alert_recipients (
  client_id,
  name,
  phone_number,
  receive_whatsapp,
  alert_types
) VALUES (
  'seu_client_id',
  'Nome do Destinatário',
  '5511999999999',
  true,
  ARRAY['low_balance', 'no_balance']
);
```

## ⚙️ Configurar Verificação Automática

### Vercel (Produção)

1. Adicione ao `vercel.json`:
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

2. Configure a variável de ambiente:
```
CRON_SECRET=sua_chave_secreta_aleatoria
```

### Teste Manual

```bash
curl -X POST http://localhost:3000/api/cron/check-balance-alerts \
  -H "Authorization: Bearer SEU_CRON_SECRET"
```

## 📊 APIs Disponíveis

### Buscar Saldo das Contas
```
GET /api/admin/balance/accounts
```

### Listar Alertas
```
GET /api/admin/balance/alerts
```

### Criar Alerta
```
POST /api/admin/balance/alerts
Content-Type: application/json

{
  "account_id": "act_123456789",
  "client_id": "uuid-do-cliente",
  "threshold_amount": 100.00,
  "notification_email": true,
  "notification_push": true,
  "notification_whatsapp": false
}
```

### Atualizar Alerta
```
PATCH /api/admin/balance/alerts/{alertId}
Content-Type: application/json

{
  "is_active": true,
  "threshold_amount": 150.00
}
```

### Histórico de Alertas
```
GET /api/admin/balance/history?days=30
```

## 🐛 Solução de Problemas

### Alertas não aparecem na interface
```bash
# Verificar se as tabelas existem
node scripts/testar-alertas-saldo.js
```

### Saldos não atualizam
1. Verificar se há conexões Meta ativas
2. Verificar tokens de acesso
3. Verificar logs da API

### Notificações não chegam
1. Verificar configuração do WhatsApp
2. Verificar destinatários cadastrados
3. Verificar histórico de envios

## 📝 Exemplos de Uso

### Criar Alerta Programaticamente

```javascript
const response = await fetch('/api/admin/balance/alerts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    account_id: 'act_123456789',
    client_id: 'uuid-do-cliente',
    threshold_amount: 100.00,
    notification_email: true,
    notification_push: true
  })
})
```

### Verificar Status de uma Conta

```javascript
const response = await fetch('/api/admin/balance/accounts')
const data = await response.json()

const account = data.balances.find(b => b.account_id === 'act_123456789')
console.log(`Status: ${account.status}`)
console.log(`Saldo: R$ ${account.balance}`)
console.log(`Dias restantes: ${account.projected_days_remaining}`)
```

## 🎯 Casos de Uso

### 1. Agência com Múltiplos Clientes
- Configure alertas individuais para cada cliente
- Defina limites diferentes baseados no budget
- Receba notificações centralizadas

### 2. Monitoramento Proativo
- Configure alertas com 40% do limite
- Tenha tempo para adicionar créditos
- Evite interrupções nas campanhas

### 3. Gestão de Crise
- Alertas críticos a cada 2 horas
- Notificações via WhatsApp
- Ação imediata quando saldo zerar

## ✅ Checklist de Configuração

- [ ] Schema aplicado no Supabase
- [ ] Conexões Meta Ads ativas
- [ ] Alertas configurados para contas principais
- [ ] Destinatários cadastrados
- [ ] WhatsApp configurado (opcional)
- [ ] Cron Job configurado no Vercel
- [ ] Teste de notificação realizado

## 🚀 Próximos Passos

1. **Imediato**: Configure alertas para suas contas principais
2. **Curto Prazo**: Configure WhatsApp para notificações
3. **Médio Prazo**: Analise histórico e ajuste limites
4. **Longo Prazo**: Implemente previsões com ML

## 📞 Suporte

- Documentação completa: `SISTEMA_ALERTAS_SALDO_IMPLEMENTADO.md`
- Teste do sistema: `node scripts/testar-alertas-saldo.js`
- Logs do Supabase: Dashboard > Logs
- Logs do Vercel: Dashboard > Functions

---

**Dica**: Comece com limites conservadores (40-50% do budget) e ajuste conforme necessário baseado no histórico de gastos.
