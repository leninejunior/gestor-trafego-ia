# Design Document - Google Ads Integration

## Overview

Esta integração adiciona suporte completo ao Google Ads no sistema existente de gerenciamento de campanhas, mantendo a arquitetura e funcionalidades da Meta Ads intactas. A solução implementa uma abordagem multi-plataforma com isolamento de dados, dashboards separados e um dashboard unificado para visão consolidada.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                       │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Dashboard  │  │  Dashboard   │  │  Dashboard   │      │
│  │  Unificado   │  │  Meta Ads    │  │ Google Ads   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                 │                  │               │
│         └─────────────────┴──────────────────┘               │
│                           │                                  │
├───────────────────────────┼──────────────────────────────────┤
│                     API Routes                               │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Meta APIs   │  │ Google APIs  │  │ Unified APIs │      │
│  │  (existing)  │  │    (new)     │  │    (new)     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                 │                  │               │
├─────────┼─────────────────┼──────────────────┼───────────────┤
│         │                 │                  │               │
│  ┌──────┴──────┐   ┌──────┴──────┐   ┌──────┴──────┐       │
│  │   Meta      │   │   Google    │   │  Aggregation│       │
│  │   Client    │   │   Client    │   │   Service   │       │
│  └─────────────┘   └─────────────┘   └─────────────┘       │
│         │                 │                  │               │
├─────────┼─────────────────┼──────────────────┼───────────────┤
│         │                 │                  │               │
│  ┌──────┴──────────────────┴──────────────────┴──────┐      │
│  │              Supabase PostgreSQL                   │      │
│  │  ┌──────────────┐  ┌──────────────┐               │      │
│  │  │  Meta Tables │  │Google Tables │               │      │
│  │  │    (RLS)     │  │    (RLS)     │               │      │
│  │  └──────────────┘  └──────────────┘               │      │
│  └────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Platform Separation Strategy

1. **Database Level**: Tabelas separadas com prefixos `google_ads_*` e `meta_ads_*`
2. **API Level**: Rotas separadas `/api/google/*` e `/api/meta/*`
3. **Service Level**: Clients separados `GoogleAdsClient` e `MetaClient`
4. **UI Level**: Dashboards separados com componentes reutilizáveis

## Components and Interfaces

### 1. Google Ads Client Service

**Location**: `src/lib/google/client.ts`

```typescript
interface GoogleAdsClientConfig {
  clientId: string;
  clientSecret: string;
  developerToken: string;
  refreshToken: string;
  customerId: string;
}

interface GoogleAdsCampaign {
  id: string;
  name: string;
  status: 'ENABLED' | 'PAUSED' | 'REMOVED';
  budget: number;
  metrics: {
    impressions: number;
    clicks: number;
    conversions: number;
    cost: number;
    ctr: number;
    conversionRate: number;
  };
}

class GoogleAdsClient {
  async authenticate(code: string): Promise<TokenResponse>
  async refreshAccessToken(refreshToken: string): Promise<TokenResponse>
  async getCampaigns(customerId: string): Promise<GoogleAdsCampaign[]>
  async getCampaignMetrics(campaignId: string, dateRange: DateRange): Promise<Metrics>
  async getAccountInfo(customerId: string): Promise<AccountInfo>
}
```

### 2. Google OAuth Service

**Location**: `src/lib/google/oauth.ts`

```typescript
interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

class GoogleOAuthService {
  getAuthorizationUrl(state: string): string
  exchangeCodeForTokens(code: string): Promise<TokenResponse>
  refreshToken(refreshToken: string): Promise<TokenResponse>
  revokeToken(token: string): Promise<void>
}
```

### 3. Google Sync Service

**Location**: `src/lib/google/sync-service.ts`

```typescript
interface SyncOptions {
  clientId: string;
  customerId: string;
  fullSync?: boolean;
  dateRange?: DateRange;
}

interface SyncResult {
  success: boolean;
  campaignsSynced: number;
  metricsUpdated: number;
  errors: SyncError[];
  timestamp: Date;
}

class GoogleSyncService {
  async syncCampaigns(options: SyncOptions): Promise<SyncResult>
  async syncMetrics(campaignId: string, dateRange: DateRange): Promise<void>
  async scheduleSyncJob(clientId: string): Promise<void>
  async getLastSyncStatus(clientId: string): Promise<SyncStatus>
}
```

### 4. Multi-Platform Aggregation Service

**Location**: `src/lib/services/platform-aggregation.ts`

