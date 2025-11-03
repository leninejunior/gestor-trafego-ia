# 🚀 Guia de Deploy no Vercel - Ads Manager

## 📋 Pré-requisitos

1. **Conta no Vercel** - [vercel.com](https://vercel.com)
2. **Repositório no GitHub** - Já configurado ✅
3. **Projeto Supabase** - Já configurado ✅

## 🔧 Configuração no Vercel

### 1. Importar Projeto
1. Acesse [vercel.com/dashboard](https://vercel.com/dashboard)
2. Clique em "New Project"
3. Conecte com GitHub e selecione o repositório
4. Configure as seguintes opções:
   - **Framework Preset**: Next.js
   - **Root Directory**: `./` (raiz)
   - **Build Command**: `pnpm build`
   - **Output Directory**: `.next`

### 2. Variáveis de Ambiente Obrigatórias

Configure estas variáveis em **Settings > Environment Variables**:

#### 🔐 Supabase (Obrigatório)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://doiogabdzybqxnyhktbv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvaW9nYWJkenlicXhueWhrdGJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NTg3MjksImV4cCI6MjA3NTQzNDcyOX0.ApHhvf9LO9DxaSQx0bYJtqxmHproH-rn_Kp4eJ15KZs
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvaW9nYWJkenlicXhueWhrdGJ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTg1ODcyOSwiZXhwIjoyMDc1NDM0NzI5fQ.HlJgXvaOLcAOvJa9iV2jNpAqx1du5Ge9-oBD9oYkXuw
```

#### 📱 Meta Ads API (Obrigatório)
```bash
META_APP_ID=925924588141447
META_APP_SECRET=f2dd1158ed69524c46b6c64f2b19fc59
META_ACCESS_TOKEN=EAANKH54qO4cBP62ZCAzLO9A48rDVWjUZBQIQkHyfZCyrVit6AteFMu4eIUnOzQyXSxRLF8oCDQfggvaDSzzpt3pUVqVZBUjFBU15hzCh82X2MZBdoKZBAOkBhONyEVc9zfUPVv6K6DJhviyeQ2xo7ve5IjyFfIvDssBRcWWrWLZB5pTW2tXg3tYBZApIzbixTQwxvVZBGM9JH
```

#### 🌐 URL da Aplicação (CRÍTICO - Atualizar após deploy)
```bash
NEXT_PUBLIC_APP_URL=https://SEU-DOMINIO.vercel.app
```
⚠️ **IMPORTANTE**: Substitua `SEU-DOMINIO` pela URL real após o primeiro deploy!

#### 🔍 Google Ads API (Para integração Google)
```bash
GOOGLE_CLIENT_ID=839778729862-rctp31o4ai6hcsmuj9lpqcg05fuolv43.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
GOOGLE_DEVELOPER_TOKEN=cmyNYo6UHSkfJg3ZJD-cJA
GOOGLE_TOKEN_ENCRYPTION_KEY=Ft3XLNwJlru9jJ7ukMi9WHdzVX2tHXRMh4zI7SzoQCk
```

#### 💳 Iugu Payment (Para sistema de pagamentos)
```bash
IUGU_API_TOKEN=D048F046170090976F17FD67E1FA353EEB8C48ADBDA8603E3189BD1C95D7D946
IUGU_ACCOUNT_ID=3F148506D48B48DCA54F249EF9CC218F
NEXT_PUBLIC_IUGU_ACCOUNT_ID=3F148506D48B48DCA54F249EF9CC218F
```

### 3. Deploy Inicial
1. Clique em "Deploy"
2. Aguarde o build completar
3. **Anote a URL gerada** (ex: `https://seu-projeto-abc123.vercel.app`)

### 4. Configurações Pós-Deploy (OBRIGATÓRIO)

#### A. Atualizar NEXT_PUBLIC_APP_URL
1. Vá em **Settings > Environment Variables**
2. Edite `NEXT_PUBLIC_APP_URL`
3. Substitua por sua URL real: `https://seu-projeto-abc123.vercel.app`
4. Clique em "Save"
5. **Redeploy** o projeto

#### B. Configurar OAuth Callbacks

##### Meta Developer Console
1. Acesse [developers.facebook.com](https://developers.facebook.com)
2. Vá no seu app (ID: 925924588141447)
3. **Products > Facebook Login > Settings**
4. Adicione em "Valid OAuth Redirect URIs":
   ```
   https://seu-projeto-abc123.vercel.app/api/meta/callback
   ```

##### Google Cloud Console
1. Acesse [console.cloud.google.com](https://console.cloud.google.com)
2. Vá em **APIs & Services > Credentials**
3. Edite seu OAuth 2.0 Client ID
4. Adicione em "Authorized redirect URIs":
   ```
   https://seu-projeto-abc123.vercel.app/api/google/callback
   ```

## 🔍 Verificação Pós-Deploy

### 1. Teste de Funcionalidades
- [ ] Login/Cadastro funciona
- [ ] Dashboard carrega corretamente
- [ ] Conexão Meta Ads funciona
- [ ] Conexão Google Ads funciona (se configurado)
- [ ] Sistema de pagamentos funciona (se configurado)

### 2. Logs de Debug
- Acesse **Functions > View Function Logs** no Vercel
- Monitore erros durante os testes

### 3. URLs de Teste
```bash
# Health Check
https://seu-projeto.vercel.app/api/health

# Auth Status
https://seu-projeto.vercel.app/api/debug/auth-status

# Meta Auth
https://seu-projeto.vercel.app/api/meta/auth

# Google Auth
https://seu-projeto.vercel.app/api/google/auth
```

## 🚨 Problemas Comuns

### 1. Erro "connection_failed"
- **Causa**: `NEXT_PUBLIC_APP_URL` ainda está como localhost
- **Solução**: Atualizar variável com URL real e redeploy

### 2. OAuth não funciona
- **Causa**: URLs de callback não configuradas
- **Solução**: Configurar callbacks no Meta/Google Console

### 3. Erro 500 nas APIs
- **Causa**: Variáveis de ambiente faltando
- **Solução**: Verificar todas as variáveis obrigatórias

### 4. Build falha
- **Causa**: Dependências ou TypeScript errors
- **Solução**: Verificar logs de build no Vercel

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs no Vercel Dashboard
2. Confirme todas as variáveis de ambiente
3. Teste as URLs de callback
4. Verifique se o Supabase está acessível

## ✅ Checklist Final

- [ ] Projeto deployado no Vercel
- [ ] Todas as variáveis de ambiente configuradas
- [ ] `NEXT_PUBLIC_APP_URL` atualizada com URL real
- [ ] Callbacks configurados no Meta Developer Console
- [ ] Callbacks configurados no Google Cloud Console
- [ ] Testes de funcionalidade realizados
- [ ] Sistema funcionando em produção

---

🎉 **Parabéns! Seu Ads Manager está em produção!**