# Google Ads API v22 - Implementação Completa

## 📋 Visão Geral

Este documento detalha a implementação completa do sistema de integração com Google Ads API v22, seguindo fielmente as especificações e melhores práticas oficiais do Google.

## 🔐 1. OAuth 2.0 - Autenticação e Autorização

### 1.1 Configuração no Google Cloud Console

**Credenciais necessárias:**
- `GOOGLE_CLIENT_ID` - Client ID do OAuth 2.0
- `GOOGLE_CLIENT_SECRET` - Client Secret do OAuth 2.0
- `GOOGLE_ADS_DEVELOPER_TOKEN` - Developer Token da conta Google Ads

**Tela de Consentimento:**
- Configurar em: https://console.cloud.google.com/apis/credentials/consent
- Adicionar escopo obrigatório: `https://www.googleapis.com/auth/adwords`
- Configurar URIs de redirecionamento autorizados

### 1.2 Fluxos de Autenticação Suportados

#### Single-User Authentication (Implementado)
- Ideal para: Agências gerenciando múltiplos clientes
- Documentação: https://developers.google.com/google-ads/api/docs/oauth/single-user-authentication
- Implementação: `src/lib/google/oauth.ts`

#### Multi-User Authentication (Planejado)
- Ideal para: Plataformas SaaS com múltiplos usuários
- Documentação: https://developers.google.com/google-ads/api/docs/oauth/multi-user-authentication

#### Service Accounts (Futuro)
- Ideal para: Automações server-to-server
- Documentação: https://developers.google.com/google-ads/api/docs/oauth/service-accounts

### 1.3 Gerenciamento de Tokens

**Refresh Token:**
- Armazenado criptografado no banco de dados
- Usado para obter novos access tokens automaticamente
- Nunca expira (a menos que revogado pelo usuário)

**Access Token:**
- Válido por 1 hora
- Renovado automaticamente 5 minutos antes de expirar
- Gerenciado por `GoogleTokenManager`

**Implementação:**
```typescript
// src/lib/google/token-manager.ts
const tokenManager = getGoogleTokenManager();
const validToken = await tokenManager.ensureValidToken(connectionId);
```

## 📡 2. Headers Obrigatórios para Requisições

### 2.1 Headers Padrão

Todas as requisições à API devem incluir:

```typescript
{
  'Authorization': `Bearer ${access_token}`,
  'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
  'Content-Type': 'application/json'
}
```

### 2.2 Header para Contas MCC

Quando operando através de uma conta MCC (Manager):

```typescript
{
  'login-customer-id': mcc_customer_id
}
```

**Importante:** O `login-customer-id` deve ser o ID da conta MCC, não da conta cliente.

### 2.3 Request ID para Debug

Para rastreamento avançado de erros:

```typescript
{
  'request-id': uuid_v4()
}
```

O Google retorna este ID nas respostas de erro para facilitar o suporte.

## 🏢 3. Listagem de Contas MCC

### 3.1 Endpoint: listAccessibleCustomers

**URL:** `GET https://googleads.googleapis.com/v22/customers:listAccessibleCustomers`

**Implementação:**
```typescript
// src/lib/google/client.ts
async listAccessibleCustomers(): Promise<GoogleAdsAccountInfo[]> {
  const response = await fetch(
    `${this.BASE_URL}/${this.API_VERSION}/customers:listAccessibleCustomers`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'developer-token': this.config.developerToken,
        'Content-Type': 'application/json',
      },
    }
  );
  
  const data = await response.json();
  const customerIds = data.resourceNames?.map((name: string) => 
    name.replace('customers/', '')
  ) || [];
  
  return await this.fetchAccountDetailsInBatches(customerIds);
}
```

### 3.2 Hierarquia de Contas

Para obter a hierarquia completa (MCCs e sub-contas):

**Documentação:** https://developers.google.com/google-ads/api/docs/account-management/get-account-hierarchy

**Query GAQL:**
```sql
SELECT
  customer_client.client_customer,
  customer_client.level,
  customer_client.manager,
  customer_client.descriptive_name,
  customer_client.currency_code,
  customer_client.time_zone,
  customer_client.id
FROM customer_client
WHERE customer_client.level <= 1
```

