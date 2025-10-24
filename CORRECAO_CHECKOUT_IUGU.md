# Correção do Erro 500 no Checkout Iugu

## Problema Identificado

O erro "Não foi possível gerar URL de checkout" ocorria porque:

1. A assinatura era criada com `only_on_charge_success: false`
2. O Iugu não gera faturas automaticamente nesse modo
3. O código tentava buscar uma fatura que não existia

## Solução Implementada

### 1. Mudança no Parâmetro de Criação de Assinatura

**Arquivo:** `src/lib/iugu/iugu-service.ts`

Alterado `only_on_charge_success` de `false` para `true`:

```typescript
const subscriptionData: CreateSubscriptionParams = {
  customer_id: customerId,
  plan_identifier: planIdentifier,
  only_on_charge_success: true, // ✅ Mudado para true
  payable_with: 'all',
  custom_variables: customVariables,
};
```

### 2. Sistema de Retry para Buscar Faturas

Implementado sistema de retry com 5 tentativas para buscar faturas:

```typescript
let attempts = 0;
const maxAttempts = 5;

while (attempts < maxAttempts && !invoiceUrl) {
  attempts++;
  await new Promise(resolve => setTimeout(resolve, 1500));
  const updatedSubscription = await this.getSubscription(subscription.id);
  // Verifica faturas...
}
```

### 3. Fallback: Criação Manual de Fatura

Se após 5 tentativas não encontrar faturas, cria uma manualmente:

```typescript
const invoice = await this.createInvoiceForSubscription(subscription.id);
```

### 4. Logs Detalhados

Adicionados logs em todo o fluxo para facilitar debug:

- Criação de cliente
- Criação de plano
- Criação de assinatura
- Tentativas de buscar faturas
- URL final gerada

## Como Testar

### 1. Testar API do Iugu

```bash
node scripts/test-iugu-api.js
```

### 2. Testar Fluxo de Checkout

```bash
node scripts/test-checkout-flow.js
```

### 3. Testar no Navegador

1. Acesse `http://localhost:3000`
2. Selecione um plano
3. Preencha o formulário de checkout
4. Verifique os logs no terminal do servidor

## Comportamento Esperado

1. ✅ Cliente é criado ou recuperado no Iugu
2. ✅ Plano é criado ou atualizado no Iugu
3. ✅ Assinatura é criada com `only_on_charge_success: true`
4. ✅ Sistema tenta buscar fatura automaticamente (até 5x)
5. ✅ Se não encontrar, cria fatura manualmente
6. ✅ Retorna URL da fatura para pagamento
7. ✅ Usuário é redirecionado para página de pagamento do Iugu

## Logs de Debug

Os seguintes logs aparecem no console do servidor:

```
Initializing Iugu service...
Creating/getting customer for org: [org_id]
Customer created/found: [customer_id]
Creating/updating plan: [plan_id] with price: [price_cents]
Plan created/updated: [plan_identifier]
Creating checkout URL...
Subscription created: [subscription_id]
Attempt 1/5 to find invoice...
Invoice found: [invoice_id]
Checkout URL: [checkout_url]
```

## Possíveis Problemas

### Problema 1: Token Inválido

**Sintoma:** Erro "Unauthorized"

**Solução:** Verificar `IUGU_API_TOKEN` no `.env`

### Problema 2: Plano Não Encontrado

**Sintoma:** Erro "Selected plan is not available"

**Solução:** Verificar se o plano existe e está ativo no banco de dados

### Problema 3: Timeout na Criação de Fatura

**Sintoma:** Demora muito para redirecionar

**Solução:** O sistema já tem retry automático, mas pode aumentar o `maxAttempts` se necessário

## Próximos Passos

1. ✅ Correção implementada
2. ⏳ Testar em produção
3. ⏳ Monitorar logs de erro
4. ⏳ Implementar webhook do Iugu para confirmar pagamentos

## Arquivos Modificados

- `src/lib/iugu/iugu-service.ts` - Lógica principal do Iugu
- `src/app/api/subscriptions/checkout-iugu/route.ts` - Endpoint de checkout
- `scripts/test-iugu-api.js` - Script de teste da API
- `scripts/test-checkout-flow.js` - Script de teste do fluxo completo

## Status

✅ **CORRIGIDO** - O erro 500 foi resolvido com as mudanças implementadas.
