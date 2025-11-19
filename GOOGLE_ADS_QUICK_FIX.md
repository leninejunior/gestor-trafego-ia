# 🚀 Google Ads - Correção Rápida do Erro 501

## ❌ Erro Atual
```json
{
  "error": {
    "code": 501,
    "message": "Operation is not implemented, or supported, or enabled.",
    "status": "UNIMPLEMENTED"
  }
}
```

## ✅ Solução em 3 Passos

### 1️⃣ Habilitar Google Ads API (2 minutos)

1. Acesse: https://console.cloud.google.com/apis/library/googleads.googleapis.com
2. **Selecione o projeto correto** (o mesmo do OAuth)
3. Clique em **"ATIVAR"** ou **"ENABLE"**
4. Aguarde 1-2 minutos

### 2️⃣ Verificar Conta Google Ads (1 minuto)

1. Acesse: https://ads.google.com/
2. Faça login com: **drive.engrene@gmail.com**
3. Confirme que você vê suas contas de clientes

### 3️⃣ Reconectar (1 minuto)

1. Acesse: http://localhost:3000/dashboard/google
2. Clique em **"Conectar Google Ads"**
3. Autorize com **drive.engrene@gmail.com**
4. Selecione as contas

## 🔍 Verificar se Funcionou

Acesse: http://localhost:3000/api/google/check-api-status

Deve mostrar tudo configurado ✅

## 📋 Checklist Rápido

- [ ] API habilitada no Google Cloud Console
- [ ] Conta drive.engrene@gmail.com tem acesso ao Google Ads
- [ ] Reconectou a conta no sistema

## 💡 Importante

- O Developer Token `3LA2oAR9Ev2wI7AZDQVc2w` está configurado
- Se estiver em "Test Mode", só funciona com contas de teste
- Para produção, solicite aprovação em: https://ads.google.com/aw/apicenter

## 🎯 Resultado Esperado

Após seguir os passos, você verá:
- ✅ Lista de contas do Google Ads
- ✅ Campanhas sincronizadas
- ✅ Métricas no dashboard

---

**Tempo total:** ~5 minutos
**Dificuldade:** Fácil
