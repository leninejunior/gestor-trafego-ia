# 🎯 Google Ads Integration - Documentação Oficial v22

> **📌 NOTA:** Esta é a documentação oficial da integração Google Ads API v22.  
> Toda documentação anterior foi removida. Para documentação detalhada, veja [docs/GOOGLE_ADS_README.md](./docs/GOOGLE_ADS_README.md)

---

## 📊 Status Atual da Integração

### ✅ Fase Concluída - OAuth & Listagem de Contas
1. **OAuth 2.0** - Autenticação funcionando perfeitamente ✅
2. **Listagem de Contas** - Contas Google Ads sendo listadas corretamente ✅
3. **Tokens válidos** - Access token e refresh token obtidos ✅
4. **Conexão salva** - Dados armazenados no banco ✅
5. **Developer Token** - Configurado e funcionando ✅

### 🔄 Fase Atual - Conexões Ativas & Sincronização de Dados

Agora estamos na fase de:
- ✅ Manter conexões ativas no cliente
- 🔄 Sincronizar dados de campanhas
- 🔄 Buscar métricas e insights
- 🔄 Atualizar dados periodicamente

---

## 🎯 Objetivos da Fase Atual

### 1. Conexões Ativas por Cliente ✅
**Status:** Implementado

**O que funciona:**
- Cliente conecta conta Google Ads via OAuth
- Conexão fica ativa e vinculada ao cliente
- Tokens salvos no banco (criptografados)
- Sistema pronto para buscar dados

**Arquivos principais:**
- `src/app/api/google/accounts/select/route.ts` - Salvar conexão
- `src/lib/google/token-manager.ts` - Gerenciar tokens
- `database/google-ads-schema.sql` - Schema de conexões

**Verificar conexão:**
```sql
SELECT 
  id,
  client_id,
  customer_id,
  account_name,
  is_active,
  created_at
FROM google_ads_connections
WHERE client_id = 'uuid-do-cliente'
AND is_active = true;
```

### 2. Sincronização de Campanhas 🔄
**Status:** Em implementação

**O que precisa funcionar:**
- Buscar campanhas da conta conectada via API v22
- Salvar no banco de dados local
- Atualizar métricas periodicamente
- Exibir no dashboard

**Arquivos principais:**
- `src/app/api/google/sync/route.ts` - Endpoint de sync
- `src/lib/google/sync-service.ts` - Lógica de sincronização
- `src/lib/sync/google-ads-sync-adapter.ts` - Adapter de sync
- `src/lib/google/gaql-queries-v22.ts` - Queries GAQL

**Testar sync:**
```bash
# Endpoint de sincronização
curl http://localhost:3000/api/google/sync?clientId=uuid-do-cliente

# Ver status da sincronização
curl http://localhost:3000/api/google/sync/status?clientId=uuid-do-cliente
```

### 3. Exibição de Dados 🔄
**Status:** Aguardando sync

**O que precisa funcionar:**
- Dashboard mostra campanhas Google Ads
- Métricas atualizadas (impressões, cliques, custo)
- Filtros por cliente e período
- Comparação com Meta Ads (unified dashboard)

**Arquivos principais:**
- `src/app/dashboard/google/page.tsx` - Dashboard Google Ads
- `src/components/google/campaigns-list.tsx` - Lista de campanhas
- `src/components/google/metrics-cards.tsx` - Cards de métricas
- `src/components/google/performance-chart.tsx` - Gráficos

---

## 🔧 Troubleshooting - Fase Atual

> **🚨 PROBLEMA ATUAL:** Conexões não aparecem no cliente após seleção e dashboard mostra todas as tentativas.  
> **📖 Solução completa:** Veja [GOOGLE_ADS_CONNECTION_FIX.md](./GOOGLE_ADS_CONNECTION_FIX.md)

### Problema 1: Conexão não fica ativa no cliente

**Sintomas:**
- Conta é selecionada mas não aparece no cliente
- `is_active = false` no banco
- Dashboard vazio

**Verificações:**
```sql
-- Ver todas as conexões
SELECT * FROM google_ads_connections 
WHERE client_id = 'uuid-do-cliente';

-- Ver se tokens estão salvos
SELECT 
  id,
  customer_id,
  account_name,
  is_active,
  LENGTH(access_token) as token_length,
  LENGTH(refresh_token) as refresh_length
FROM google_ads_connections
WHERE client_id = 'uuid-do-cliente';
```

**Soluções:**
1. Verificar se `is_active = true` após seleção
2. Verificar se tokens foram salvos (length > 0)
3. Verificar RLS policies no Supabase
4. Testar endpoint `/api/google/accounts/select`

### Problema 2: Dados não sincronizam

**Sintomas:**
- Conexão ativa mas sem campanhas
- Tabela `google_campaigns` vazia
- Erro ao buscar dados

**Verificações:**
```sql
-- Ver campanhas sincronizadas
SELECT COUNT(*) FROM google_campaigns
WHERE client_id = 'uuid-do-cliente';

-- Ver última sincronização
SELECT 
  client_id,
  last_sync_at,
  sync_status
FROM google_ads_connections
WHERE client_id = 'uuid-do-cliente';
```

