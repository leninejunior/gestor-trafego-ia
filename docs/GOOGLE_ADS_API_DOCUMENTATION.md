# Google Ads API Documentation

## Overview

Esta documentação descreve a implementação completa da integração com Google Ads API no sistema de gerenciamento de campanhas multi-plataforma.

## Arquitetura da API

### Estrutura de Rotas

```
/api/google/
├── auth                    # Autenticação OAuth 2.0
├── callback               # Callback OAuth
├── disconnect             # Desconectar conta
├── accounts/              # Gerenciamento de contas
│   ├── select            # Seleção de contas
│   └── route             # Listar contas
├── campaigns/             # Gerenciamento de campanhas
│   ├── [id]              # Detalhes de campanha específica
│   └── route             # Listar campanhas
├── metrics/               # Métricas e analytics
├── sync/                  # Sincronização
│   ├── status            # Status da sincronização
│   └── route             # Iniciar sync manual
└── monitoring/            # Monitoramento
    ├── health            # Health check
    ├── alerts            # Alertas
    └── metrics           # Métricas de sistema
```

### Rotas Unificadas

```
/api/unified/
├── metrics               # Métricas agregadas (Meta + Google)
├── comparison           # Comparação entre plataformas
├── insights             # Insights consolidados
└── time-series          # Dados de série temporal
```

## Endpoints da API

### Autenticação

#### POST /api/google/auth
Inicia o fluxo OAuth 2.0 para conectar conta Google Ads.

**Request Body:**
```json
{
  "clientId": "uuid",
  "redirectUri": "string"
}
```

**Response:**
```json
{
  "authUrl": "string",
  "state": "string"
}
```

#### GET /api/google/callback
Processa o callback OAuth após autorização.

**Query Parameters:**
- `code`: Authorization code do Google
- `state`: State parameter para validação

**Response:**
```json
{
  "success": boolean,
  "connectionId": "uuid",
  "customerId": "string"
}
```

#### POST /api/google/disconnect
Desconecta uma conta Google Ads.

**Request Body:**
```json
{
  "clientId": "uuid"
}
```

### Campanhas

#### GET /api/google/campaigns
Lista campanhas do Google Ads para um cliente.

**Query Parameters:**
- `clientId`: UUID do cliente (obrigatório)
- `status`: Filtro por status (opcional)
- `dateFrom`: Data inicial (opcional)
- `dateTo`: Data final (opcional)
- `page`: Número da página (padrão: 1)
- `limit`: Itens por página (padrão: 20)

**Response:**
```json
{
  "campaigns": [
    {
      "id": "string",
      "name": "string",
      "status": "ENABLED|PAUSED|REMOVED",
      "budget": number,
      "metrics": {
        "impressions": number,
        "clicks": number,
        "conversions": number,
        "cost": number,
        "ctr": number,
        "conversionRate": number
      }
    }
  ],
  "total": number,
  "page": number,
  "totalPages": number,
  "lastSync": "ISO date string"
}
```

#### GET /api/google/campaigns/[id]
Detalhes de uma campanha específica.

**Response:**
```json
{
  "campaign": {
    "id": "string",
    "name": "string",
    "status": "string",
    "budget": number,
    "startDate": "ISO date",
    "endDate": "ISO date"
  },
  "metrics": {
    "impressions": number,
    "clicks": number,
    "conversions": number,
    "cost": number,
    "ctr": number,
    "conversionRate": number,
    "cpc": number,
    "cpa": number,
    "roas": number
  },
  "historicalData": [
    {
      "date": "ISO date",
      "impressions": number,
      "clicks": number,
      "cost": number
    }
  ]
}
```

### Sincronização

#### POST /api/google/sync
Inicia sincronização manual de dados.

**Request Body:**
```json
{
  "clientId": "uuid",
  "fullSync": boolean
}
```

**Response:**
```json
{
  "syncId": "uuid",
  "status": "started|queued",
  "estimatedTime": number
}
```

#### GET /api/google/sync/status
Verifica status da sincronização.

**Query Parameters:**
- `clientId`: UUID do cliente

**Response:**
```json
{
  "lastSync": "ISO date",
  "status": "idle|syncing|error",
  "progress": number,
  "nextScheduledSync": "ISO date",
  "error": "string"
}
```

### Métricas

#### GET /api/google/metrics
Obtém métricas de campanhas com filtros.

**Query Parameters:**
- `clientId`: UUID do cliente
- `campaignIds`: IDs das campanhas (comma-separated)
- `dateFrom`: Data inicial
- `dateTo`: Data final
- `groupBy`: Agrupamento (day|week|month)

**Response:**
```json
{
  "metrics": [
    {
      "date": "ISO date",
      "campaignId": "string",
      "impressions": number,
      "clicks": number,
      "conversions": number,
      "cost": number
    }
  ],
  "summary": {
    "totalImpressions": number,
    "totalClicks": number,
    "totalConversions": number,
    "totalCost": number,
    "averageCtr": number,
    "averageRoas": number
  }
}
```

### APIs Unificadas

#### GET /api/unified/metrics
Métricas agregadas de todas as plataformas conectadas.

**Query Parameters:**
- `clientId`: UUID do cliente
- `dateFrom`: Data inicial
- `dateTo`: Data final
- `platforms`: Plataformas (meta,google)

**Response:**
```json
{
  "aggregated": {
    "total": {
      "spend": number,
      "conversions": number,
      "impressions": number,
      "clicks": number,
      "averageRoas": number
    },
    "byPlatform": [
      {
        "platform": "meta|google",
        "spend": number,
        "conversions": number,
        "impressions": number,
        "clicks": number,
        "roas": number
      }
    ]
  },
  "comparison": {
    "bestPerforming": "meta|google",
    "metrics": {
      "roas": {
        "meta": number,
        "google": number,
        "winner": "meta|google"
      }
    }
  }
}
```

