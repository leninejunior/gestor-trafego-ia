# 🚀 Deploy Vercel - Sistema com Iugu

## ✅ Pré-requisitos

1. Conta no Vercel conectada ao GitHub
2. Credenciais do Iugu (API Token e Account ID)
3. Supabase configurado

## 📦 Passo 1: Commit e Push

```bash
# Adicionar arquivos do Iugu
git add src/lib/iugu/
git add src/app/api/webhooks/iugu/
git add src/app/api/subscriptions/checkout-iugu/
git add src/app/checkout/
git add database/subscription-intents-schema.sql
git add database/add-iugu-fields.sql

# Adicionar configurações
git add .env.example
git add package.json
git add package-lock.json

# Commit
git commit -m "feat: integração com Iugu para pagamentos recorrentes"

# Push
git push origin main
```

## 🌐 Passo 2: Deploy no Vercel

### Via Dashboard:
1. Acesse https://vercel.com
2. Clique em "Import Project"
3. Selecione seu repositório
4. Configure as variáveis de ambiente

### Via CLI:
```bash
npm install -g vercel
vercel login
vercel --prod
```

## 🔐 Passo 3: Variáveis de Ambiente no Vercel

Configure estas variáveis no dashboard do Vercel:

### Supabase
```
NEXT_PUBLIC_SUPABASE_URL=sua_url_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anon
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
```

### Iugu
```
IUGU_API_TOKEN=seu_token_iugu
IUGU_ACCOUNT_ID=seu_account_id
NEXT_PUBLIC_APP_URL=https://seu-app.vercel.app
```

### Meta Ads (se usar)
```
META_APP_ID=seu_app_id
META_APP_SECRET=seu_app_secret
```

## 🔗 Passo 4: Configurar Webhook no Iugu

Após o deploy, configure o webhook no painel do Iugu:

1. Acesse: https://app.iugu.com/webhooks
2. Clique em "Adicionar Webhook"
3. URL: `https://seu-app.vercel.app/api/webhooks/iugu`
4. Eventos:
   - ✅ invoice.status_changed
   - ✅ invoice.created
   - ✅ invoice.refund
   - ✅ subscription.suspended
   - ✅ subscription.activated
   - ✅ subscription.expired

## 🗄️ Passo 5: Aplicar Schema no Supabase

Execute no SQL Editor do Supabase:

```sql
-- 1. Criar tabela subscription_intents
-- Execute: database/subscription-intents-schema.sql

-- 2. Adicionar campos Iugu
-- Execute: database/add-iugu-fields.sql

-- 3. Atualizar intents existentes
-- Execute: database/update-subscription-intents.sql
```

## ✅ Passo 6: Testar

### 1. Teste o webhook:
```bash
curl -X POST https://seu-app.vercel.app/api/webhooks/iugu \
  -H "Content-Type: application/json" \
  -d '{
    "event": "invoice.status_changed",
    "data": {
      "id": "test-123",
      "status": "paid"
    }
  }'
```

### 2. Teste o checkout:
- Acesse: `https://seu-app.vercel.app/checkout?plan=plano_id`
- Complete o fluxo de pagamento
- Verifique se o webhook foi recebido

## 🔍 Monitoramento

### Logs do Vercel:
```bash
vercel logs --follow
```

### Verificar webhooks no Iugu:
- Painel Iugu > Webhooks > Ver Logs

## 🐛 Troubleshooting

### Webhook não recebe notificações:
1. Verifique se a URL está correta no Iugu
2. Confirme que os eventos estão selecionados
3. Veja os logs no painel do Iugu

### Erro 500 no webhook:
1. Verifique as variáveis de ambiente
2. Confirme que o schema foi aplicado
3. Veja os logs: `vercel logs`

### Checkout não funciona:
1. Verifique `IUGU_API_TOKEN` e `IUGU_ACCOUNT_ID`
2. Confirme que `NEXT_PUBLIC_APP_URL` está correto
3. Teste a API do Iugu: `scripts/test-iugu-api.js`

## 📝 Checklist Final

- [ ] Código commitado e pushed
- [ ] Deploy realizado no Vercel
- [ ] Variáveis de ambiente configuradas
- [ ] Webhook configurado no Iugu
- [ ] Schema aplicado no Supabase
- [ ] Teste de checkout realizado
- [ ] Webhook testado e funcionando

## 🎉 Pronto!

Seu sistema está no ar com pagamentos Iugu funcionando!

URL do webhook: `https://seu-app.vercel.app/api/webhooks/iugu`
