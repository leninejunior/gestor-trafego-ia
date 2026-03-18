# Google Ads API v22 - README

## 🎯 Visão Geral

Implementação completa e conforme com as especificações oficiais do Google Ads API v22.

## 📚 Documentação

### Guias Principais
- **[Implementação Completa](./GOOGLE_ADS_V22_IMPLEMENTATION.md)** - Documentação técnica detalhada
- **[Guia de Configuração](./GOOGLE_ADS_V22_SETUP_GUIDE.md)** - Setup passo a passo
- **[Referência Rápida](./GOOGLE_ADS_V22_QUICK_REFERENCE.md)** - Comandos e exemplos

### Documentação Oficial Google
- [Google Ads API Docs](https://developers.google.com/google-ads/api/docs/start)
- [OAuth 2.0 Guide](https://developers.google.com/google-ads/api/docs/oauth/overview)
- [GAQL Reference](https://developers.google.com/google-ads/api/docs/query/overview)

## ⚡ Quick Start

### 1. Configurar Variáveis de Ambiente

```bash
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
GOOGLE_ADS_DEVELOPER_TOKEN=xxxxxxxxxxxxxxxx
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 2. Executar Schema do Banco

```bash
# Via Supabase Dashboard
database/google-ads-schema.sql
```

### 3. Validar Implementação

```bash
node scripts/validate-google-ads-v22.js
```

### 4. Testar Integração

```bash
npm run dev
# Acesse: http://localhost:3000/dashboard/google
```

## 🔐 Fluxo OAuth 2.0

1. **Iniciar:** POST `/api/google/auth` com `clientId`
2. **Autorizar:** Usuário autoriza no Google
3. **Callback:** GET `/api/google/callback` processa tokens
4. **Selecionar:** POST `/api/google/accounts/select` escolhe contas
5. **Sincronizar:** POST `/api/google/sync` busca dados

## 📡 Headers Obrigatórios

```typescript
{
  'Authorization': `Bearer ${access_token}`,
  'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
  'Content-Type': 'application/json',
  'login-customer-id': mcc_id // Opcional: para contas MCC
}
```

## 🔍 Exemplo de Query GAQL

```sql
SELECT
  campaign.id,
  campaign.name,
  metrics.impressions,
  metrics.clicks,
  metrics.cost_micros
FROM campaign
WHERE campaign.status != 'REMOVED'
  AND segments.date BETWEEN '2024-01-01' AND '2024-01-31'
```

## 🛠️ Componentes Principais

- **GoogleAdsClient** - Cliente da API com refresh automático
- **GoogleOAuthService** - Gerenciamento do fluxo OAuth
- **GoogleTokenManager** - Tokens criptografados e refresh
- **GoogleAdsSyncService** - Sincronização de dados
- **GoogleAdsRepository** - Acesso ao banco de dados

## ✅ Conformidade v22

- [x] OAuth 2.0 completo
- [x] Headers obrigatórios
- [x] Refresh automático de tokens
- [x] Criptografia de tokens
- [x] Listagem de contas MCC
- [x] Queries GAQL
- [x] RLS policies
- [x] Auditoria
- [x] Error handling
- [x] Monitoramento

## 🚨 Troubleshooting

### Erro 401 - Unauthorized
```bash
# Verificar token
curl http://localhost:3000/api/google/debug-oauth-status?clientId=xxx
```

### Erro 403 - Forbidden
- Verificar se developer token está aprovado
- Confirmar permissões na conta Google Ads

### Erro 429 - Rate Limit
- Implementar exponential backoff
- Reduzir frequência de requisições

## 📊 Monitoramento

```typescript
// Ver métricas
GET /api/google/monitoring/metrics?clientId=xxx

// Ver logs de sync
GET /api/google/monitoring/sync-logs?clientId=xxx

// Health check
GET /api/google/monitoring/health
```

## 🧪 Testes

```bash
# Validar conformidade
npm run validate:google-ads-v22

# Testar OAuth
npm run test:google-oauth

# Testar sincronização
npm run test:google-sync
```

## 📝 Próximos Passos

1. Obter aprovação do Developer Token
2. Configurar contas MCC (se aplicável)
3. Implementar webhooks
4. Otimizar cache de queries
5. Adicionar relatórios customizados

## 🆘 Suporte

- **Issues:** GitHub Issues
- **Docs:** `/docs/GOOGLE_ADS_V22_*.md`
- **Google Forum:** https://groups.google.com/g/adwords-api

---

**Versão:** v22  
**Status:** ✅ Produção  
**Última atualização:** 2024-01-20
