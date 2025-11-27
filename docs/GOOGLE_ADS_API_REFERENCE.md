# Google Ads API Reference

## 📋 Visão Geral

Esta documentação detalha todos os endpoints da API Google Ads disponíveis no sistema, incluindo parâmetros, respostas e exemplos de uso.

**Base URL**: `/api/google`

**Autenticação**: Todos os endpoints requerem autenticação via Supabase Auth, exceto onde indicado.

---

## 🔐 Autenticação e OAuth

### POST /api/google/auth
Inicia o fluxo OAuth 2.0 com Google Ads.

**Parâmetros de Query:**
- `clientId` (string, obrigatório) - ID do cliente

**Resposta de Sucesso (200):**
```json
{
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?..."
}
```

**Exemplo:**
```bash
curl -X POST "https://your-domain.com/api/google/auth?clientId=abc-123"
```

---

### GET /api/google/oauth/callback
Processa o callback OAuth do Google.

**Parâmetros de Query:**
- `code` (string, obrigatório) - Código de autorização do Google
- `state` (string, obrigatório) - State token para validação

**Resposta de Sucesso:**
Redireciona para `/dashboard/google` com sucesso

**Resposta de Erro:**
Redireciona para `/dashboard/google` com parâmetro de erro

---

### GET /api/google/oauth/initiate
Inicia o fluxo OAuth (alternativa ao POST /auth).

**Parâmetros de Query:**
- `clientId` (string, obrigatório) - ID do cliente

**Resposta de Sucesso (200):**
```json
{
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?..."
}
```

---

## 🔌 Gerenciamento de Conexões

### GET /api/google/connections
Lista todas as conexões Google Ads de um cliente.

**Parâmetros de Query:**
- `clientId` (string, obrigatório) - ID do cliente