```typescript
interface PlatformMetrics {
  platform: 'meta' | 'google';
  spend: number;
  conversions: number;
  impressions: number;
  clicks: number;
  roas: number;
}

interface AggregatedMetrics {
  total: {
    spend: number;
    conversions: number;
    impressions: number;
    clicks: number;
    averageRoas: number;
  };
  byPlatform: PlatformMetrics[];
  dateRange: DateRange;
}

class PlatformAggregationService {
  async getAggregatedMetrics(clientId: string, dateRange: DateRange): Promise<AggregatedMetrics>
  async comparePlatforms(clientId: string, dateRange: DateRange): Promise<PlatformComparison>
  async getTopPerformingPlatform(clientId: string): Promise<'meta' | 'google' | null>
}
```

### 5. Google Ads Repository

**Location**: `src/lib/repositories/google-ads-repository.ts`

```typescript
interface GoogleAdsConnection {
  id: string;
  client_id: string;
  customer_id: string;
  refresh_token: string; // encrypted
  access_token: string; // encrypted
  token_expires_at: Date;
  last_sync_at: Date;
  status: 'active' | 'expired' | 'revoked';
}

class GoogleAdsRepository {
  async saveConnection(connection: GoogleAdsConnection): Promise<void>
  async getConnection(clientId: string): Promise<GoogleAdsConnection | null>
  async updateTokens(connectionId: string, tokens: TokenData): Promise<void>
  async saveCampaigns(campaigns: GoogleAdsCampaign[]): Promise<void>
  async getCampaigns(clientId: string, filters?: CampaignFilters): Promise<GoogleAdsCampaign[]>
  async saveMetrics(campaignId: string, metrics: Metrics): Promise<void>
  async getHistoricalMetrics(campaignId: string, dateRange: DateRange): Promise<Metrics[]>
}
```

## Data Models

### Database Schema

#### google_ads_connections

```sql
CREATE TABLE google_ads_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL,
  refresh_token TEXT NOT NULL, -- encrypted
  access_token TEXT, -- encrypted
  token_expires_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, customer_id)
);

-- RLS Policy
ALTER TABLE google_ads_connections ENABLE ROW LEVEL SECURITY;

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

#### google_ads_campaigns

```sql
CREATE TABLE google_ads_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES google_ads_connections(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  status TEXT NOT NULL,
  budget_amount DECIMAL(10, 2),
  budget_currency TEXT DEFAULT 'USD',
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(connection_id, campaign_id)
);

-- RLS Policy
ALTER TABLE google_ads_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their client's Google campaigns"
  ON google_ads_campaigns
  FOR ALL
  USING (
    client_id IN (
      SELECT client_id FROM organization_memberships
      WHERE user_id = auth.uid()
    )
  );
```

#### google_ads_metrics

```sql
CREATE TABLE google_ads_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES google_ads_campaigns(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  conversions DECIMAL(10, 2) DEFAULT 0,
  cost DECIMAL(10, 2) DEFAULT 0,
  ctr DECIMAL(5, 2),
  conversion_rate DECIMAL(5, 2),
  cpc DECIMAL(10, 2),
  cpa DECIMAL(10, 2),
  roas DECIMAL(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, date)
);

-- RLS Policy
ALTER TABLE google_ads_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access metrics for their client's campaigns"
  ON google_ads_metrics
  FOR ALL
  USING (
    campaign_id IN (
      SELECT id FROM google_ads_campaigns
      WHERE client_id IN (
        SELECT client_id FROM organization_memberships
        WHERE user_id = auth.uid()
      )
    )
  );

