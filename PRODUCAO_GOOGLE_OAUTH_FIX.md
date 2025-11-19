# 🔧 Correção Google OAuth em Produção

**Problema**: Callback não funciona em produção (Vercel)  
**Erro**: `token_error` - "Erro ao obter tokens de acesso"  
**Causa**: Redirect URI não configurado no Google Cloud Console

---

## ✅ Solução Rápida

### 1. Adicionar Redirect URI em Produção

1. Acesse: https://console.cloud.google.com/apis/credentials
2. Clique no seu **OAuth 2.0 Client ID** (não é a chave de API)
3. Em **"Authorized redirect URIs"**, adicione:
   ```
   https://gestor.engrene.com/api/google/callback
   ```
4. Clique **SALVAR**

### 2. Verificar Configuração

Você deve ter DOIS redirect URIs:

**Desenvolvimento (localhost)**:
```
http://localhost:3000/api/google/callback
```

**Produção (Vercel)**:
```
https://gestor.engrene.com/api/google/callback
```

### 3. Testar em Produção

Acesse: https://gestor.engrene.com/google/select-accounts

Se ainda não funcionar, use o debug endpoint:
```
https://gestor.engrene.com/api/google/callback-debug-prod?code=TEST&state=TEST
```

---

## 🔍 Debug

Se o erro persistir, verifique:

1. **Credenciais corretas**:
   - `GOOGLE_CLIENT_ID` em produção
   - `GOOGLE_CLIENT_SECRET` em produção

2. **Variáveis de ambiente**:
   ```bash
   # Vercel Dashboard → Settings → Environment Variables
   GOOGLE_CLIENT_ID=xxx
   GOOGLE_CLIENT_SECRET=xxx
   NEXT_PUBLIC_APP_URL=https://gestor.engrene.com
   ```

3. **Logs em produção**:
   - Vercel Dashboard → Deployments → Logs
   - Procure por `[Google Callback]` ou `token_error`

---

## 📋 Checklist

- [ ] Redirect URI adicionado no Google Cloud Console
- [ ] Variáveis de ambiente configuradas no Vercel
- [ ] Teste em produção funciona
- [ ] Contas Google Ads aparecem corretamente

---

**Status**: ✅ Pronto para produção após configurar redirect URI
