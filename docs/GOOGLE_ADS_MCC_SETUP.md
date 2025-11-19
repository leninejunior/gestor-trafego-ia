# Google Ads MCC (Manager Account) - Guia de Configuração

## 📋 Contexto

Este guia é para conectar uma **conta gerenciadora do Google Ads (MCC)** que tem acesso a múltiplas contas de clientes.

**Conta principal:** drive.engrene@gmail.com

## 🎯 O que é uma conta MCC?

Uma conta MCC (My Client Center) permite gerenciar múltiplas contas do Google Ads de um único lugar. É ideal para agências que gerenciam campanhas de vários clientes.

## ⚠️ Problema Atual

**Erro:** `501 UNIMPLEMENTED - Operation is not implemented, or supported, or enabled`

**Causa:** A Google Ads API não está habilitada OU a conta não tem acesso configurado corretamente.

## ✅ Solução Passo a Passo

### 1. Habilitar a Google Ads API

1. Acesse: https://console.cloud.google.com/apis/library/googleads.googleapis.com
2. **Importante:** Selecione o projeto correto (o mesmo que tem o OAuth configurado)
3. Clique em **"ENABLE"** (Ativar)
4. Aguarde alguns minutos para a API ser ativada

### 2. Verificar Conta Google Ads

1. Acesse: https://ads.google.com/ com **drive.engrene@gmail.com**
2. Verifique se você vê:
   - ✅ Múltiplas contas de clientes
   - ✅ Um Customer ID no formato `123-456-7890`
3. Anote o **Manager Customer ID** (ID da conta gerenciadora)

### 3. Configurar Developer Token

1. Acesse: https://ads.google.com/aw/apicenter
2. Verifique o status do Developer Token:
   - **Test Mode:** ⚠️ Só funciona com contas de teste
   - **Approved:** ✅ Funciona com todas as contas
   - **Pending:** ⏳ Aguardando aprovação do Google

**Developer Token atual:** `3LA2oAR9Ev2wI7AZDQVc2w`

### 4. Reconectar a Conta

Depois de habilitar a API:

1. Acesse: http://localhost:3000/dashboard/google
2. Clique em **"Conectar Google Ads"**
3. Faça login com **drive.engrene@gmail.com**
4. Autorize todas as permissões solicitadas
5. Selecione as contas de clientes que deseja gerenciar

## 🔍 Diagnóstico

### Verificar Status da API

Acesse: http://localhost:3000/api/google/check-api-status

Isso mostrará:
- ✅ Developer Token configurado
- ✅ OAuth configurado
- ✅ Próximos passos

### Testar Conexão Existente

Se já conectou antes, teste com:

```
http://localhost:3000/api/google/accounts-direct?connectionId=SEU_CONNECTION_ID&clientId=SEU_CLIENT_ID
```

## 📝 Checklist de Verificação

- [ ] Google Ads API habilitada no Google Cloud Console
- [ ] Conta drive.engrene@gmail.com tem acesso ao Google Ads
- [ ] Developer Token está em modo "Approved" (ou "Test" para testes)
- [ ] OAuth 2.0 configurado corretamente no Google Cloud Console
- [ ] Redirect URI configurado: `https://gestor.engrene.com/api/google/callback`
- [ ] Variáveis de ambiente configuradas no `.env`

## 🚨 Erros Comuns

### 501 UNIMPLEMENTED
**Causa:** Google Ads API não habilitada
**Solução:** Habilitar em https://console.cloud.google.com/apis/library/googleads.googleapis.com

### 401 UNAUTHENTICATED
**Causa:** Token OAuth inválido ou expirado
**Solução:** Reconectar a conta

### 403 PERMISSION_DENIED
**Causa:** Developer Token inválido ou não aprovado
**Solução:** Verificar status em https://ads.google.com/aw/apicenter

### 400 INVALID_CUSTOMER_ID
**Causa:** Customer ID incorreto ou sem acesso
**Solução:** Verificar o Customer ID correto no Google Ads

## 🎓 Recursos Úteis

- **Google Ads API Center:** https://ads.google.com/aw/apicenter
- **Google Cloud Console:** https://console.cloud.google.com/
- **Google Ads:** https://ads.google.com/
- **Documentação API:** https://developers.google.com/google-ads/api/docs/start

## 💡 Dicas

1. **Developer Token em Test Mode** só funciona com contas de teste do Google Ads
2. Para produção, solicite aprovação do Developer Token (pode levar dias)
3. Uma conta MCC pode gerenciar até 1000 contas de clientes
4. Sempre use o **Manager Customer ID** ao fazer requisições para contas gerenciadas

## 🔄 Próximos Passos

Após habilitar a API e reconectar:

1. As contas aparecerão na tela de seleção
2. Escolha quais contas deseja gerenciar
3. O sistema sincronizará automaticamente as campanhas
4. Você poderá ver métricas e gerenciar campanhas no dashboard

## 📞 Suporte

Se o problema persistir após seguir todos os passos:

1. Verifique os logs do servidor
2. Teste a API diretamente: `/api/google/accounts-direct`
3. Verifique o status: `/api/google/check-api-status`