-- Index for performance
CREATE INDEX idx_google_metrics_campaign_date ON google_ads_metrics(campaign_id, date DESC);
```

#### google_ads_sync_logs

```sql
CREATE TABLE google_ads_sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  connection_id UUID NOT NULL REFERENCES google_ads_connections(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL, -- 'full', 'incremental', 'metrics'
  status TEXT NOT NULL, -- 'success', 'partial', 'failed'
  campaigns_synced INTEGER DEFAULT 0,
  metrics_updated INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policy
ALTER TABLE google_ads_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access sync logs for their client's connections"
  ON google_ads_sync_logs
  FOR ALL
  USING (
    connection_id IN (
      SELECT id FROM google_ads_connections
      WHERE client_id IN (
        SELECT client_id FROM organization_memberships
        WHERE user_id = auth.uid()
      )
    )
  );
```

## API Routes

### Authentication Routes

#### POST /api/google/auth
Inicia o fluxo OAuth do Google Ads

**Request Body:**
```typescript
{
  clientId: string;
  redirectUri: string;
}
```

**Response:**
```typescript
{
  authUrl: string;
  state: string;
}
```

#### GET /api/google/callback
Callback do OAuth após autorização

**Query Parameters:**
- `code`: Authorization code
- `state`: State parameter para validação

**Response:**
```typescript
{
  success: boolean;
  connectionId: string;
  customerId: string;
}
```

### Campaign Routes

#### GET /api/google/campaigns
Lista campanhas do Google Ads

**Query Parameters:**
- `clientId`: UUID do cliente
- `status`: Filter por status (opcional)
- `dateFrom`: Data inicial (opcional)
- `dateTo`: Data final (opcional)

**Response:**
```typescript
{
  campaigns: GoogleAdsCampaign[];
  total: number;
  lastSync: Date;
}
```

#### GET /api/google/campaigns/[campaignId]
Detalhes de uma campanha específica

**Response:**
```typescript
{
  campaign: GoogleAdsCampaign;
  metrics: Metrics;
  historicalData: MetricsTimeSeries[];
}
```

### Sync Routes

#### POST /api/google/sync
Inicia sincronização manual

**Request Body:**
```typescript
{
  clientId: string;
  fullSync?: boolean;
}
```

**Response:**
```typescript
{
  syncId: string;
  status: 'started' | 'queued';
  estimatedTime: number; // seconds
}
```

#### GET /api/google/sync/status
Status da sincronização

**Query Parameters:**
- `clientId`: UUID do cliente

**Response:**
```typescript
{
  lastSync: Date;
  status: 'idle' | 'syncing' | 'error';
  progress?: number; // 0-100
  nextScheduledSync: Date;
}
```

### Unified Routes

#### GET /api/unified/metrics
Métricas agregadas de todas as plataformas

**Query Parameters:**
- `clientId`: UUID do cliente
- `dateFrom`: Data inicial
- `dateTo`: Data final
- `platforms`: Comma-separated list ('meta,google')

**Response:**
```typescript
{
  aggregated: AggregatedMetrics;
  byPlatform: PlatformMetrics[];
  comparison: PlatformComparison;
}
```

## UI Components

### Dashboard Components

#### UnifiedDashboard
**Location**: `src/app/dashboard/page.tsx`

- Exibe KPIs consolidados de ambas as plataformas
- Cards com métricas totais (spend, conversions, ROAS)
- Gráfico de comparação entre plataformas
- Indicadores de performance por plataforma
- Links rápidos para dashboards específicos

#### GoogleAdsDashboard
**Location**: `src/app/dashboard/google/page.tsx`

- Lista de campanhas do Google Ads
- Filtros por status, data, performance
- Métricas em tempo real
- Gráficos de tendência
- Botão de sincronização manual
- Prompt de conexão se não conectado

#### GoogleCampaignsList
**Location**: `src/components/google/campaigns-list.tsx`

- Tabela de campanhas com métricas
- Ordenação por colunas
- Paginação
- Status indicators
- Ações rápidas (view details, refresh)

#### GoogleConnectionButton
**Location**: `src/components/google/connect-google-button.tsx`

- Botão para iniciar OAuth flow
- Indicador de status da conexão
- Opção de reconectar se expirado
- Seleção de contas Google Ads

#### PlatformComparisonChart
**Location**: `src/components/unified/platform-comparison-chart.tsx`

- Gráfico comparativo Meta vs Google
- Métricas selecionáveis
- Período ajustável
- Export para imagem/PDF

### Sidebar Navigation Updates

**Location**: `src/components/dashboard/sidebar.tsx`

```typescript
// Estrutura do menu
const menuItems = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard
  },
  {
    title: 'Campanhas', // Meta Ads (existente)
    href: '/dashboard/meta',
    icon: Target
  },
  {
    title: 'Google Ads', // Novo
    href: '/dashboard/google',
    icon: GoogleIcon
  },
  {
    title: 'Insights', // Meta (existente)
    href: '/dashboard/analytics',
    icon: BarChart
  },
  {
    title: 'Insights Google', // Novo
    href: '/dashboard/analytics/google',
    icon: TrendingUp
  },
  // ... outros itens existentes
];
```

## Error Handling

### Google Ads API Errors

```typescript
class GoogleAdsErrorHandler {
  async handleError(error: GoogleAdsError): Promise<ErrorResponse> {
    switch (error.code) {
      case 'AUTHENTICATION_ERROR':
        // Tentar refresh token
        return await this.refreshAndRetry(error);
      
      case 'RATE_LIMIT_EXCEEDED':
        // Implementar exponential backoff
        return await this.retryWithBackoff(error);
      
      case 'INVALID_CUSTOMER_ID':
        // Erro de configuração
        return this.userError('ID de cliente inválido');
      
      case 'PERMISSION_DENIED':
        // Falta de permissões
        return this.userError('Permissões insuficientes na conta Google Ads');
      
      default:
        // Log e erro genérico
        logger.error('Google Ads API Error', error);
        return this.systemError('Erro ao comunicar com Google Ads');
    }
  }
}
```

### Token Refresh Strategy

```typescript
class TokenManager {
  async ensureValidToken(connectionId: string): Promise<string> {
    const connection = await this.getConnection(connectionId);
    
    if (this.isTokenExpired(connection.token_expires_at)) {
      const newTokens = await this.googleOAuth.refreshToken(
        connection.refresh_token
      );
      
      await this.updateTokens(connectionId, newTokens);
      return newTokens.access_token;
    }
    
    return connection.access_token;
  }
  
