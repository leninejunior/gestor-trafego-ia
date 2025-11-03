# 🚨 CORREÇÃO URGENTE: Google Ads 503 em Produção

## 🎯 Problema Identificado
- ✅ **Dev funciona**: Google Auth redireciona corretamente
- ❌ **Produção falha**: Erro 503 "Google Ads não configurado"
- 🔍 **Causa**: Variáveis `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` inválidas no Vercel

## 🚀 Solução Imediata (5 minutos)

### 1. Acesse o Vercel Dashboard
```
https://vercel.com/dashboard
```

### 2. Vá para o projeto
- Clique no projeto "gestor.engrene.com"
- Vá em **Settings** > **Environment Variables**

### 3. Adicione/Atualize estas variáveis:

```bash
# COPIE EXATAMENTE ESTES VALORES:

GOOGLE_CLIENT_ID=839778729862-rctp31o4ai6hcsmuj9lpqcg05fuolv43.apps.googleusercontent.com

GOOGLE_CLIENT_SECRET=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

GOOGLE_DEVELOPER_TOKEN=cmyNYo6UHSkfJg3ZJD-cJA

GOOGLE_TOKEN_ENCRYPTION_KEY=Ft3XLNwJlru9jJ7ukMi9WHdzVX2tHXRMh4zI7SzoQCk

NEXT_PUBLIC_APP_URL=https://gestor.engrene.com
```

### 4. Redeploy
- Após adicionar as variáveis
- Clique em **Deployments**
- Clique nos 3 pontinhos da última deployment
- Clique **Redeploy**

## ✅ Teste Após Correção

1. Acesse: https://gestor.engrene.com
2. Vá para um cliente
3. Clique em "Conectar Google Ads"
4. Deve redirecionar para Google OAuth (não mais erro 503)

## 🔍 Verificação Técnica

O erro atual mostra:
```json
{
  "error": "Google Ads não configurado",
  "details": {
    "invalid": ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]
  }
}
```

Isso confirma que essas duas variáveis específicas não estão configuradas corretamente no Vercel.

## 📞 Se Ainda Não Funcionar

Execute este comando para testar novamente:
```bash
node scripts/test-google-production-vars.js
```

Deve retornar status 200 com `authUrl` gerada.

---

**⏰ Tempo estimado para correção: 5 minutos**
**🎯 Resultado esperado: Google Auth funcionando em produção**