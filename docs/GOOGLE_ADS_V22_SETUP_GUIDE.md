# Google Ads API v22 - Guia de Configuração

## 🎯 Objetivo

Este guia fornece instruções passo a passo para configurar a integração com Google Ads API v22 do zero.

## 📋 Pré-requisitos

- Conta Google Ads ativa
- Acesso ao Google Cloud Console
- Variáveis de ambiente configuradas no projeto

## 🚀 Passo 1: Criar Projeto no Google Cloud Console

### 1.1 Acessar o Console

1. Acesse: https://console.cloud.google.com/
2. Faça login com sua conta Google
3. Clique em "Select a project" → "New Project"

### 1.2 Criar Novo Projeto

```
Nome do Projeto: Ads Manager Integration
ID do Projeto: ads-manager-integration (ou similar)
Organização: (opcional)
```

4. Clique em "Create"

## 🔑 Passo 2: Habilitar Google Ads API

### 2.1 Ativar a API

1. No menu lateral, vá em: **APIs & Services** → **Library**
2. Busque por: "Google Ads API"
3. Clique em "Google Ads API"
4. Clique em "Enable"

### 2.2 Verificar Ativação

- Status deve mostrar: "API enabled"
- Pode levar alguns minutos para propagar

## 🎫 Passo 3: Criar Credenciais OAuth 2.0

### 3.1 Configurar Tela de Consentimento

1. Vá em: **APIs & Services** → **OAuth consent screen**
2. Selecione: **External** (para uso público)
3. Clique em "Create"

**Informações do App:**
```
App name: Ads Manager
User support email: seu-email@dominio.com
App logo: (opcional)
Application home page: https://seu-dominio.com
Application privacy policy: https://seu-dominio.com/privacy-policy
Application terms of service: https://seu-dominio.com/terms-of-service
```

**Developer contact information:**
```
Email addresses: seu-email@dominio.com
```

4. Clique em "Save and Continue"

### 3.2 Adicionar Escopos

1. Clique em "Add or Remove Scopes"
2. Busque por: `https://www.googleapis.com/auth/adwords`
3. Marque o escopo
4. Clique em "Update"
5. Clique em "Save and Continue"

### 3.3 Adicionar Usuários de Teste (Opcional)

Se o app estiver em modo "Testing":
1. Clique em "Add Users"
2. Adicione emails dos usuários que poderão testar
3. Clique em "Save and Continue"

### 3.4 Revisar e Confirmar

1. Revise todas as informações
2. Clique em "Back to Dashboard"

### 3.5 Criar Credenciais OAuth

1. Vá em: **APIs & Services** → **Credentials**
2. Clique em "Create Credentials" → "OAuth client ID"
3. Selecione: **Web application**

**Configuração:**
```
Name: Ads Manager Web Client

Authorized JavaScript origins:
- http://localhost:3000 (desenvolvimento)
- https://seu-dominio.com (produção)

Authorized redirect URIs:
- http://localhost:3000/api/google/callback (desenvolvimento)
- https://seu-dominio.com/api/google/callback (produção)
```

4. Clique em "Create"

### 3.6 Salvar Credenciais

**Você receberá:**
- Client ID: `xxxxx.apps.googleusercontent.com`
- Client Secret: `GOCSPX-xxxxx`

⚠️ **IMPORTANTE:** Guarde essas credenciais em local seguro!

## 🔐 Passo 4: Obter Developer Token

### 4.1 Acessar Google Ads

1. Acesse: https://ads.google.com/
2. Faça login com sua conta Google Ads
3. Clique no ícone de ferramentas (🔧) no canto superior direito

### 4.2 Solicitar Developer Token

1. Vá em: **Setup** → **API Center**
2. Clique em "Apply for access" (se ainda não tiver)
3. Preencha o formulário:
   ```
   Company name: Sua Empresa
   Website: https://seu-dominio.com
   Describe your use case: (descreva seu caso de uso)
   ```
4. Aguarde aprovação (pode levar alguns dias)

### 4.3 Obter Token de Teste

Enquanto aguarda aprovação, você pode usar um token de teste:

1. No API Center, você verá: **Developer token (Test Account)**
2. Copie o token: `xxxxxxxxxxxxxxxx`

**Limitações do Token de Teste:**
- Máximo 15,000 operações por dia
- Apenas para contas de teste
- Não funciona em produção

### 4.4 Token de Produção

Após aprovação:
1. Volte ao API Center
2. Você verá: **Developer token (Production)**
3. Copie o token de produção

## ⚙️ Passo 5: Configurar Variáveis de Ambiente

### 5.1 Arquivo .env

Crie ou edite o arquivo `.env` na raiz do projeto:

```bash
# Google OAuth 2.0
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx

# Google Ads API
GOOGLE_ADS_DEVELOPER_TOKEN=xxxxxxxxxxxxxxxx

# Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 5.2 Arquivo .env.production

Para produção, crie `.env.production`:

```bash
# Google OAuth 2.0
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx

# Google Ads API
GOOGLE_ADS_DEVELOPER_TOKEN=xxxxxxxxxxxxxxxx

