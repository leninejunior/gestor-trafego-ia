# Google Ads API v22 - Guia de Validação

## ✅ Validação da Configuração Existente

Este guia ajuda a validar que a implementação Google Ads API v22 está corretamente configurada com as variáveis de ambiente já existentes no Supabase.

## 🔍 Passo 1: Verificar Variáveis no Supabase

### 1.1 Acessar Configurações do Projeto

1. Acesse: https://app.supabase.com/
2. Selecione seu projeto
3. Vá em: **Settings** → **API**

### 1.2 Verificar Variáveis Necessárias

As seguintes variáveis devem estar configuradas:

```bash
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
GOOGLE_ADS_DEVELOPER_TOKEN=xxxxxxxxxxxxxxxx
NEXT_PUBLIC_APP_URL=https://seu-dominio.com
```

### 1.3 Verificar no Código

Execute o script de validação:

```bash
npm run validate:google-ads-v22
```

**Resultado esperado:**
```
✓ GOOGLE_CLIENT_ID configurado
✓ GOOGLE_CLIENT_SECRET configurado
✓ GOOGLE_ADS_DEVELOPER_TOKEN configurado
✓ NEXT_PUBLIC_APP_URL configurado

Taxa de conformidade: 100%
```

## 🗄️ Passo 2: Verificar Schema do Banco

### 2.1 Verificar Tabelas Existentes

Execute no SQL Editor do Supabase:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'google_ads%'
ORDER BY table_name;
```

**Resultado esperado:**
- `google_ads_campaigns`
- `google_ads_connections`
- `google_ads_metrics`
- `google_ads_sync_logs`

### 2.2 Verificar Estrutura das Tabelas

```sql
-- Verificar google_ads_connections
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'google_ads_connections'
ORDER BY ordinal_position;
```

**Colunas esperadas:**
- `id` (uuid)
- `client_id` (uuid)
- `customer_id` (text)
- `refresh_token` (text) - criptografado
- `access_token` (text) - criptografado
- `token_expires_at` (timestamptz)
- `status` (text)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### 2.3 Verificar RLS Policies

```sql
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename LIKE 'google_ads%'
ORDER BY tablename, policyname;
```

**Policies esperadas:**
- `authenticated_users_can_access_all` em todas as tabelas

## 🧪 Passo 3: Testar Integração

### 3.1 Testar OAuth Flow

1. Acesse: `http://localhost:3000/dashboard/google`
2. Clique em "Conectar Google Ads"
3. Você deve ser redirecionado para o Google
4. Após autorizar, deve retornar ao dashboard

### 3.2 Verificar Status da Conexão

Execute via API:

```bash
curl http://localhost:3000/api/google/debug-oauth-status?clientId=SEU_CLIENT_ID
```

**Resposta esperada:**
```json
{
  "status": "connected",
  "hasValidToken": true,
  "expiresAt": "2024-01-20T15:30:00Z",
  "customerId": "1234567890"
}
```

### 3.3 Testar Listagem de Contas

```bash
curl http://localhost:3000/api/google/accounts?clientId=SEU_CLIENT_ID
```

**Resposta esperada:**
```json
[
  {
    "customerId": "1234567890",
    "descriptiveName": "Minha Conta",
    "currencyCode": "BRL",
    "timeZone": "America/Sao_Paulo",
    "canManageClients": false
  }
]
```

## 🔐 Passo 4: Validar Segurança

### 4.1 Verificar Criptografia de Tokens

Execute no SQL Editor:

```sql
SELECT 
  id,
  client_id,
  customer_id,
  LENGTH(access_token) as token_length,
  LENGTH(refresh_token) as refresh_token_length,
  status
FROM google_ads_connections
LIMIT 5;
```

**Validação:**
- `token_length` deve ser > 100 (tokens criptografados são longos)
- `refresh_token_length` deve ser > 100
- Tokens NÃO devem ser legíveis

### 4.2 Verificar RLS

Teste se RLS está funcionando:

```sql
-- Como usuário autenticado, deve retornar apenas suas conexões
SELECT COUNT(*) FROM google_ads_connections;

-- Tentar acessar conexão de outro cliente (deve falhar ou retornar vazio)
SELECT * FROM google_ads_connections 
WHERE client_id = 'outro-client-id';
```

## 📊 Passo 5: Validar Funcionalidades

### 5.1 Checklist de Funcionalidades

