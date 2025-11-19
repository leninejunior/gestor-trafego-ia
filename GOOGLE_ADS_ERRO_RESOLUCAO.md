# 🛠️ Resolução de Erros na Conexão com Google Ads

## 📊 Erro Identificado
```
[Google Select Accounts] ❌ ERRO NA RESPOSTA: {}
```

Este erro indica que a resposta da API do Google Ads está vazia ou em um formato inesperado.

## 🔍 Causas Comuns

### 1. Developer Token Não Aprovado
- O Developer Token precisa ser aprovado pelo Google (pode levar 24-48h)
- Status deve ser "Approved" ou "Active" no [Google Ads API Center](https://ads.google.com/aw/apicenter)

### 2. API do Google Ads Não Habilitada
- A API precisa estar habilitada no [Google Cloud Console](https://console.cloud.google.com/apis/library/googleads.googleapis.com)

### 3. Problemas de Autenticação
- Token OAuth expirado
- Credenciais inválidas
- Escopos insuficientes

### 4. Problemas de Rede ou Firewall
- Bloqueio de requisições de saída
- Problemas de conectividade

## 🧪 Diagnóstico

### 1. Verificar Configuração do Ambiente
Acesse o endpoint de diagnóstico:
```
GET /api/google/debug-connection
```

### 2. Testar Conexão com API
Acesse o endpoint de teste:
```
GET /api/google/test-api-call?connectionId=SEU_CONNECTION_ID
```

### 3. Verificar Logs Detalhados
Procure por logs com os seguintes prefixos:
- `[Google Accounts Direct]`
- `[Google Ads API]`
- `[Google Select Accounts]`

## 🔧 Soluções

### Solução 1: Verificar Status do Developer Token
1. Acesse: https://ads.google.com/aw/apicenter
2. Verifique se o Developer Token está como "Approved"
3. Se estiver "Pending", aguarde a aprovação ou use conta de teste

### Solução 2: Habilitar API do Google Ads
1. Acesse: https://console.cloud.google.com/apis/library/googleads.googleapis.com
2. Clique em "ATIVAR" ou "ENABLE"
3. Aguarde alguns minutos para a ativação

### Solução 3: Reconectar Conta do Google Ads
1. Acesse: http://localhost:3000/dashboard/google
2. Clique em "Conectar Google Ads"
3. Autorize com a conta correta
4. Selecione as contas desejadas

### Solução 4: Verificar Variáveis de Ambiente
Confirme que as seguintes variáveis estão configuradas:
```
GOOGLE_CLIENT_ID=seu_client_id
GOOGLE_CLIENT_SECRET=seu_client_secret
GOOGLE_DEVELOPER_TOKEN=seu_developer_token
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 📋 Checklist de Verificação

- [ ] Developer Token aprovado no Google Ads API Center
- [ ] Google Ads API habilitada no Google Cloud Console
- [ ] Credenciais OAuth configuradas corretamente
- [ ] Variáveis de ambiente definidas
- [ ] Conta Google Ads com acesso a campanhas
- [ ] Permissões adequadas na conta Google Ads

## 🎯 Próximos Passos

1. **Execute o diagnóstico automático**: `GET /api/google/debug-connection`
2. **Verifique o status do Developer Token** no painel do Google
3. **Confirme que a API está habilitada** no Google Cloud Console
4. **Teste a conexão** com `GET /api/google/test-api-call`
5. **Reconecte a conta** se necessário

## 📞 Suporte Adicional

Se o problema persistir após seguir todos os passos:

1. **Verifique os logs completos** do servidor
2. **Teste com uma conta de teste** do Google Ads
3. **Entre em contato com o suporte** do Google Ads API
4. **Consulte a documentação oficial**: https://developers.google.com/google-ads/api/docs/start

---

**Última atualização**: 2025-11-17
**Status**: Soluções implementadas e prontas para uso