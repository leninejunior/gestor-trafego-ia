# Google Ads - Correção de Token Refresh

## Problemas Corrigidos

### 1. ✅ Token Expirando - Refresh Automático
**Problema**: Tokens expiravam durante uso, causando erros de autenticação.

**Solução**: Integração com `GoogleTokenManager` que:
- Verifica expiração antes de cada request
- Refresh automático com buffer de 5 minutos
- Tokens criptografados no banco
- Fallback para método manual se necessário

**Código**:
```typescript
// Antes (manual, sem refresh automático)
const token = await this.ensureValidToken();

// Depois (com TokenManager)
if (this.config.connectionId) {
  const validToken = await this.tokenManager.ensureValidToken(this.config.connectionId);
  return validToken;
}
```

### 2. ✅ loginCustomerId - Uso Correto
**Problema**: Confusão sobre quando usar `login-customer-id`.

**Solução**: Documentação clara e implementação correta:
- **Usado**: Em requests para contas específicas (campaigns, metrics, etc)
- **NÃO usado**: Em `listAccessibleCustomers` (retorna TODAS as contas)
- **Opcional**: Para contas standalone
- **Obrigatório**: Para contas MCC (Manager)

**Código**:
```typescript
headers: {
  'Authorization': `Bearer ${token}`,
  'developer-token': this.config.developerToken,
  'Content-Type': 'application/json',
  ...(this.config.loginCustomerId && {
    'login-customer-id': this.config.loginCustomerId, // ✅ Condicional
  }),
}
```

### 3. ❌ listAccessibleCustomers - Mantém GET
**Solicitação**: Mudar para POST.

**Decisão**: **Manter GET** conforme documentação oficial do Google:
- [Documentação Oficial](https://developers.google.com/google-ads/api/rest/reference/rest/v16/customers/listAccessibleCustomers)
- Método: `GET`
- Endpoint: `/v16/customers:listAccessibleCustomers`
- Sem body, sem parâmetros

**Código**:
```typescript
const response = await fetch(
  `${this.BASE_URL}/${this.API_VERSION}/customers:listAccessibleCustomers`,
  {
    method: 'GET', // ✅ Correto segundo Google
    headers: {
      'Authorization': `Bearer ${token}`,
      'developer-token': this.config.developerToken,
      'Content-Type': 'application/json',
    },
  }
);
```

## Arquivos Modificados

### 1. `src/lib/google/client.ts`
- ✅ Importado `getGoogleTokenManager`
- ✅ Adicionado `connectionId` ao config
- ✅ Método `ensureValidToken()` usa TokenManager
- ✅ Comentários explicativos sobre GET vs POST
- ✅ Comentário sobre quando usar `login-customer-id`

### 2. `src/app/api/google/accounts/route.ts`
- ✅ Passa `connectionId` para `getGoogleAdsClient()`
- ✅ Usa `customer_id` correto
- ✅ Usa `login_customer_id` quando disponível

## Como Usar

### Criar Cliente com Refresh Automático
```typescript
const googleAdsClient = getGoogleAdsClient({
  accessToken: connection.access_token,
  refreshToken: connection.refresh_token,
  developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
  customerId: connection.customer_id,
  loginCustomerId: connection.login_customer_id || undefined,
  connectionId: connectionId, // ✅ IMPORTANTE para refresh automático
});

// Agora todos os métodos fazem refresh automático se necessário
const accounts = await googleAdsClient.listAccessibleCustomers();
const campaigns = await googleAdsClient.getCampaigns();
```

### Fluxo de Refresh Automático
```
1. Cliente chama método (ex: listAccessibleCustomers)
   ↓
2. ensureValidToken() verifica expiração
   ↓
3. Se expirado: TokenManager.ensureValidToken(connectionId)
   ↓
4. TokenManager verifica no banco
   ↓
5. Se necessário: Refresh via OAuth
   ↓
6. Salva novo token (criptografado)
   ↓
7. Retorna token válido
   ↓
8. Request é feito com token atualizado
```

## Benefícios

1. **Sem Erros de Token Expirado**: Refresh automático antes de cada request
2. **Segurança**: Tokens criptografados no banco
3. **Auditoria**: Logs de todas operações de token
4. **Fallback**: Se TokenManager falhar, usa método manual
5. **Performance**: Buffer de 5 minutos evita refreshes desnecessários

## Testes

### Testar Refresh Automático
```typescript
// 1. Criar conexão
const connectionId = 'uuid-da-conexao';

// 2. Esperar token expirar (ou forçar expiração no banco)
await supabase
  .from('google_ads_connections')
  .update({ token_expires_at: new Date().toISOString() })
  .eq('id', connectionId);

// 3. Fazer request - deve fazer refresh automático
const client = getGoogleAdsClient({
  accessToken: 'old-token',
  refreshToken: 'refresh-token',
  developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
  connectionId: connectionId,
});

const accounts = await client.listAccessibleCustomers();
// ✅ Deve funcionar sem erro, com token refreshed
```

### Verificar Logs
```sql
-- Ver operações de token
SELECT * FROM google_ads_audit_logs 
WHERE operation_type = 'token_refresh'
ORDER BY created_at DESC
LIMIT 10;

-- Ver status de conexões
SELECT 
  id,
  customer_id,
  status,
  token_expires_at,
  CASE 
    WHEN token_expires_at < NOW() THEN 'EXPIRADO'
    WHEN token_expires_at < NOW() + INTERVAL '5 minutes' THEN 'EXPIRANDO'
    ELSE 'VÁLIDO'
  END as token_status
FROM google_ads_connections
WHERE status = 'active';
```

## Referências

- [Google Ads API - Authentication](https://developers.google.com/google-ads/api/docs/oauth/overview)
- [Google Ads API - listAccessibleCustomers](https://developers.google.com/google-ads/api/rest/reference/rest/v16/customers/listAccessibleCustomers)
- [Google Ads API - Call Structure](https://developers.google.com/google-ads/api/docs/concepts/call-structure)

---

**Data**: Dezembro 2024  
**Versão**: 1.0  
**Status**: ✅ Implementado e Testado
