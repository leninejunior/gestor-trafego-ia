# Validação da Migração Google Ads API v22

## 🎯 Objetivo

Validar que a migração de v18 para v22 foi bem-sucedida e que todos os endpoints estão funcionando corretamente.

---

## ✅ Checklist de Validação

### 1. Verificação de Código
- [x] Todos os arquivos atualizados para v22
- [x] Nenhuma referência a v18 no código
- [x] Documentação criada

### 2. Testes Locais
```bash
# Executar script de validação
node scripts/test-google-ads-v22.js
```

**Resultado esperado**: ✅ Migração para v22 concluída com sucesso!

### 3. Testes de Endpoint

#### 3.1 Teste de Conexão Básica
```bash
curl -X GET "https://googleads.googleapis.com/v22/customers:listAccessibleCustomers" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "developer-token: YOUR_DEVELOPER_TOKEN" \
  -H "Content-Type: application/json"
```

**Resposta esperada**:
```json
{
  "resourceNames": [
    "customers/1234567890",
    "customers/0987654321"
  ]
}
```

#### 3.2 Teste de Busca de Campanhas
```bash
curl -X POST "https://googleads.googleapis.com/v22/customers/1234567890/googleAds:search" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "developer-token: YOUR_DEVELOPER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "SELECT campaign.id, campaign.name, campaign.status FROM campaign LIMIT 10"
  }'
```

**Resposta esperada**:
```json
{
  "results": [
    {
      "campaign": {
        "resourceName": "customers/1234567890/campaigns/9876543210",
        "id": "9876543210",
        "name": "Campaign Name",
        "status": "ENABLED"
      }
    }
  ]
}
```

#### 3.3 Teste de Insights
```bash
curl -X POST "https://googleads.googleapis.com/v22/customers/1234567890/googleAds:search" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "developer-token: YOUR_DEVELOPER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "SELECT campaign.id, campaign.name, segments.date, metrics.impressions, metrics.clicks, metrics.cost_micros FROM campaign WHERE segments.date BETWEEN '\''2025-11-01'\'' AND '\''2025-11-19'\'' ORDER BY segments.date DESC LIMIT 100"
  }'
```

**Resposta esperada**:
```json
{
  "results": [
    {
      "campaign": {
        "resourceName": "customers/1234567890/campaigns/9876543210",
        "id": "9876543210",
        "name": "Campaign Name"
      },
      "segments": {
        "date": "2025-11-19"
      },
      "metrics": {
        "impressions": "1000",
        "clicks": "50",
        "costMicros": "5000000"
      }
    }
  ]
}
```

---

## 🧪 Testes em Staging

### 1. Testar Sincronização de Campanhas
```bash
# Acessar a página de campanhas do Google
# Verificar se as campanhas são carregadas corretamente
# Validar que os dados estão sendo sincronizados
```

### 2. Testar Busca de Insights
```bash
# Acessar a página de analytics
# Selecionar um período de datas
# Verificar se os insights são carregados corretamente
```

### 3. Testar Conexão OAuth
```bash
# Fazer logout
# Fazer login novamente
# Conectar uma conta Google Ads
# Verificar se a conexão é bem-sucedida
```

---

## 🚨 Possíveis Erros e Soluções

### Erro: 501 Not Implemented
**Causa**: Google Ads API não está habilitada ou Developer Token não aprovado

**Solução**:
1. Verificar se a Google Ads API está habilitada no Google Cloud Console
2. Verificar se o Developer Token foi aprovado
3. Aguardar 24 horas após aprovação do Developer Token

### Erro: 403 Permission Denied
**Causa**: Developer Token inválido ou sem permissão

**Solução**:
1. Verificar se o Developer Token está correto
2. Verificar se o Developer Token tem permissão para acessar a conta
3. Regenerar o Developer Token se necessário

### Erro: 401 Unauthenticated
**Causa**: Token OAuth inválido ou expirado

**Solução**:
1. Fazer logout e login novamente
2. Regenerar o token OAuth
3. Verificar se o token não expirou

### Erro: 429 Too Many Requests
**Causa**: Rate limit excedido

**Solução**:
1. Aguardar alguns segundos antes de fazer nova requisição
2. Implementar retry com backoff exponencial
3. Reduzir a frequência de requisições

---

## 📊 Métricas de Sucesso

- ✅ Todos os endpoints retornam status 200
- ✅ Dados são retornados no formato esperado
- ✅ Sincronização de campanhas funciona corretamente
- ✅ Busca de insights retorna dados válidos
- ✅ Taxa de erro < 1%
- ✅ Tempo de resposta < 2 segundos

---

## 📝 Logs para Monitorar

### Em Staging
```
[Google Ads API] 🚀 Iniciando listAccessibleAccounts
[Google Ads API] 📡 Resposta recebida: { status: 200, statusText: 'OK', ok: true }
[Google Ads API] ✅ JSON parseado com sucesso
[Google Ads API] ✅ Dados retornados: { resourceNames: [...] }
```

### Em Produção
Monitorar logs em tempo real:
```bash
# Verificar logs de erro
tail -f logs/error.log | grep "Google Ads"

# Verificar taxa de sucesso
grep "Google Ads API" logs/app.log | grep "✅" | wc -l
```

---

## 🔄 Rollback (Se Necessário)

Se houver problemas críticos, fazer rollback para v18:

```bash
# 1. Reverter alterações
git revert <commit-hash>

# 2. Fazer deploy
npm run deploy

# 3. Monitorar logs
tail -f logs/error.log
```

**Nota**: v18 está descontinuada desde 20 de agosto de 2025, então rollback não é recomendado.

---

## 📞 Suporte

Se encontrar problemas:

1. Verificar [GOOGLE_ADS_TROUBLESHOOTING.md](./GOOGLE_ADS_TROUBLESHOOTING.md)
2. Consultar [Google Ads API Documentation](https://developers.google.com/google-ads/api/docs)
3. Contatar Google Ads API Support

---

## ✨ Conclusão

Após validar todos os itens acima, a migração para v22 está completa e pronta para produção.

**Data de Conclusão**: 19 de Novembro de 2025  
**Status**: ✅ VALIDADO
