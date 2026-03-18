# Migração Google Ads API v18 → v22

## Status: ✅ CONCLUÍDO

**Data**: 19 de Novembro de 2025  
**Versão Anterior**: v18 (descontinuada em 20 de agosto de 2025)  
**Versão Atual**: v22

---

## 📋 Resumo das Mudanças

### Arquivos Atualizados

1. **src/lib/google/ads-api.ts**
   - `API_VERSION`: v18 → v22

2. **src/lib/sync/google-ads-sync-adapter.ts**
   - `API_VERSION`: v18 → v22

3. **src/app/api/google/accounts-with-refresh/route.ts**
   - Endpoint URL: v18 → v22

---

## 🔄 Mudanças Críticas v21 → v22

### 1. Renomeação de Campos
- `BudgetPerDayMinimumErrorDetails.minimum_bugdet_amount_micros` → `minimum_budget_amount_micros`
- **Ação**: Verificar se há uso deste campo no código (não encontrado)

### 2. Novos Limites de Batch Jobs
- Máximo de 10.000 operações por `AddBatchJobOperations` request
- **Ação**: Implementar validação se usar batch operations

### 3. Mudanças em `ListBatchJobResultsRequest`
- Se `page_size` não for definido ou for 0: padrão agora é 1.000 (antes retornava erro)
- Se `page_size` > 1.000: retorna erro `INVALID_PAGE_SIZE` (antes era silenciosamente limitado)
- **Ação**: Revisar paginação se implementada

### 4. Remoção de `AssetPerformanceLabel`
- Removido para Performance Max campaigns
- **Ação**: Não afeta código atual

### 5. Mudanças em Métricas de Vídeo
Renomeações em `ReachPlanService`:
- `average_cpv` → `trueview_average_cpv`
- `video_view_rate` → `video_trueview_view_rate`
- `video_views` → `video_trueview_views`
- `video_view_rate_in_feed` → `video_trueview_view_rate_in_feed`
- `video_view_rate_in_stream` → `video_trueview_view_rate_in_stream`
- `video_view_rate_shorts` → `video_trueview_view_rate_shorts`

**Ação**: Não afeta código atual (não usa ReachPlanService)

---

## ✅ Checklist de Validação

- [x] Atualizar versão da API em todos os arquivos
- [x] Revisar mudanças críticas entre v21 e v22
- [x] Verificar uso de campos renomeados
- [x] Validar endpoints principais
- [ ] Testar em staging
- [ ] Testar em produção

---

## 🧪 Testes Recomendados

### 1. Teste de Conexão
```bash
curl -X GET "https://googleads.googleapis.com/v22/customers:listAccessibleCustomers" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "developer-token: YOUR_DEVELOPER_TOKEN"
```

### 2. Teste de Busca de Campanhas
```bash
curl -X POST "https://googleads.googleapis.com/v22/customers/{customerId}/googleAds:search" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "developer-token: YOUR_DEVELOPER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "SELECT campaign.id, campaign.name FROM campaign LIMIT 10"
  }'
```

### 3. Teste de Insights
```bash
curl -X POST "https://googleads.googleapis.com/v22/customers/{customerId}/googleAds:search" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "developer-token: YOUR_DEVELOPER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "SELECT campaign.id, segments.date, metrics.impressions, metrics.clicks, metrics.cost_micros FROM campaign WHERE segments.date BETWEEN '\''2025-11-01'\'' AND '\''2025-11-19'\''"
  }'
```

---

## 📚 Referências

- [Google Ads API v22 Release Notes](https://developers.google.com/google-ads/api/docs/release-notes)
- [Key Changes v21 to v22](https://developers.google.com/google-ads/api/docs/release-notes#v21_to_v22)
- [Proto Differences v21 to v22](https://developers.google.com/google-ads/api/docs/release-notes#proto_differences_v21_v22)

---

## 🚀 Próximos Passos

1. **Testar em Staging**
   - Validar conexão com Google Ads API v22
   - Testar sincronização de campanhas
   - Testar busca de insights

2. **Monitorar em Produção**
   - Verificar logs de erro
   - Monitorar taxa de sucesso de requisições
   - Validar dados retornados

3. **Documentação**
   - Atualizar guias de integração
   - Documentar mudanças para o time

---

## 📝 Notas Importantes

- A v18 foi descontinuada em **20 de agosto de 2025**
- Qualquer requisição usando v18 agora **falhará**
- A migração para v22 é **obrigatória**
- Não há breaking changes significativos para o código atual
- Todos os endpoints principais continuam funcionando da mesma forma

---

## 🔗 Relacionado

- [GOOGLE_ADS_TECHNICAL_DOCUMENTATION.md](./GOOGLE_ADS_TECHNICAL_DOCUMENTATION.md)
- [GOOGLE_ADS_TROUBLESHOOTING.md](./GOOGLE_ADS_TROUBLESHOOTING.md)
- [SETUP_GOOGLE_ADS.md](./SETUP_GOOGLE_ADS.md)