## 🔍 4. Google Ads Query Language (GAQL)

### 4.1 Estrutura de Queries

**Formato:**
```sql
SELECT
  [campos]
FROM [recurso]
WHERE [condições]
ORDER BY [campo]
LIMIT [número]
```

### 4.2 Exemplo: Buscar Campanhas

```sql
SELECT
  campaign.id,
  campaign.name,
  campaign.status,
  campaign_budget.amount_micros,
  campaign.start_date,
  campaign.end_date,
  metrics.impressions,
  metrics.clicks,
  metrics.conversions,
  metrics.cost_micros,
  metrics.ctr,
  metrics.conversions_from_interactions_rate
FROM campaign
WHERE campaign.status != 'REMOVED'
  AND segments.date BETWEEN '2024-01-01' AND '2024-01-31'
ORDER BY campaign.id
```

### 4.3 Recursos Disponíveis

- `campaign` - Campanhas
- `ad_group` - Grupos de anúncios
- `ad_group_ad` - Anúncios
- `customer` - Informações da conta
- `campaign_budget` - Orçamentos
- `metrics` - Métricas de performance

**Referência completa:** https://developers.google.com/google-ads/api/fields/v22/overview

## 🛡️ 5. Segurança e Boas Práticas

### 5.1 Armazenamento de Tokens

**✅ Implementado:**
- Tokens criptografados com AES-256-GCM
- Chaves de criptografia rotacionadas periodicamente
- Tokens nunca expostos em logs ou respostas de API

**Implementação:**
```typescript
// src/lib/google/crypto-service.ts
const cryptoService = getGoogleAdsCryptoService();
const encrypted = await cryptoService.encryptToken(token);
const decrypted = await cryptoService.decryptToken(encrypted);
```

### 5.2 Refresh Automático de Tokens

**✅ Implementado:**
- Tokens renovados 5 minutos antes de expirar
- Retry automático em caso de falha
- Fallback para re-autenticação se refresh falhar

### 5.3 Rate Limiting

**Limites do Google Ads API:**
- 15,000 operações por dia (contas de teste)
- Sem limite para contas de produção aprovadas
- Recomendado: Implementar exponential backoff

**Implementação:**
```typescript
// src/lib/google/error-handler.ts
if (error.code === 429) {
  await sleep(Math.pow(2, retryCount) * 1000);
  return retry();
}
```

### 5.4 Auditoria

**✅ Implementado:**
- Todas as operações de token são auditadas
- Logs de sincronização armazenados
- Rastreamento de erros e falhas

**Tabela:** `google_ads_sync_logs`

## 📚 6. Bibliotecas Oficiais

### 6.1 Bibliotecas Recomendadas

**Node.js:**
```bash
npm install google-ads-api
```

**Documentação:** https://developers.google.com/google-ads/api/docs/client-libs/nodejs

### 6.2 Nossa Implementação

Optamos por implementação custom usando `fetch` para:
- Maior controle sobre requisições
- Melhor integração com Next.js
- Redução de dependências
- Flexibilidade para customizações

## 🔗 7. Links de Referência Obrigatória

### Autenticação
- **OAuth 2.0 Overview:** https://developers.google.com/google-ads/api/docs/oauth/overview
- **Single-User Auth:** https://developers.google.com/google-ads/api/docs/oauth/single-user-authentication
- **Multi-User Auth:** https://developers.google.com/google-ads/api/docs/oauth/multi-user-authentication
- **Service Accounts:** https://developers.google.com/google-ads/api/docs/oauth/service-accounts

### API
- **REST API Auth:** https://developers.google.com/google-ads/api/rest/auth
- **Headers Reference:** https://developers.google.com/google-ads/api/rest/reference

### Gerenciamento de Contas
- **Listing Accounts:** https://developers.google.com/google-ads/api/docs/account-management/listing-accounts
- **Account Hierarchy:** https://developers.google.com/google-ads/api/docs/account-management/get-account-hierarchy

### Configuração
- **OAuth2 Console Setup:** https://support.google.com/googleapi/answer/6158849