**Soluções:**
1. Verificar se token não expirou
2. Testar chamada direta à API Google Ads v22
3. Verificar permissões da conta Google Ads
4. Verificar rate limits (10k requests/dia)
5. Ver logs do servidor para erros

### Problema 3: Token expira rapidamente

**Sintomas:**
- Conexão funciona mas para de funcionar
- Erro 401 Unauthorized
- Precisa reconectar frequentemente

**Verificações:**
```typescript
// Testar renovação de token
const tokenManager = new GoogleAdsTokenManager();
const newToken = await tokenManager.refreshAccessToken(refreshToken);
```

**Soluções:**
1. Implementar refresh automático no `token-manager.ts`
2. Adicionar retry logic com refresh
3. Monitorar expiração de tokens (expires_at)
4. Configurar cron job para renovação preventiva

### Problema 4: API retorna erro 400/500

**Sintomas:**
- Erro ao buscar campanhas
- Resposta vazia da API
- Timeout

**Verificações:**
```bash
# Testar API diretamente
curl -X GET \
  'https://googleads.googleapis.com/v22/customers/CUSTOMER_ID/googleAds:search' \
  -H 'Authorization: Bearer ACCESS_TOKEN' \
  -H 'developer-token: DEV_TOKEN' \
  -d '{
    "query": "SELECT campaign.id, campaign.name FROM campaign"
  }'
```

**Soluções:**
1. Verificar formato da query GAQL
2. Verificar customer_id correto (sem hífens)
3. Verificar developer token válido
4. Verificar permissões da conta

---

## 📋 Checklist de Implementação

### Fase 1: Conexões ✅
- [x] OAuth flow completo
- [x] Listagem de contas
- [x] Salvar conexão no banco
- [x] Tokens criptografados
- [x] RLS policies

### Fase 2: Sincronização 🔄
- [ ] Endpoint de sync implementado
- [ ] Queries GAQL v22 funcionando
- [ ] Salvar campanhas no banco
- [ ] Salvar métricas no banco
- [ ] Cron job para sync automático
- [ ] Tratamento de erros e retry

### Fase 3: Exibição 🔄
- [ ] Dashboard Google Ads
- [ ] Lista de campanhas
- [ ] Cards de métricas
- [ ] Gráficos de performance
- [ ] Filtros por período
- [ ] Comparação Meta vs Google

### Fase 4: Manutenção 📅
- [ ] Renovação automática de tokens
- [ ] Monitoramento de sync
- [ ] Alertas de erro
- [ ] Logs estruturados
- [ ] Documentação atualizada

---

## 🚀 Próximos Passos

### Imediato
1. **Implementar endpoint de sync** (`/api/google/sync`)
2. **Criar queries GAQL v22** para campanhas e métricas
3. **Testar sincronização** com conta real
4. **Salvar dados no banco** (google_campaigns, google_metrics)

### Curto Prazo
1. **Criar dashboard Google Ads**
2. **Implementar componentes de visualização**
3. **Adicionar filtros e busca**
4. **Integrar com unified dashboard**

### Médio Prazo
1. **Cron job para sync automático**
2. **Sistema de renovação de tokens**
3. **Monitoramento e alertas**
4. **Otimização de performance**

---

## 📚 Recursos Úteis

### Documentação
- [Google Ads API v22](https://developers.google.com/google-ads/api/docs/start)
- [GAQL Reference](https://developers.google.com/google-ads/api/docs/query/overview)
- [Campos disponíveis](https://developers.google.com/google-ads/api/fields/v22/overview)

### Exemplos de Queries GAQL
```sql
-- Buscar campanhas
SELECT 
  campaign.id,
  campaign.name,
  campaign.status,
  campaign.advertising_channel_type
FROM campaign
WHERE campaign.status != 'REMOVED'

-- Buscar métricas
SELECT 
  campaign.id,
  campaign.name,
  metrics.impressions,
  metrics.clicks,
  metrics.cost_micros
FROM campaign
WHERE segments.date DURING LAST_30_DAYS
```

### Endpoints Principais
- `GET /api/google/auth` - Iniciar OAuth
- `GET /api/google/callback` - Callback OAuth
- `GET /api/google/accounts` - Listar contas
- `POST /api/google/accounts/select` - Selecionar conta
- `GET /api/google/sync` - Sincronizar dados
- `GET /api/google/campaigns` - Listar campanhas
- `GET /api/google/metrics` - Buscar métricas

---

## 📞 Suporte

Para problemas ou dúvidas:
1. Consulte esta documentação
2. Verifique os logs do servidor
3. Teste os endpoints individualmente
4. Consulte [docs/GOOGLE_ADS_V22_IMPLEMENTATION.md](./docs/GOOGLE_ADS_V22_IMPLEMENTATION.md)

---

**Última atualização**: 21 de Novembro de 2024  
**Versão**: Google Ads API v22  
**Status**: Fase de Sincronização de Dados