**Resposta de Sucesso (200):**
```json
{
  "connections": [
    {
      "id": "uuid",
      "client_id": "uuid",
      "customer_id": "123-456-7890",
      "account_name": "Minha Conta Google Ads",
      "is_active": true,
      "token_expires_at": "2024-12-31T23:59:59Z",
      "last_sync_at": "2024-11-24T10:00:00Z",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

**Exemplo:**
```bash
curl "https://your-domain.com/api/google/connections?clientId=abc-123"
```

---

### DELETE /api/google/connections
Remove uma conexão Google Ads.

**Parâmetros de Query:**
- `connectionId` (string, obrigatório) - ID da conexão

**Resposta de Sucesso (200):**
```json
{
  "success": true,
  "message": "Conexão removida com sucesso"
}
```

**Exemplo:**
```bash
curl -X DELETE "https://your-domain.com/api/google/connections?connectionId=xyz-789"
```

---

### POST /api/google/disconnect
Desconecta uma conta Google Ads (marca como inativa).

**Body:**
```json
{
  "connectionId": "uuid"
}
```

**Resposta de Sucesso (200):**
```json
{
  "success": true,
  "message": "Conta desconectada com sucesso"
}
```

---

### GET /api/google/disconnect
Lista conexões disponíveis para desconexão.

**Parâmetros de Query:**
- `clientId` (string, obrigatório) - ID do cliente

**Resposta de Sucesso (200):**
```json
{
  "connections": [...]
}
```

---

## 📊 Campanhas

### GET /api/google/campaigns
Lista campanhas de um cliente.

**Parâmetros de Query:**
- `clientId` (string, obrigatório) - ID do cliente
- `status` (string, opcional) - Filtrar por status (ENABLED, PAUSED, REMOVED)
- `startDate` (string, opcional) - Data inicial (YYYY-MM-DD)
- `endDate` (string, opcional) - Data final (YYYY-MM-DD)

**Resposta de Sucesso (200):**
```json
{
  "campaigns": [
    {
      "id": "uuid",
      "client_id": "uuid",
      "connection_id": "uuid",
      "campaign_id": "123456789",
      "name": "Campanha de Verão",
      "status": "ENABLED",
      "budget_amount_micros": "10000000",
      "advertising_channel_type": "SEARCH",
      "impressions": 1000,
      "clicks": 50,
      "cost_micros": "5000000",
      "conversions": 5,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-11-24T10:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 50
}
```

**Exemplo:**
```bash
curl "https://your-domain.com/api/google/campaigns?clientId=abc-123&status=ENABLED"
```

---

### GET /api/google/campaigns/[id]
Obtém detalhes de uma campanha específica.

**Parâmetros de Path:**
- `id` (string, obrigatório) - ID da campanha

**Parâmetros de Query:**
- `clientId` (string, obrigatório) - ID do cliente

**Resposta de Sucesso (200):**
```json
{
  "campaign": {
    "id": "uuid",
    "campaign_id": "123456789",
    "name": "Campanha de Verão",
    "status": "ENABLED",
    "budget_amount_micros": "10000000",
    "advertising_channel_type": "SEARCH",
    "metrics": {
      "impressions": 1000,
      "clicks": 50,
      "cost_micros": "5000000",
      "conversions": 5,
      "ctr": 0.05,
      "average_cpc": 100000
    },
    "adgroups": [...],
    "ads": [...]
  }
}
```

---

### POST /api/google/campaigns
Cria uma nova campanha (se implementado).

**Body:**
```json
{
  "clientId": "uuid",
  "connectionId": "uuid",
  "name": "Nova Campanha",
  "budget": 100.00,
  "channelType": "SEARCH"
}
```

**Resposta de Sucesso (201):**
```json
{
  "success": true,
  "campaign": {...}
}
```

---

## 🔄 Sincronização

### POST /api/google/sync
Inicia sincronização de campanhas.

**Body:**
```json
{
  "connectionId": "uuid",
  "clientId": "uuid",
  "forceRefresh": false
}
```

**Resposta de Sucesso (200):**
```json
{
  "success": true,
  "syncId": "uuid",
  "campaignsSynced": 10,
  "metricsCollected": 100,
  "duration": 5432,
  "message": "Sincronização concluída com sucesso"
}
```

**Resposta de Erro (400/500):**
```json
{
  "error": "Descrição do erro",
  "code": "SYNC_ERROR",
  "details": {...}
}
```

**Exemplo:**
```bash
curl -X POST "https://your-domain.com/api/google/sync" \
  -H "Content-Type: application/json" \
  -d '{"connectionId":"xyz-789","clientId":"abc-123"}'
```

---

### GET /api/google/sync
Obtém status de sincronizações.

**Parâmetros de Query:**
- `clientId` (string, obrigatório) - ID do cliente
- `limit` (number, opcional) - Limite de resultados (padrão: 10)

**Resposta de Sucesso (200):**
```json
{
  "syncs": [
    {
      "id": "uuid",
      "connection_id": "uuid",
      "started_at": "2024-11-24T10:00:00Z",
      "completed_at": "2024-11-24T10:05:00Z",
      "status": "completed",
      "campaigns_synced": 10,
      "error_message": null
    }
  ]
}
```

---

### GET /api/google/sync/status
Verifica status detalhado de sincronização.

**Parâmetros de Query:**
- `connectionId` (string, obrigatório) - ID da conexão

**Resposta de Sucesso (200):**
```json
{
  "connection": {
    "id": "uuid",
    "customer_id": "123-456-7890",
    "is_active": true,
    "token_expires_at": "2024-12-31T23:59:59Z",
    "last_sync_at": "2024-11-24T10:00:00Z"
  },
  "tokenStatus": {
    "isValid": true,
    "expiresIn": 3600,
    "needsRefresh": false
  },
  "syncStatus": {
    "canSync": true,
    "lastSyncAgo": "5 minutes ago",
    "campaignCount": 10
  },
  "diagnostics": {
    "databaseConnected": true,
    "apiAccessible": true,
    "scopesValid": true
  }
}
```

---

### POST /api/google/sync/status
Força atualização de status.

**Body:**
```json
{
  "connectionId": "uuid",
  "refreshToken": true
}
```

**Resposta de Sucesso (200):**
```json
{
  "success": true,
  "status": {...}
}
```

---

## 📈 Métricas e Performance

### GET /api/google/metrics
Obtém métricas agregadas.

**Parâmetros de Query:**
- `clientId` (string, obrigatório) - ID do cliente
- `startDate` (string, opcional) - Data inicial (YYYY-MM-DD)
- `endDate` (string, opcional) - Data final (YYYY-MM-DD)
- `campaignId` (string, opcional) - Filtrar por campanha

**Resposta de Sucesso (200):**
```json
{
  "metrics": {
    "impressions": 10000,
    "clicks": 500,
    "cost": 250.00,
    "conversions": 25,
    "ctr": 0.05,
    "cpc": 0.50,
    "conversionRate": 0.05,
    "roas": 4.5
  },
  "period": {
    "startDate": "2024-11-01",
    "endDate": "2024-11-24"
  }
}
```

---

### GET /api/google/performance
Obtém dados de performance detalhados.

**Parâmetros de Query:**
- `clientId` (string, obrigatório) - ID do cliente
- `campaignId` (string, opcional) - ID da campanha
- `granularity` (string, opcional) - daily, weekly, monthly (padrão: daily)
- `startDate` (string, opcional) - Data inicial
- `endDate` (string, opcional) - Data final

**Resposta de Sucesso (200):**
```json
{
  "performance": [
    {
      "date": "2024-11-24",
      "impressions": 1000,
      "clicks": 50,
      "cost": 25.00,
      "conversions": 5,
      "ctr": 0.05,
      "cpc": 0.50
    }
  ],
  "summary": {
    "totalImpressions": 10000,
    "totalClicks": 500,
    "totalCost": 250.00,
    "totalConversions": 25
  }
}
```

---

### POST /api/google/performance
Solicita atualização de métricas de performance.

**Body:**
```json
{
  "clientId": "uuid",
  "campaignIds": ["uuid1", "uuid2"],
  "forceRefresh": true
}
```

**Resposta de Sucesso (200):**
```json
{
  "success": true,
  "metricsUpdated": 50,
  "message": "Métricas atualizadas com sucesso"
}
```

---

## 🏥 Health Check e Monitoramento

### GET /api/google/health
Verifica saúde do sistema Google Ads.

**Parâmetros de Query:**
- `clientId` (string, opcional) - ID do cliente para verificação específica
- `detailed` (boolean, opcional) - Retornar informações detalhadas

**Resposta de Sucesso (200):**
```json
{
  "status": "healthy",
  "timestamp": "2024-11-24T10:00:00Z",
  "checks": {
    "database": {
      "status": "ok",
      "responseTime": 15,
      "details": "Conectado ao Supabase"
    },
    "encryptionKeys": {
      "status": "ok",
      "activeKeys": 1,
      "details": "Chaves de criptografia ativas"
    },
    "tokens": {
      "status": "ok",
      "validTokens": 5,
      "expiringSoon": 1,
      "details": "5 tokens válidos, 1 expirando em 24h"
    },
    "apiQuota": {
      "status": "ok",
      "remaining": 95000,
      "limit": 100000,
      "details": "95% de quota disponível"
    },
    "schema": {
      "status": "ok",
      "tablesValid": true,
      "columnsValid": true,
      "rlsEnabled": true,
      "details": "Schema validado com sucesso"
    }
  },
  "recommendations": [
    "1 token expirando em 24h - considere renovar"
  ]
}
```

**Resposta de Erro (503):**
```json
{
  "status": "unhealthy",
  "timestamp": "2024-11-24T10:00:00Z",
  "checks": {...},
  "errors": [
    "Chave de criptografia não encontrada",
    "3 tokens expirados"
  ],
  "recommendations": [
    "Execute: node scripts/rotate-encryption-key.js",
    "Reconecte contas com tokens expirados"
  ]
}
```

**Exemplo:**
```bash
curl "https://your-domain.com/api/google/health?detailed=true"
```

---

### GET /api/google/monitoring/health
Endpoint de monitoramento para health checks externos.

**Resposta de Sucesso (200):**
```json
{
  "status": "ok",
  "uptime": 86400,
  "version": "1.0.0"
}
```

---

### GET /api/google/monitoring/metrics
Métricas de sistema para monitoramento.

**Parâmetros de Query:**
- `period` (string, opcional) - 1h, 24h, 7d, 30d (padrão: 24h)

**Resposta de Sucesso (200):**
```json
{
  "period": "24h",
  "metrics": {
    "totalSyncs": 100,
    "successfulSyncs": 95,
    "failedSyncs": 5,
    "averageSyncDuration": 5432,
    "totalCampaigns": 500,
    "activeCampaigns": 450,
    "totalConnections": 50,
    "activeConnections": 48
  }
}
```

---

### GET /api/google/monitoring/alerts
Lista alertas do sistema.

**Parâmetros de Query:**
- `severity` (string, opcional) - info, warning, error, critical
- `status` (string, opcional) - active, resolved, acknowledged

**Resposta de Sucesso (200):**
```json
{
  "alerts": [
    {
      "id": "uuid",
      "severity": "warning",
      "status": "active",
      "message": "Token expirando em 24h",
      "details": {
        "connectionId": "uuid",
        "expiresAt": "2024-11-25T10:00:00Z"
      },
      "createdAt": "2024-11-24T10:00:00Z"
    }
  ]
}
```

---

### POST /api/google/monitoring/alerts
Cria um novo alerta.

**Body:**
```json
{
  "severity": "warning",
  "message": "Descrição do alerta",
  "details": {...}
}
```

---

### PATCH /api/google/monitoring/alerts
Atualiza status de um alerta.

**Body:**
```json
{
  "alertId": "uuid",
  "status": "acknowledged"
}
```

---

## 🔍 Diagnóstico e Debug

### GET /api/google/diagnostic
Executa diagnóstico completo do sistema.

**Resposta de Sucesso (200):**
```json
{
  "timestamp": "2024-11-24T10:00:00Z",
  "environment": {
    "nodeVersion": "18.17.0",
    "nextVersion": "15.0.0",
    "supabaseConfigured": true
  },
  "database": {
    "connected": true,
    "tables": ["google_ads_connections", "google_ads_campaigns", ...],
    "rlsEnabled": true
  },
  "api": {
    "developerToken": "configured",
    "clientId": "configured",
    "clientSecret": "configured"
  },
  "connections": {
    "total": 5,
    "active": 4,
    "expired": 1
  }
}
```

---

### GET /api/google/debug-connection
Debug de conexão específica.

**Parâmetros de Query:**
- `connectionId` (string, obrigatório) - ID da conexão

**Resposta de Sucesso (200):**
```json
{
  "connection": {...},
  "tokenStatus": {...},
  "apiAccess": {...},
  "lastSync": {...},
  "errors": []
}
```

---

### GET /api/google/debug-env
Verifica configuração de variáveis de ambiente.

**Resposta de Sucesso (200):**
```json
{
  "configured": {
    "GOOGLE_ADS_DEVELOPER_TOKEN": true,
    "GOOGLE_CLIENT_ID": true,
    "GOOGLE_CLIENT_SECRET": true,
    "GOOGLE_REDIRECT_URI": true
  },
  "values": {
    "GOOGLE_REDIRECT_URI": "https://your-domain.com/api/google/oauth/callback"
  }
}
```

---

## 🔐 Contas e Seleção

### POST /api/google/accounts/select
Salva contas selecionadas após OAuth.

**Body:**
```json
{
  "clientId": "uuid",
  "accounts": [
    {
      "customerId": "123-456-7890",
      "accountName": "Minha Conta"
    }
  ],
  "accessToken": "ya29...",
  "refreshToken": "1//...",
  "expiresAt": "2024-11-24T11:00:00Z"
}
```

**Resposta de Sucesso (200):**
```json
{
  "success": true,
  "connections": [
    {
      "id": "uuid",
      "customer_id": "123-456-7890",
      "account_name": "Minha Conta"
    }
  ]
}
```

---

### GET /api/google/accounts
Lista contas disponíveis (após OAuth).

**Parâmetros de Query:**
- `accessToken` (string, obrigatório) - Token de acesso temporário

**Resposta de Sucesso (200):**
```json
{
  "accounts": [
    {
      "customerId": "123-456-7890",
      "accountName": "Minha Conta",
      "currency": "BRL",
      "timezone": "America/Sao_Paulo"
    }
  ]
}
```

---

## 📝 Códigos de Erro

### Códigos HTTP
- `200` - Sucesso
- `201` - Criado com sucesso
- `400` - Requisição inválida
- `401` - Não autenticado
- `403` - Sem permissão
- `404` - Recurso não encontrado
- `429` - Limite de taxa excedido
- `500` - Erro interno do servidor
- `503` - Serviço indisponível

### Códigos de Erro Customizados

#### Autenticação
- `AUTH_REQUIRED` - Autenticação necessária
- `INVALID_TOKEN` - Token inválido ou expirado
- `TOKEN_REFRESH_FAILED` - Falha ao renovar token
- `INSUFFICIENT_SCOPES` - Scopes OAuth insuficientes

#### Conexões
- `CONNECTION_NOT_FOUND` - Conexão não encontrada
- `CONNECTION_INACTIVE` - Conexão inativa
- `CUSTOMER_ID_INVALID` - Customer ID inválido
- `CUSTOMER_ID_NOT_ACCESSIBLE` - Customer ID não acessível

#### Sincronização
- `SYNC_IN_PROGRESS` - Sincronização já em andamento
- `SYNC_FAILED` - Falha na sincronização
- `NO_CAMPAIGNS_FOUND` - Nenhuma campanha encontrada
- `API_QUOTA_EXCEEDED` - Quota da API excedida

#### Schema e Banco de Dados
- `SCHEMA_INVALID` - Schema do banco inválido
- `MISSING_COLUMN` - Coluna ausente no banco
- `RLS_VIOLATION` - Violação de política RLS
- `DATABASE_ERROR` - Erro no banco de dados

#### Criptografia
- `ENCRYPTION_KEY_NOT_FOUND` - Chave de criptografia não encontrada
- `DECRYPTION_FAILED` - Falha ao descriptografar
- `KEY_ROTATION_FAILED` - Falha na rotação de chaves

---

## 🔒 Segurança

### Autenticação
Todos os endpoints (exceto callbacks OAuth) requerem:
- Header `Authorization: Bearer <supabase-jwt-token>`
- Token JWT válido do Supabase Auth

### Row Level Security (RLS)
- Usuários só acessam dados de seus próprios clientes
- Políticas RLS aplicadas em todas as tabelas
- Service role bypass para jobs em background

### Criptografia
- Tokens OAuth criptografados em repouso
- Algoritmo: AES-256-GCM
- Rotação automática de chaves

### Rate Limiting
- Limite padrão: 100 requisições/minuto por usuário
- Limite de sync: 1 sincronização a cada 5 minutos por conexão
- Headers de rate limit incluídos nas respostas

---

## 📊 Exemplos de Uso

### Fluxo Completo de Conexão

```javascript
// 1. Iniciar OAuth
const authResponse = await fetch('/api/google/auth?clientId=abc-123', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const { authUrl } = await authResponse.json();

// 2. Redirecionar usuário para authUrl
window.location.href = authUrl;

// 3. Após callback, listar conexões
const connectionsResponse = await fetch('/api/google/connections?clientId=abc-123', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const { connections } = await connectionsResponse.json();

// 4. Sincronizar campanhas
const syncResponse = await fetch('/api/google/sync', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    connectionId: connections[0].id,
    clientId: 'abc-123'
  })
});
const syncResult = await syncResponse.json();

// 5. Obter métricas
const metricsResponse = await fetch('/api/google/metrics?clientId=abc-123', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const { metrics } = await metricsResponse.json();
```

---

### Monitoramento de Saúde

```javascript
// Health check periódico
setInterval(async () => {
  const response = await fetch('/api/google/health?detailed=true');
  const health = await response.json();
  
  if (health.status !== 'healthy') {
    console.error('Sistema não saudável:', health.errors);
    // Enviar alerta
  }
  
  // Verificar tokens expirando
  if (health.checks.tokens.expiringSoon > 0) {
    console.warn('Tokens expirando em breve');
    // Notificar usuário
  }
}, 5 * 60 * 1000); // A cada 5 minutos
```

---

## 📚 Recursos Adicionais

- [Google Ads API Documentation](https://developers.google.com/google-ads/api/docs/start)
- [OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [GOOGLE_ADS_TROUBLESHOOTING.md](./GOOGLE_ADS_TROUBLESHOOTING.md)
- [GOOGLE_ADS_SCHEMA_FIX.md](../GOOGLE_ADS_SCHEMA_FIX.md)

---

**Última Atualização:** 24 de novembro de 2024  
**Versão da API:** 1.0.0  
**Google Ads API Version:** v22
