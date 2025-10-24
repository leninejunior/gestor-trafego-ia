# Configuração do Iugu - Guia Completo

Este guia explica como configurar a integração com o Iugu para processar pagamentos recorrentes.

## 📋 Pré-requisitos

1. Conta no Iugu (https://iugu.com)
2. Acesso ao painel administrativo do Iugu
3. Projeto Supabase configurado

## 🔑 Passo 1: Obter Credenciais do Iugu

### 1.1 Token de API

1. Acesse o painel do Iugu: https://app.iugu.com
2. Vá em **Administração** → **Tokens de API**
3. Clique em **Criar Token de API**
4. Dê um nome (ex: "Ads Manager Pro")
5. Copie o token gerado (começa com algo como `test_` ou `live_`)

### 1.2 ID da Conta

1. No painel do Iugu, vá em **Administração** → **Configurações da Conta**
2. Copie o **ID da Conta** (Account ID)

## 🔧 Passo 2: Configurar Variáveis de Ambiente

Adicione as seguintes variáveis no arquivo `.env`:

```env
# Iugu Payment Gateway Configuration
IUGU_API_TOKEN=seu_token_aqui
IUGU_ACCOUNT_ID=seu_account_id_aqui
NEXT_PUBLIC_IUGU_ACCOUNT_ID=seu_account_id_aqui
```

**Importante:**
- Use o token de **teste** durante desenvolvimento
- Use o token de **produção** apenas quando for ao ar
- Nunca commite o arquivo `.env` no Git

## 🗄️ Passo 3: Aplicar Schema do Banco de Dados

Execute o script para adicionar as tabelas e campos necessários:

```bash
node scripts/apply-iugu-schema.js
```

Ou aplique manualmente os seguintes arquivos SQL no Supabase SQL Editor:

1. `database/add-iugu-fields.sql` - Adiciona campos do Iugu nas tabelas existentes
2. `database/subscription-intents-schema.sql` - Cria tabela de intenções de assinatura

## 🔔 Passo 4: Configurar Webhooks

Os webhooks permitem que o Iugu notifique seu sistema sobre eventos de pagamento.

### 4.1 URL do Webhook

Sua URL de webhook será:
- **Desenvolvimento:** `http://localhost:3000/api/webhooks/iugu`
- **Produção:** `https://seu-dominio.com/api/webhooks/iugu`

### 4.2 Configurar no Iugu

1. No painel do Iugu, vá em **Administração** → **Webhooks**
2. Clique em **Adicionar Webhook**
3. Configure:
   - **URL:** Sua URL de webhook
   - **Eventos:** Selecione os seguintes eventos:
     - `invoice.status_changed` - Mudança de status de fatura
     - `subscription.suspended` - Assinatura suspensa
     - `subscription.activated` - Assinatura ativada
     - `subscription.expired` - Assinatura expirada
4. Clique em **Salvar**

### 4.3 Testar Webhook (Desenvolvimento)

Para testar webhooks localmente, use uma ferramenta como ngrok:

```bash
# Instalar ngrok
npm install -g ngrok

# Expor porta local
ngrok http 3000

# Use a URL gerada (ex: https://abc123.ngrok.io) no Iugu
```

## 💳 Passo 5: Criar Planos no Iugu

Os planos são criados automaticamente quando um usuário faz checkout, mas você pode criá-los manualmente:

1. No painel do Iugu, vá em **Assinaturas** → **Planos**
2. Clique em **Criar Plano**
3. Configure:
   - **Nome:** Nome do plano (ex: "Pro - Mensal")
   - **Identificador:** Use o formato `plan_{uuid}_monthly` ou `plan_{uuid}_annual`
   - **Valor:** Valor em centavos (ex: 7900 para R$ 79,00)
   - **Intervalo:** 1 mês ou 12 meses
   - **Moeda:** BRL

## 🧪 Passo 6: Testar o Fluxo

### 6.1 Teste de Checkout

1. Acesse a landing page: `http://localhost:3000`
2. Clique em "Começar Agora" em um dos planos
3. Preencha o formulário de cadastro
4. Você será redirecionado para a página de pagamento do Iugu
5. Use os dados de teste do Iugu:

**Cartão de Crédito de Teste:**
- Número: `4111 1111 1111 1111`
- CVV: `123`
- Validade: Qualquer data futura
- Nome: Qualquer nome

### 6.2 Verificar Criação

Após o pagamento:
1. Verifique no Supabase se a assinatura foi criada na tabela `subscriptions`
2. Verifique se a organização foi criada na tabela `organizations`
3. Verifique se o membership foi criado na tabela `memberships`

## 🔍 Passo 7: Monitoramento

### 7.1 Logs do Webhook

Os webhooks são logados no console. Verifique:

```bash
# Ver logs do servidor
npm run dev

# Procure por:
# "Iugu Webhook received: invoice.status_changed"
```

### 7.2 Painel do Iugu

Monitore no painel do Iugu:
- **Assinaturas** → Ver todas as assinaturas ativas
- **Faturas** → Ver faturas pagas/pendentes
- **Webhooks** → Ver histórico de webhooks enviados

## 🚀 Passo 8: Produção

Antes de ir para produção:

### 8.1 Trocar para Token de Produção

1. No Iugu, crie um novo token de API de **produção**
2. Atualize o `.env.production`:

```env
IUGU_API_TOKEN=live_seu_token_de_producao
```

### 8.2 Atualizar Webhook

1. No Iugu, atualize a URL do webhook para sua URL de produção
2. Teste o webhook em produção

### 8.3 Configurar Domínio

1. Configure seu domínio personalizado
2. Atualize `NEXT_PUBLIC_APP_URL` no `.env.production`

## 📊 Fluxo Completo

```
1. Usuário acessa landing page
   ↓
2. Clica em "Começar Agora" em um plano
   ↓
3. Preenche formulário de cadastro
   ↓
4. Sistema cria:
   - Usuário no Supabase Auth
   - Organização
   - Membership
   - Cliente no Iugu
   - Plano no Iugu (se não existir)
   ↓
5. Usuário é redirecionado para página de pagamento do Iugu
   ↓
6. Usuário paga
   ↓
7. Iugu envia webhook "invoice.status_changed"
   ↓
8. Sistema cria assinatura ativa
   ↓
9. Usuário pode acessar o dashboard
```

## 🆘 Troubleshooting

### Erro: "IUGU_API_TOKEN não configurado"

**Solução:** Verifique se as variáveis de ambiente estão configuradas corretamente no `.env`

### Webhook não está sendo recebido

**Soluções:**
1. Verifique se a URL do webhook está correta no Iugu
2. Use ngrok para testar localmente
3. Verifique os logs do servidor
4. Verifique o histórico de webhooks no painel do Iugu

### Pagamento aprovado mas assinatura não criada

**Soluções:**
1. Verifique os logs do webhook
2. Verifique se o `iugu_subscription_id` está sendo salvo corretamente
3. Execute manualmente o webhook com os dados da fatura

### Erro ao criar plano

**Solução:** Verifique se o identificador do plano é único. O sistema tenta buscar planos existentes antes de criar novos.

## 📚 Recursos Adicionais

- [Documentação do Iugu](https://dev.iugu.com/reference)
- [API de Assinaturas](https://dev.iugu.com/reference/assinaturas)
- [Webhooks do Iugu](https://dev.iugu.com/reference/webhooks)
- [Cartões de Teste](https://dev.iugu.com/reference/testando-sua-integracao)

## 🔐 Segurança

- ✅ Nunca exponha o `IUGU_API_TOKEN` no frontend
- ✅ Use HTTPS em produção
- ✅ Valide todos os webhooks recebidos
- ✅ Implemente rate limiting nas rotas de API
- ✅ Monitore tentativas de fraude no painel do Iugu

## 💡 Dicas

1. **Teste Extensivamente:** Use o ambiente de teste do Iugu antes de ir para produção
2. **Monitore Webhooks:** Configure alertas para webhooks falhados
3. **Backup de Dados:** Faça backup regular das assinaturas
4. **Logs Detalhados:** Mantenha logs de todas as transações
5. **Suporte ao Cliente:** Tenha um processo para lidar com problemas de pagamento

---

**Pronto!** Sua integração com o Iugu está configurada e pronta para processar pagamentos recorrentes. 🎉