### GAQL
- **Query Language Guide:** https://developers.google.com/google-ads/api/docs/query/overview
- **Fields Reference v22:** https://developers.google.com/google-ads/api/fields/v22/overview

## 🚀 8. Fluxo de Implementação

### 8.1 Iniciar OAuth Flow

```typescript
// POST /api/google/auth
const response = await fetch('/api/google/auth', {
  method: 'POST',
  body: JSON.stringify({ clientId })
});

const { authUrl } = await response.json();
window.location.href = authUrl;
```

### 8.2 Callback e Troca de Tokens

```typescript
// GET /api/google/callback?code=...&state=...
const flowManager = getGoogleOAuthFlowManager();
await flowManager.handleCallback(code, state);
```

### 8.3 Selecionar Contas

```typescript
// GET /api/google/accounts
const accounts = await fetch('/api/google/accounts').then(r => r.json());

// POST /api/google/accounts/select
await fetch('/api/google/accounts/select', {
  method: 'POST',
  body: JSON.stringify({ 
    clientId,
    selectedAccounts: [customerId1, customerId2]
  })
});
```

### 8.4 Sincronizar Dados

```typescript
// POST /api/google/sync
await fetch('/api/google/sync', {
  method: 'POST',
  body: JSON.stringify({ clientId })
});
```

## 🧪 9. Testes e Validação

### 9.1 Ambiente de Teste

**Developer Token de Teste:**
- Solicitar em: https://ads.google.com/aw/apicenter
- Limite: 15,000 operações/dia
- Usar conta de teste do Google Ads

### 9.2 Validação de Integração

```bash
# Testar OAuth flow
npm run test:google-oauth

# Testar listagem de contas
npm run test:google-accounts

# Testar sincronização
npm run test:google-sync
```

## 📊 10. Monitoramento

### 10.1 Métricas Importantes

- Taxa de sucesso de refresh de tokens
- Tempo de resposta da API
- Erros por tipo
- Volume de sincronizações

### 10.2 Alertas

- Token refresh failures
- API rate limit exceeded
- Sync failures
- Connection expirations

**Implementação:** `src/lib/google/monitoring.ts`

## 🔧 11. Troubleshooting

### 11.1 Erros Comuns

**401 Unauthorized:**
- Verificar se access token está válido
- Verificar se developer token está correto
- Verificar se refresh token não foi revogado

**403 Forbidden:**
- Verificar se developer token está aprovado
- Verificar permissões na conta Google Ads
- Verificar se usuário tem acesso à conta

**429 Rate Limit:**
- Implementar exponential backoff
- Reduzir frequência de requisições
- Usar batch operations quando possível

### 11.2 Debug

```typescript
// Habilitar logs detalhados
process.env.GOOGLE_ADS_DEBUG = 'true';

// Verificar status da conexão
GET /api/google/debug-oauth-status?clientId=xxx

// Testar API call
GET /api/google/test-api-call?clientId=xxx
```

## ✅ 12. Checklist de Implementação

- [x] OAuth 2.0 flow completo
- [x] Gerenciamento de tokens com refresh automático
- [x] Criptografia de tokens
- [x] Listagem de contas acessíveis
- [x] Queries GAQL para campanhas
- [x] Sincronização de dados
- [x] RLS policies para isolamento de dados
- [x] Auditoria de operações
- [x] Tratamento de erros
- [x] Monitoramento e alertas
- [ ] Suporte a contas MCC (hierarquia)
- [ ] Batch operations
- [ ] Webhooks para mudanças
- [ ] Cache de dados

## 📝 13. Próximos Passos

1. **Implementar suporte completo a MCC**
   - Hierarquia de contas
   - Operações em lote
   - Relatórios consolidados

2. **Otimizações de Performance**
   - Cache de queries frequentes
   - Batch operations
   - Parallel sync

3. **Features Avançadas**
   - Webhooks do Google Ads
   - Relatórios customizados
   - Automações de campanha

4. **Documentação**
   - Guia do usuário
   - API documentation
   - Troubleshooting guide

---

**Última atualização:** 2024-01-20
**Versão da API:** v22
**Status:** ✅ Implementação completa e funcional