# Application URL
NEXT_PUBLIC_APP_URL=https://seu-dominio.com
```

### 5.3 Verificar Configuração

Execute o script de verificação:

```bash
node scripts/check-env.js
```

Deve mostrar:
```
✅ GOOGLE_CLIENT_ID configurado
✅ GOOGLE_CLIENT_SECRET configurado
✅ GOOGLE_ADS_DEVELOPER_TOKEN configurado
✅ NEXT_PUBLIC_APP_URL configurado
```

## 🗄️ Passo 6: Configurar Banco de Dados

### 6.1 Executar Schema

Execute o schema do Google Ads no Supabase:

```bash
# Via Supabase Dashboard
1. Acesse: https://app.supabase.com/
2. Selecione seu projeto
3. Vá em: SQL Editor
4. Cole o conteúdo de: database/google-ads-schema.sql
5. Clique em "Run"
```

### 6.2 Verificar Tabelas

Verifique se as tabelas foram criadas:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'google_ads%';
```

Deve retornar:
- `google_ads_connections`
- `google_ads_campaigns`
- `google_ads_metrics`
- `google_ads_sync_logs`

### 6.3 Verificar RLS Policies

```sql
SELECT tablename, policyname 
FROM pg_policies 
WHERE tablename LIKE 'google_ads%';
```

## 🧪 Passo 7: Testar Integração

### 7.1 Iniciar Servidor de Desenvolvimento

```bash
npm run dev
```

### 7.2 Testar OAuth Flow

1. Acesse: http://localhost:3000/dashboard/google
2. Clique em "Conectar Google Ads"
3. Você será redirecionado para o Google
4. Faça login e autorize o aplicativo
5. Você será redirecionado de volta

### 7.3 Verificar Conexão

```bash
# Via API
curl http://localhost:3000/api/google/debug-oauth-status?clientId=xxx
```

Deve retornar:
```json
{
  "status": "connected",
  "hasValidToken": true,
  "expiresAt": "2024-01-20T15:30:00Z"
}
```

### 7.4 Listar Contas

```bash
# Via API
curl http://localhost:3000/api/google/accounts?clientId=xxx
```

Deve retornar lista de contas acessíveis.

## 🔍 Passo 8: Troubleshooting

### 8.1 Erro: "redirect_uri_mismatch"

**Causa:** URI de redirecionamento não autorizado

**Solução:**
1. Vá em: Google Cloud Console → Credentials
2. Edite o OAuth client
3. Adicione o URI correto em "Authorized redirect URIs"
4. Aguarde alguns minutos para propagar

### 8.2 Erro: "invalid_client"

**Causa:** Client ID ou Secret incorretos

**Solução:**
1. Verifique as variáveis de ambiente
2. Confirme que copiou corretamente do Google Cloud Console
3. Reinicie o servidor

### 8.3 Erro: "access_denied"

**Causa:** Usuário negou permissões

**Solução:**
1. Tente novamente o fluxo OAuth
2. Certifique-se de autorizar todas as permissões solicitadas

### 8.4 Erro: "Developer token not approved"

**Causa:** Token de desenvolvedor não aprovado

**Solução:**
1. Use token de teste para desenvolvimento
2. Aguarde aprovação do token de produção
3. Verifique status em: https://ads.google.com/aw/apicenter

### 8.5 Erro: "Customer not found"

**Causa:** ID de cliente inválido ou sem acesso

**Solução:**
1. Verifique se o customer_id está correto
2. Confirme que o usuário tem acesso à conta
3. Use `listAccessibleCustomers` para ver contas disponíveis

## 📚 Passo 9: Recursos Adicionais

### 9.1 Documentação Oficial

- **Google Ads API:** https://developers.google.com/google-ads/api/docs/start
- **OAuth 2.0:** https://developers.google.com/identity/protocols/oauth2
- **GAQL:** https://developers.google.com/google-ads/api/docs/query/overview

### 9.2 Ferramentas Úteis

- **API Explorer:** https://developers.google.com/google-ads/api/rest/reference
- **Query Builder:** https://developers.google.com/google-ads/api/fields/v22/overview_query_builder
- **OAuth Playground:** https://developers.google.com/oauthplayground/

### 9.3 Suporte

- **Google Ads API Forum:** https://groups.google.com/g/adwords-api
- **Stack Overflow:** Tag `google-ads-api`
- **GitHub Issues:** Reporte bugs no repositório

## ✅ Checklist Final

- [ ] Projeto criado no Google Cloud Console
- [ ] Google Ads API habilitada
- [ ] Tela de consentimento configurada
- [ ] Credenciais OAuth criadas
- [ ] Developer Token obtido
- [ ] Variáveis de ambiente configuradas
- [ ] Schema do banco de dados executado
- [ ] OAuth flow testado com sucesso
- [ ] Contas listadas corretamente
- [ ] Sincronização funcionando

## 🎉 Próximos Passos

Após completar a configuração:

1. **Conectar primeira conta:** Vá em Dashboard → Google Ads → Conectar
2. **Sincronizar dados:** Clique em "Sincronizar Campanhas"
3. **Visualizar métricas:** Acesse Analytics → Google Ads
4. **Configurar alertas:** Configure notificações de performance

---

**Última atualização:** 2024-01-20
**Versão:** 1.0
**Status:** ✅ Guia completo e testado