## Códigos de Erro

### Códigos HTTP Padrão
- `200`: Sucesso
- `400`: Bad Request - Parâmetros inválidos
- `401`: Unauthorized - Token inválido ou expirado
- `403`: Forbidden - Sem permissão para o recurso
- `404`: Not Found - Recurso não encontrado
- `429`: Too Many Requests - Rate limit excedido
- `500`: Internal Server Error - Erro interno

### Códigos de Erro Específicos do Google Ads

```json
{
  "error": {
    "code": "GOOGLE_ADS_ERROR_CODE",
    "message": "Mensagem user-friendly",
    "details": "Detalhes técnicos (apenas em desenvolvimento)"
  }
}
```

**Códigos Comuns:**
- `AUTHENTICATION_ERROR`: Erro de autenticação
- `RATE_LIMIT_EXCEEDED`: Limite de API excedido
- `INVALID_CUSTOMER_ID`: ID de cliente inválido
- `PERMISSION_DENIED`: Permissões insuficientes
- `CAMPAIGN_NOT_FOUND`: Campanha não encontrada
- `SYNC_IN_PROGRESS`: Sincronização já em andamento
- `TOKEN_EXPIRED`: Token expirado

## Rate Limiting

### Limites da Google Ads API
- **Operações básicas**: 15,000 operações por dia
- **Relatórios**: 10,000 operações por dia
- **Rate limit por minuto**: 1,000 operações

### Implementação no Sistema
- Exponential backoff automático
- Queue de sincronização para múltiplos clientes
- Cache de dados para reduzir chamadas à API
- Retry automático em caso de rate limit

## Autenticação e Segurança

### OAuth 2.0 Flow
1. Cliente solicita conexão via `/api/google/auth`
2. Sistema gera URL de autorização com state parameter
3. Usuário autoriza no Google
4. Google redireciona para `/api/google/callback`
5. Sistema troca authorization code por tokens
6. Tokens são criptografados e salvos no banco

### Segurança de Tokens
- Access tokens e refresh tokens são criptografados
- Tokens nunca aparecem em logs
- Refresh automático antes da expiração
- Revogação segura de tokens

### Row Level Security (RLS)
Todas as tabelas Google Ads implementam RLS:
```sql
-- Exemplo de política RLS
CREATE POLICY "Users can only access their client's Google connections"
  ON google_ads_connections
  FOR ALL
  USING (
    client_id IN (
      SELECT client_id FROM organization_memberships
      WHERE user_id = auth.uid()
    )
  );
```

## Monitoramento e Observabilidade

### Métricas Coletadas
- Taxa de sucesso de sincronização
- Tempo médio de sincronização
- Erros de API por tipo
- Taxa de refresh de tokens
- Cache hit rate

### Logs Estruturados
```json
{
  "timestamp": "ISO date",
  "level": "info|warn|error",
  "service": "google-ads",
  "operation": "sync|auth|api-call",
  "clientId": "uuid",
  "customerId": "string",
  "duration": number,
  "success": boolean,
  "error": "string"
}
```

### Alertas Configurados
- Sync falha 3 vezes consecutivas
- Taxa de erro > 10%
- Token refresh falha
- Uso de API próximo do limite (90%)

## Performance e Cache

### Estratégia de Cache
- **Campanhas**: TTL 5 minutos
- **Métricas**: TTL 15 minutos
- **Dados agregados**: TTL 10 minutos
- **Invalidação**: Automática após sync

### Otimizações de Query
- Índices otimizados para filtros comuns
- Paginação eficiente
- Agregações pré-calculadas
- Batch operations para sync

## Troubleshooting

### Problemas Comuns

#### Erro de Autenticação
```
Sintoma: "AUTHENTICATION_ERROR" nas chamadas da API
Causa: Token expirado ou inválido
Solução: Verificar refresh automático de tokens
```

#### Sync Lento
```
Sintoma: Sincronização demora mais que 10 minutos
Causa: Muitas campanhas ou rate limiting
Solução: Verificar logs de sync e ajustar batch size
```

#### Dados Desatualizados
```
Sintoma: Métricas não refletem dados recentes
Causa: Cache desatualizado ou sync falhando
Solução: Forçar invalidação de cache e sync manual
```

### Comandos de Debug

#### Verificar Status de Conexão
```bash
# Via API
curl -X GET "/api/google/sync/status?clientId=uuid"

# Via banco de dados
SELECT * FROM google_ads_connections WHERE client_id = 'uuid';
```

#### Verificar Logs de Sync
```sql
SELECT * FROM google_ads_sync_logs 
WHERE connection_id = 'uuid' 
ORDER BY created_at DESC 
LIMIT 10;
```

#### Forçar Sync Manual
```bash
curl -X POST "/api/google/sync" \
  -H "Content-Type: application/json" \
  -d '{"clientId": "uuid", "fullSync": true}'
```

## Versionamento da API

### Versão Atual: v1
- Todas as rotas seguem padrão RESTful
- Responses em JSON
- Paginação via query parameters
- Filtros via query parameters

### Compatibilidade
- Mudanças breaking serão versionadas (v2, v3, etc.)
- Deprecation notices com 6 meses de antecedência
- Suporte a múltiplas versões simultâneas

## Limites e Quotas

### Por Plano de Assinatura
- **Básico**: 5 contas Google Ads, 30 dias de histórico
- **Pro**: 20 contas Google Ads, 90 dias de histórico
- **Enterprise**: Ilimitado, 365 dias de histórico

### Rate Limits Internos
- **Sync manual**: 1 por minuto por cliente
- **API calls**: 100 por minuto por usuário
- **Export**: 5 por hora por cliente
