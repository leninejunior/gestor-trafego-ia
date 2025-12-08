# Configuração do Stripe Checkout

## 📋 Conta Stripe Configurada

**Conta:** Gestor de Tráfego (`acct_1KyxUHKABoiEfF8T`)

### Produtos e Preços Criados

| Plano | Product ID | Price Mensal | Price Anual |
|-------|------------|--------------|-------------|
| Basic ($29/$290) | `prod_TYDh2m12mOwZUt` | `price_1Sb7G6KABoiEfF8TsDoZn2oT` | `price_1Sb7GBKABoiEfF8TkGCL54R6` |
| Pro ($79/$790) | `prod_TYDhPcLUZKOszA` | `price_1Sb7GRKABoiEfF8TG4SIYQDz` | `price_1Sb7HWKABoiEfF8TQRr8hjf7` |
| Enterprise ($199/$1990) | `prod_TYDhoLQ2nln2ZW` | `price_1Sb7HbKABoiEfF8TQdtDpxs3` | `price_1Sb7HeKABoiEfF8TUSnKBsGA` |

## 🔑 Variáveis de Ambiente Necessárias

Adicione as seguintes variáveis ao seu arquivo `.env`:

```env
# Stripe Configuration
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

### Como obter as chaves:

1. **Publishable Key e Secret Key:**
   - Acesse: https://dashboard.stripe.com/apikeys
   - Copie a "Publishable key" (pk_live_...)
   - Copie a "Secret key" (sk_live_...)

2. **Webhook Secret:**
   - Acesse: https://dashboard.stripe.com/test/webhooks
   - Clique em "Add endpoint"
   - URL: `https://seu-dominio.com/api/webhooks/stripe`
   - Selecione os eventos:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
   - Copie o "Signing secret" (whsec_...)

## 🗄️ Migração do Banco de Dados

Execute a migração para adicionar os campos do Stripe:

```sql
-- Execute no Supabase SQL Editor:
-- database/migrations/06-add-stripe-fields-to-subscription-intents.sql

ALTER TABLE subscription_intents 
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_session_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

CREATE INDEX IF NOT EXISTS idx_subscription_intents_stripe_customer_id 
ON subscription_intents(stripe_customer_id) 
WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscription_intents_stripe_session_id 
ON subscription_intents(stripe_session_id) 
WHERE stripe_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscription_intents_stripe_subscription_id 
ON subscription_intents(stripe_subscription_id) 
WHERE stripe_subscription_id IS NOT NULL;
```

## 🧪 Testando o Checkout

### Cartões de Teste

Use estes cartões para testar:

| Cenário | Número do Cartão | CVC | Data |
|---------|------------------|-----|------|
| Sucesso | 4242 4242 4242 4242 | Qualquer 3 dígitos | Qualquer data futura |
| Recusado | 4000 0000 0000 0002 | Qualquer 3 dígitos | Qualquer data futura |
| Requer autenticação | 4000 0025 0000 3155 | Qualquer 3 dígitos | Qualquer data futura |

### Fluxo de Teste

1. Acesse `/checkout?plan=<plan_id>`
2. Preencha os dados do formulário
3. Clique em "Continuar para Pagamento"
4. Você será redirecionado para o Stripe Checkout
5. Use um cartão de teste
6. Após o pagamento, você será redirecionado para `/checkout/status/<intent_id>`

## 🔄 Webhook Local (Desenvolvimento)

Para testar webhooks localmente, use o Stripe CLI:

```bash
# Instalar Stripe CLI
# Windows (Scoop)
scoop install stripe

# Fazer login
stripe login

# Encaminhar webhooks para localhost
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

O CLI mostrará um webhook secret temporário para usar em desenvolvimento.

## 📁 Arquivos Criados/Modificados

- `src/app/api/subscriptions/checkout-stripe/route.ts` - Nova rota de checkout
- `src/app/api/webhooks/stripe/route.ts` - Webhook atualizado
- `src/lib/types/subscription-intent.ts` - Tipos atualizados
- `src/lib/services/subscription-intent-service.ts` - Serviço atualizado
- `src/app/checkout/page.tsx` - Página de checkout atualizada
- `database/migrations/06-add-stripe-fields-to-subscription-intents.sql` - Migração

## ⚠️ Importante

- Em produção, use as chaves `pk_live_` e `sk_live_`
- Nunca exponha a `STRIPE_SECRET_KEY` no frontend
- Configure o webhook em produção com a URL correta
- Teste todos os cenários antes de ir para produção

## 🐛 Troubleshooting

### Erro: "Stripe não configurado"
- Verifique se `STRIPE_SECRET_KEY` está definida no `.env`

### Erro: "Invalid signature" no webhook
- Verifique se `STRIPE_WEBHOOK_SECRET` está correta
- Em desenvolvimento, use o secret do Stripe CLI

### Checkout não redireciona
- Verifique se `NEXT_PUBLIC_APP_URL` está configurada corretamente
- Verifique os logs do console para erros

---

**Data:** 2025-12-05
**Versão:** 1.0
