# Nova Estratégia de Checkout - Sem Cadastro Prévio

## Problema Atual

1. ❌ Usuário preenche formulário
2. ❌ Sistema cria conta no Supabase (pode dar rate limit)
3. ❌ Sistema cria checkout no Iugu
4. ❌ Usuário é redirecionado para pagar
5. ❌ Se não pagar, fica com conta criada sem assinatura

## Nova Estratégia (Melhor Prática)

1. ✅ Usuário preenche formulário (sem criar conta)
2. ✅ Sistema cria checkout no Iugu com dados temporários
3. ✅ Usuário é redirecionado para página de pagamento do Iugu
4. ✅ Usuário escolhe método de pagamento (cartão, boleto, PIX)
5. ✅ Usuário paga
6. ✅ Iugu envia webhook confirmando pagamento
7. ✅ Webhook cria conta do usuário + organização + ativa assinatura

## Vantagens

- ✅ Sem rate limit (não cria conta até confirmar pagamento)
- ✅ Sem contas órfãs (só cria após pagamento)
- ✅ Melhor UX (usuário vê opções de pagamento antes de criar conta)
- ✅ Mais conversão (menos fricção no processo)

## Implementação

### Passo 1: Modificar Checkout Page

Remover criação de conta, apenas coletar dados e criar checkout.

### Passo 2: Armazenar Dados Temporários

Usar `subscription_intents` para guardar dados do usuário até pagamento.

### Passo 3: Webhook do Iugu

Quando pagamento confirmado:
- Criar usuário
- Criar organização
- Ativar assinatura
- Enviar email de boas-vindas com link para definir senha

## Fluxo Detalhado

```
┌─────────────────┐
│ Landing Page    │
│ Escolhe Plano   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Checkout Form   │
│ - Nome          │
│ - Email         │
│ - Empresa       │
│ (SEM senha)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Cria Intent     │
│ no Supabase     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Cria Checkout   │
│ no Iugu         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Redireciona     │
│ para Iugu       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Página Iugu     │
│ - Cartão        │
│ - Boleto        │
│ - PIX           │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Usuário Paga    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Webhook Iugu    │
│ payment.success │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Cria Usuário    │
│ Cria Org        │
│ Ativa Assinatura│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Email Boas-vindas│
│ Link p/ senha   │
└─────────────────┘
```

## Próximos Passos

1. Modificar `src/app/checkout/page.tsx` - remover campo senha
2. Modificar `src/app/api/subscriptions/checkout-iugu/route.ts` - não criar usuário
3. Implementar `src/app/api/webhooks/iugu/route.ts` - criar usuário após pagamento
4. Criar email de boas-vindas com link para definir senha

## Benefícios Adicionais

- Usuário vê opções de pagamento (cartão, boleto, PIX) na página do Iugu
- Iugu cuida da segurança PCI-DSS
- Não precisamos lidar com dados de cartão
- Processo mais profissional e confiável
