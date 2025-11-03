# Configuração do Google Cloud Console - URGENTE

## ❌ Problema Atual
Erro: `redirect_uri_mismatch` - O URI de redirecionamento não está registrado no Google Cloud Console.

## ✅ Solução

### 1. Acesse o Google Cloud Console
🔗 **Link direto**: https://console.cloud.google.com/apis/credentials

### 2. Localize suas Credenciais OAuth 2.0
- Procure por "OAuth 2.0 Client IDs"
- Clique no seu Client ID (provavelmente algo como "Web client 1")

### 3. Adicione o URI de Redirecionamento
Na seção **"Authorized redirect URIs"**, adicione:

```
https://gestor.engrene.com/api/google/callback
```

### 4. Remova URIs Antigos (se existirem)
Se houver URIs como:
- `https://gestor.engrene.com/api/google/callback-simple`
- Outros URIs de teste

**REMOVA-OS** para evitar confusão.

### 5. Salve as Alterações
Clique em **"SAVE"** no final da página.

## 🔧 Alterações Feitas no Código

✅ **Corrigido**: O código agora usa `/api/google/callback` (endpoint principal)
❌ **Removido**: Dependência do `/api/google/callback-simple`

## 📋 Checklist de Verificação

- [ ] Acessei o Google Cloud Console
- [ ] Encontrei meu OAuth 2.0 Client ID
- [ ] Adicionei `https://gestor.engrene.com/api/google/callback`
- [ ] Removi URIs antigos/incorretos
- [ ] Salvei as alterações
- [ ] Testei o fluxo OAuth novamente

## 🚨 Importante

**As alterações no Google Cloud Console podem levar alguns minutos para propagar.**

Aguarde 2-3 minutos após salvar antes de testar novamente.

## 🧪 Teste Após Configuração

1. Acesse: https://gestor.engrene.com/dashboard/google
2. Clique em "Conectar Google Ads"
3. Autorize o aplicativo
4. Deve redirecionar corretamente sem erro 400

## 📞 Se Ainda Houver Problemas

Verifique se:
1. O projeto correto está selecionado no Google Cloud Console
2. As APIs necessárias estão habilitadas:
   - Google Ads API
   - Google OAuth2 API
3. O Client ID no `.env.production` corresponde ao do Console

---

**Status**: ⏳ Aguardando configuração no Google Cloud Console
**Prioridade**: 🔴 ALTA - Bloqueia funcionalidade Google Ads