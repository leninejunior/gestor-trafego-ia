# 🚨 CORREÇÃO ERRO 503 GOOGLE AUTH - PRODUÇÃO

## 🔍 Problema Identificado

O erro 503 no Google Auth está ocorrendo porque:
1. `NEXT_PUBLIC_APP_URL` ainda está configurada como `localhost`
2. Variáveis de ambiente podem não estar carregadas no Vercel
3. OAuth callbacks não estão configurados para a URL de produção

## 🔧 CORREÇÃO IMEDIATA (Passo a Passo)

### 1. Atualizar URL no Vercel
1. Acesse [vercel.com/dashboard](https://vercel.com/dashboard)
2. Selecione seu projeto
3. Vá em **Settings > Environment Variables**
4. Encontre `NEXT_PUBLIC_APP_URL`
5. **Edite** e substitua por sua URL real (ex: `https://seu-projeto.vercel.app`)
6. Clique em **Save**

### 2. Redeploy Obrigatório
1. Vá na aba **Deployments**
2. Clique nos **3 pontos** do último deploy
3. Selecione **Redeploy**
4. Aguarde o deploy completar

### 3. Configurar OAuth Callbacks no Google
1. Acesse [console.cloud.google.com](https://console.cloud.google.com)
2. Vá em **APIs & Services > Credentials**
3. Clique no seu OAuth 2.0 Client ID
4. Em **Authorized redirect URIs**, adicione:
   ```
   https://sua-url-vercel.vercel.app/api/google/callback
   ```
5. Clique em **Save**

## 🧪 TESTE APÓS CORREÇÃO

### URLs para Testar:
```bash
# Substitua pela sua URL real
https://sua-url-vercel.vercel.app/api/google/auth
https://sua-url-vercel.vercel.app/api/health
https://sua-url-vercel.vercel.app/dashboard
```

### Verificação no Console:
1. Abra o DevTools (F12)
2. Vá na aba **Network**
3. Tente conectar Google Ads
4. Verifique se não há mais erro 503

## 🔍 VERIFICAÇÃO DE VARIÁVEIS NO VERCEL

Confirme que estas variáveis estão configuradas:

### Obrigatórias:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `META_APP_ID`
- `META_APP_SECRET`
- `NEXT_PUBLIC_APP_URL` ← **CRÍTICA**

### Google Ads:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_DEVELOPER_TOKEN`
- `GOOGLE_TOKEN_ENCRYPTION_KEY`

## 🚨 PROBLEMAS COMUNS

### 1. Erro persiste após redeploy
**Causa**: Cache do Vercel
**Solução**: 
- Aguarde 2-3 minutos
- Teste em aba anônima
- Force refresh (Ctrl+F5)

### 2. Variável não aparece no Vercel
**Causa**: Não foi salva corretamente
**Solução**:
- Verifique se clicou em "Save"
- Redeploy é obrigatório após mudanças

### 3. OAuth ainda não funciona
**Causa**: Callback não configurado no Google
**Solução**:
- Verifique URL exata no Google Console
- Deve ser HTTPS em produção
- Sem barra no final

## 📋 CHECKLIST DE VERIFICAÇÃO

- [ ] `NEXT_PUBLIC_APP_URL` atualizada no Vercel
- [ ] Redeploy realizado
- [ ] OAuth callback configurado no Google Console
- [ ] Teste do endpoint `/api/google/auth` funcionando
- [ ] Teste de conexão Google Ads no dashboard funcionando
- [ ] Sem erros 503 no console do navegador

## 🎯 RESULTADO ESPERADO

Após essas correções:
1. ✅ Google Auth retorna 302 (redirect) em vez de 503
2. ✅ Botão "Conectar Google Ads" funciona
3. ✅ OAuth flow completo funciona
4. ✅ Sem erros no console do navegador

## 📞 Se o Problema Persistir

1. Verifique logs no Vercel Dashboard > Functions
2. Teste outras APIs para confirmar se é problema geral
3. Verifique se todas as variáveis foram salvas
4. Confirme se o redeploy foi concluído com sucesso

---

**⚡ AÇÃO IMEDIATA**: Atualize `NEXT_PUBLIC_APP_URL` e faça redeploy!