- [ ] OAuth flow completo funciona
- [ ] Listagem de contas retorna dados
- [ ] Seleção de contas salva no banco
- [ ] Sincronização de campanhas funciona
- [ ] Métricas são coletadas
- [ ] Tokens são renovados automaticamente
- [ ] Desconexão funciona corretamente

### 5.2 Testar Sincronização

```bash
curl -X POST http://localhost:3000/api/google/sync \
  -H "Content-Type: application/json" \
  -d '{"clientId": "SEU_CLIENT_ID"}'
```

**Resposta esperada:**
```json
{
  "success": true,
  "campaignsSynced": 5,
  "metricsUpdated": 150
}
```

### 5.3 Verificar Dados Sincronizados

```sql
-- Verificar campanhas sincronizadas
SELECT 
  c.campaign_name,
  c.status,
  c.budget_amount,
  COUNT(m.id) as metrics_count
FROM google_ads_campaigns c
LEFT JOIN google_ads_metrics m ON m.campaign_id = c.id
WHERE c.client_id = 'SEU_CLIENT_ID'
GROUP BY c.id, c.campaign_name, c.status, c.budget_amount;
```

## 🚨 Troubleshooting

### Erro: "GOOGLE_CLIENT_ID não configurado"

**Solução:**
1. Verifique se a variável está no Supabase
2. Reinicie o servidor Next.js
3. Limpe o cache: `npm run clean-restart`

### Erro: "Developer token not approved"

**Solução:**
1. Use token de teste para desenvolvimento
2. Solicite aprovação em: https://ads.google.com/aw/apicenter
3. Aguarde aprovação (pode levar dias)

### Erro: "redirect_uri_mismatch"

**Solução:**
1. Verifique se o URI está correto no Google Cloud Console
2. Deve ser: `https://seu-dominio.com/api/google/callback`
3. Aguarde alguns minutos para propagar

### Erro: "Token expired"

**Solução:**
1. O refresh automático deve resolver
2. Se persistir, reconecte a conta
3. Verifique logs: `SELECT * FROM google_ads_sync_logs ORDER BY created_at DESC LIMIT 10`

## ✅ Checklist Final de Validação

### Configuração
- [ ] Variáveis de ambiente configuradas no Supabase
- [ ] Schema do banco executado
- [ ] Tabelas criadas corretamente
- [ ] RLS policies ativas
- [ ] Índices criados

### Funcionalidades
- [ ] OAuth flow funciona
- [ ] Listagem de contas funciona
- [ ] Seleção de contas funciona
- [ ] Sincronização funciona
- [ ] Métricas são coletadas
- [ ] Refresh automático funciona

### Segurança
- [ ] Tokens criptografados
- [ ] RLS funcionando
- [ ] Auditoria ativa
- [ ] HTTPS em produção

### Performance
- [ ] Tempo de resposta < 2s
- [ ] Taxa de sucesso > 95%
- [ ] Sem memory leaks
- [ ] Cache funcionando

## 📝 Próximos Passos

Após validação completa:

1. **Testar em Staging**
   ```bash
   npm run deploy:staging
   npm run test:staging
   ```

2. **Monitorar Logs**
   ```sql
   SELECT * FROM google_ads_sync_logs 
   WHERE status = 'failed' 
   ORDER BY created_at DESC;
   ```

3. **Configurar Alertas**
   - Token refresh failures
   - Sync failures
   - API errors

4. **Deploy em Produção**
   ```bash
   npm run deploy:production
   ```

## 🆘 Suporte

Se encontrar problemas:

1. **Verificar Logs**
   ```bash
   # Logs do servidor
   npm run logs:google-ads
   
   # Logs do banco
   SELECT * FROM google_ads_sync_logs 
   ORDER BY created_at DESC LIMIT 50;
   ```

2. **Executar Diagnóstico**
   ```bash
   npm run validate:google-ads-v22
   ```

3. **Consultar Documentação**
   - [Implementação Completa](./GOOGLE_ADS_V22_IMPLEMENTATION.md)
   - [Guia de Setup](./GOOGLE_ADS_V22_SETUP_GUIDE.md)
   - [Referência Rápida](./GOOGLE_ADS_V22_QUICK_REFERENCE.md)

---

**Versão:** v22  
**Status:** ✅ Pronto para validação  
**Última atualização:** 2024-01-20