  private isTokenExpired(expiresAt: Date): boolean {
    // Refresh 5 minutos antes de expirar
    const bufferTime = 5 * 60 * 1000;
    return Date.now() >= (expiresAt.getTime() - bufferTime);
  }
}
```

## Testing Strategy

### Unit Tests

1. **Google Ads Client**
   - Mock Google Ads API responses
   - Test authentication flow
   - Test campaign data parsing
   - Test error handling

2. **Sync Service**
   - Test full sync logic
   - Test incremental sync
   - Test error recovery
   - Test data deduplication

3. **Aggregation Service**
   - Test metric calculations
   - Test platform comparison logic
   - Test data normalization

### Integration Tests

1. **OAuth Flow**
   - Test complete authorization flow
   - Test token refresh
   - Test error scenarios

2. **Data Sync**
   - Test end-to-end sync process
   - Test RLS policies
   - Test data isolation

3. **API Routes**
   - Test all endpoints
   - Test authentication
   - Test error responses

### E2E Tests

1. **Connection Flow**
   - User connects Google Ads account
   - System syncs campaigns
   - User views campaigns in dashboard

2. **Multi-Platform View**
   - User with both platforms connected
   - Views unified dashboard
   - Compares platform performance

## Security Considerations

### Token Storage

- Tokens armazenados criptografados no banco
- Uso de Supabase Vault para chaves de criptografia
- Tokens nunca expostos em logs ou responses

### API Key Management

- Developer token do Google Ads em variáveis de ambiente
- Rotação periódica de secrets
- Acesso restrito via RLS

### Data Isolation

- RLS policies em todas as tabelas Google Ads
- Validação de client_id em todas as queries
- Audit logs para acesso a dados sensíveis

## Performance Optimization

### Caching Strategy

```typescript
// Cache de métricas agregadas
const CACHE_TTL = {
  campaigns: 5 * 60, // 5 minutos
  metrics: 15 * 60, // 15 minutos
  aggregated: 10 * 60 // 10 minutos
};

class CacheService {
  async getCachedMetrics(key: string): Promise<Metrics | null> {
    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached);
    }
    return null;
  }
  
  async setCachedMetrics(key: string, data: Metrics, ttl: number): Promise<void> {
    await redis.setex(key, ttl, JSON.stringify(data));
  }
}
```

### Database Indexes

```sql
-- Índices para performance
CREATE INDEX idx_google_campaigns_client ON google_ads_campaigns(client_id);
CREATE INDEX idx_google_campaigns_status ON google_ads_campaigns(status);
CREATE INDEX idx_google_metrics_date ON google_ads_metrics(date DESC);
CREATE INDEX idx_google_connections_client ON google_ads_connections(client_id);
```

### Batch Operations

- Sync de campanhas em batches de 50
- Bulk insert de métricas
- Parallel processing de múltiplos clientes

## Migration Strategy

### Phase 1: Infrastructure
1. Criar tabelas do banco de dados
2. Implementar RLS policies
3. Setup de variáveis de ambiente

### Phase 2: Core Services
1. Implementar Google Ads Client
2. Implementar OAuth Service
3. Implementar Sync Service

### Phase 3: API Layer
1. Criar rotas de autenticação
2. Criar rotas de campanhas
3. Criar rotas de sync

### Phase 4: UI Components
1. Criar dashboard Google Ads
2. Atualizar dashboard unificado
3. Adicionar itens ao menu

### Phase 5: Testing & Polish
1. Testes de integração
2. Testes E2E
3. Ajustes de UX

## Monitoring and Observability

### Metrics to Track

- Taxa de sucesso de sync
- Tempo médio de sync
- Erros de API por tipo
- Token refresh rate
- Cache hit rate

### Logging Strategy

```typescript
logger.info('Google Ads sync started', {
  clientId,
  customerId,
  syncType: 'full'
});

logger.error('Google Ads API error', {
  clientId,
  errorCode: error.code,
  errorMessage: error.message,
  retryAttempt: 1
});
```

### Alerting

- Alert se sync falhar 3 vezes consecutivas
- Alert se taxa de erro > 10%
- Alert se token refresh falhar
- Alert se uso de API próximo do limite
