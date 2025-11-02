# Google Ads Integration - Technical Documentation

## Overview

Esta documentação técnica abrangente descreve a implementação completa da integração Google Ads no sistema de gerenciamento de campanhas multi-plataforma. Inclui arquitetura, APIs, banco de dados, segurança e procedimentos operacionais.

## Índice

1. [Arquitetura do Sistema](#arquitetura-do-sistema)
2. [Estrutura de Código](#estrutura-de-código)
3. [APIs e Endpoints](#apis-e-endpoints)
4. [Schema do Banco de Dados](#schema-do-banco-de-dados)
5. [Serviços Core](#serviços-core)
6. [Segurança e Autenticação](#segurança-e-autenticação)
7. [Sincronização de Dados](#sincronização-de-dados)
8. [Cache e Performance](#cache-e-performance)
9. [Monitoramento e Logs](#monitoramento-e-logs)
10. [Deployment e Configuração](#deployment-e-configuração)
11. [Troubleshooting](#troubleshooting)

## Arquitetura do Sistema

### Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                       │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Dashboard  │  │  Dashboard   │  │  Dashboard   │      │
│  │  Unificado   │  │  Meta Ads    │  │ Google Ads   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
├─────────────────────────────────────────────────────────────┤
│                     API Layer (Next.js)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Meta APIs   │  │ Google APIs  │  │ Unified APIs │      │
│  │  (existing)  │  │    (new)     │  │    (new)     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
├─────────────────────────────────────────────────────────────┤
│                   Service Layer                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Meta       │  │   Google     │  │  Aggregation │      │
│  │   Client     │  │   Client     │  │   Service    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
├─────────────────────────────────────────────────────────────┤
│                 Data Layer (Supabase)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Meta Tables │  │Google Tables │  │ Shared Tables│      │
│  │    (RLS)     │  │    (RLS)     │  │    (RLS)     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Princípios Arquiteturais

1. **Separação de Plataformas**: Cada plataforma (Meta/Google) tem seus próprios serviços e tabelas
2. **Isolamento de Dados**: RLS garante que cada cliente acesse apenas seus dados
3. **Agregação Unificada**: Serviços especializados combinam dados de múltiplas plataformas
4. **Escalabilidade**: Arquitetura permite adicionar novas plataformas facilmente
5. **Observabilidade**: Logs e métricas em todas as camadas

## Estrutura de Código

### Organização de Diretórios

```
src/
├── app/
│   ├── api/
│   │   ├── google/                 # APIs Google Ads
│   │   │   ├── auth/              # Autenticação OAuth
│   │   │   ├── callback/          # OAuth callback
│   │   │   ├── campaigns/         # Gestão de campanhas
│   │   │   ├── metrics/           # Métricas e analytics
│   │   │   ├── sync/              # Sincronização
│   │   │   └── monitoring/        # Monitoramento
│   │   ├── unified/               # APIs unificadas
│   │   │   ├── metrics/           # Métricas agregadas
│   │   │   ├── comparison/        # Comparação plataformas
│   │   │   └── insights/          # Insights consolidados
│   │   └── cron/
│   │       └── google-sync/       # Sync automático
│   ├── dashboard/
│   │   ├── google/                # Dashboard Google Ads
│   │   └── analytics/
│   │       └── google/            # Analytics Google
│   └── google/
│       └── select-accounts/       # Seleção de contas
├── components/
│   ├── google/                    # Componentes Google Ads
│   │   ├── connect-google-button.tsx
│   │   ├── campaigns-list.tsx
│   │   ├── campaign-details.tsx
│   │   ├── sync-status.tsx
│   │   ├── performance-chart.tsx
│   │   └── metrics-cards.tsx
│   └── unified/                   # Componentes unificados
│       ├── platform-comparison.tsx
│       └── unified-metrics-cards.tsx
├── lib/
│   ├── google/                    # Serviços Google Ads
│   │   ├── client.ts              # Google Ads API Client
│   │   ├── oauth.ts               # OAuth Service
│   │   ├── token-manager.ts       # Gerenciamento de tokens
│   │   ├── sync-service.ts        # Sincronização
│   │   ├── sync-queue-manager.ts  # Fila de sync
│   │   ├── error-handler.ts       # Tratamento de erros
│   │   ├── cache-service.ts       # Cache
│   │   └── monitoring.ts          # Monitoramento
│   ├── services/
│   │   ├── platform-aggregation.ts # Agregação multi-plataforma
│   │   └── export-service.ts      # Exportação de dados
│   └── repositories/
│       └── google-ads-repository.ts # Acesso a dados
└── types/
    ├── google-ads.ts              # Tipos Google Ads
    └── platform-aggregation.ts   # Tipos agregação
```

### Convenções de Nomenclatura

- **Arquivos**: kebab-case (`google-ads-client.ts`)
- **Classes**: PascalCase (`GoogleAdsClient`)
- **Funções**: camelCase (`getCampaigns`)
- **Constantes**: UPPER_SNAKE_CASE (`GOOGLE_ADS_API_VERSION`)
- **Tipos**: PascalCase (`GoogleAdsCampaign`)

## APIs e Endpoints

### Estrutura de Rotas

```
/api/google/
├── auth                    # POST - Iniciar OAuth
├── callback               # GET - Callback OAuth
├── disconnect             # POST - Desconectar conta
├── accounts/              # Gerenciamento de contas
│   ├── route             # GET - Listar contas
│   └── select            # POST - Selecionar contas
├── campaigns/             # Gerenciamento de campanhas
│   ├── route             # GET - Listar campanhas
│   └── [id]/             # GET - Detalhes campanha
├── metrics/               # GET - Métricas
├── sync/                  # Sincronização
│   ├── route             # POST - Sync manual
│   └── status/           # GET - Status sync
└── monitoring/            # Monitoramento
    ├── health            # GET - Health check
    ├── alerts            # GET - Alertas
    └── metrics           # GET - Métricas sistema

/api/unified/
├── metrics               # GET - Métricas agregadas
├── comparison           # GET - Comparação plataformas
├── insights             # GET - Insights consolidados
└── time-series          # GET - Dados temporais

/api/cron/
└── google-sync          # POST - Sync automático (Vercel Cron)
```

### Padrões de Request/Response

#### Request Headers Padrão
```typescript
{
  'Content-Type': 'application/json',
  'Authorization': 'Bearer <supabase_token>',
  'X-Client-ID': '<client_uuid>' // Para isolamento de dados
}
```

#### Response Format Padrão
```typescript
// Sucesso
{
  success: true,
  data: any,
  meta?: {
    total?: number,
    page?: number,
    limit?: number
  }
}

// Erro
{
  success: false,
  error: {
    code: string,
    message: string,
    details?: any
  }
}
```

### Autenticação e Autorização

Todas as APIs implementam:

1. **Supabase Auth**: Verificação de token JWT
2. **RLS Enforcement**: Isolamento automático por cliente
3. **Rate Limiting**: Proteção contra abuso
4. **Input Validation**: Validação com Zod schemas

## Schema do Banco de Dados

### Tabelas Principais

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
```

### Índices de Performance

```sql
-- Campanhas por cliente
CREATE INDEX idx_google_campaigns_client ON google_ads_campaigns(client_id);

-- Métricas por campanha e data
CREATE INDEX idx_google_metrics_campaign_date ON google_ads_metrics(campaign_id, date DESC);

-- Conexões por status
CREATE INDEX idx_google_connections_status ON google_ads_connections(status);

-- Sync logs por conexão
CREATE INDEX idx_google_sync_logs_connection_date ON google_ads_sync_logs(connection_id, started_at DESC);
```

### Row Level Security (RLS)

Todas as tabelas implementam RLS para isolamento de dados:

```sql
-- Exemplo: google_ads_campaigns
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

## Serviços Core

### GoogleAdsClient

**Localização**: `src/lib/google/client.ts`

```typescript
class GoogleAdsClient {
  private config: GoogleAdsClientConfig;
  
  constructor(config: GoogleAdsClientConfig) {
    this.config = config;
  }
  
  async getCampaigns(customerId: string): Promise<GoogleAdsCampaign[]>
  async getCampaignMetrics(campaignId: string, dateRange: DateRange): Promise<Metrics>
  async getAccountInfo(customerId: string): Promise<AccountInfo>
  
  private async makeRequest(endpoint: string, params: any): Promise<any>
  private handleApiError(error: any): never
}
```

**Responsabilidades**:
- Comunicação com Google Ads API
- Autenticação via OAuth tokens
- Tratamento de erros específicos da API
- Rate limiting e retry logic

### GoogleOAuthService

**Localização**: `src/lib/google/oauth.ts`

```typescript
class GoogleOAuthService {
  getAuthorizationUrl(state: string): string
  exchangeCodeForTokens(code: string): Promise<TokenResponse>
  refreshToken(refreshToken: string): Promise<TokenResponse>
  revokeToken(token: string): Promise<void>
  
  private validateState(state: string): boolean
  private generateState(): string
}
```

**Responsabilidades**:
- Gerenciamento do fluxo OAuth 2.0
- Geração e validação de state parameters
- Troca de authorization codes por tokens
- Refresh automático de tokens

### GoogleSyncService

**Localização**: `src/lib/google/sync-service.ts`

```typescript
class GoogleSyncService {
  async syncCampaigns(options: SyncOptions): Promise<SyncResult>
  async syncMetrics(campaignId: string, dateRange: DateRange): Promise<void>
  async scheduleSyncJob(clientId: string): Promise<void>
  async getLastSyncStatus(clientId: string): Promise<SyncStatus>
  
  private async processCampaignBatch(campaigns: GoogleAdsCampaign[]): Promise<void>
  private async handleSyncError(error: any, context: SyncContext): Promise<void>
}
```

**Responsabilidades**:
- Sincronização de campanhas e métricas
- Processamento em batches
- Retry logic com exponential backoff
- Logging de operações de sync

### PlatformAggregationService

**Localização**: `src/lib/services/platform-aggregation.ts`

```typescript
class PlatformAggregationService {
  async getAggregatedMetrics(clientId: string, dateRange: DateRange): Promise<AggregatedMetrics>
  async comparePlatforms(clientId: string, dateRange: DateRange): Promise<PlatformComparison>
  async getTopPerformingPlatform(clientId: string): Promise<'meta' | 'google' | null>
  
  private normalizeMetrics(metrics: any[], platform: string): NormalizedMetrics[]
  private calculateWeightedAverages(metrics: NormalizedMetrics[]): AggregatedMetrics
}
```

**Responsabilidades**:
- Agregação de dados de múltiplas plataformas
- Normalização de métricas entre plataformas
- Cálculos de comparação e performance
- Cache de dados agregados

## Segurança e Autenticação

### OAuth 2.0 Flow

1. **Authorization Request**: Cliente solicita autorização
2. **User Consent**: Usuário autoriza no Google
3. **Authorization Code**: Google retorna code via callback
4. **Token Exchange**: Sistema troca code por tokens
5. **Token Storage**: Tokens são criptografados e salvos
6. **Token Refresh**: Refresh automático antes da expiração

### Criptografia de Tokens

```typescript
// Exemplo de criptografia
class CryptoService {
  encrypt(data: string): string {
    const cipher = crypto.createCipher('aes-256-cbc', process.env.ENCRYPTION_KEY);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }
  
  decrypt(encryptedData: string): string {
    const decipher = crypto.createDecipher('aes-256-cbc', process.env.ENCRYPTION_KEY);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}
```

### Validação de Segurança

- **State Parameter**: Prevenção de CSRF attacks
- **Token Encryption**: Tokens nunca armazenados em plain text
- **RLS Policies**: Isolamento automático de dados
- **Input Validation**: Sanitização de todos os inputs
- **Rate Limiting**: Proteção contra abuso

## Sincronização de Dados

### Estratégia de Sync

1. **Sync Inicial**: Importa todas as campanhas e métricas dos últimos 30 dias
2. **Sync Incremental**: Atualiza apenas dados modificados
3. **Sync Automático**: Executa a cada 6 horas via Vercel Cron
4. **Sync Manual**: Disponível via dashboard para usuários

### Fila de Sincronização

```typescript
class SyncQueueManager {
  private queue: SyncJob[] = [];
  private processing: boolean = false;
  
  async addJob(job: SyncJob): Promise<void>
  async processQueue(): Promise<void>
  async retryFailedJobs(): Promise<void>
  
  private async processJob(job: SyncJob): Promise<SyncResult>
  private async handleJobFailure(job: SyncJob, error: any): Promise<void>
}
```

### Tratamento de Erros

- **Rate Limiting**: Exponential backoff automático
- **Authentication Errors**: Refresh de tokens automático
- **Network Errors**: Retry com timeout progressivo
- **Data Validation**: Validação antes de salvar no banco

## Cache e Performance

### Estratégia de Cache

```typescript
// TTL por tipo de dados
const CACHE_TTL = {
  campaigns: 5 * 60,      // 5 minutos
  metrics: 15 * 60,       // 15 minutos
  aggregated: 10 * 60,    // 10 minutos
  accounts: 30 * 60       // 30 minutos
};

class CacheService {
  async get<T>(key: string): Promise<T | null>
  async set<T>(key: string, data: T, ttl: number): Promise<void>
  async invalidate(pattern: string): Promise<void>
  async invalidateClient(clientId: string): Promise<void>
}
```

### Otimizações de Query

- **Índices Compostos**: Para queries frequentes
- **Paginação**: Limitação de resultados grandes
- **Agregações**: Pré-cálculo de métricas comuns
- **Connection Pooling**: Reutilização de conexões DB

### Batch Operations

```typescript
// Exemplo de batch insert
async function batchInsertMetrics(metrics: GoogleAdsMetric[]): Promise<void> {
  const batchSize = 100;
  const batches = chunk(metrics, batchSize);
  
  for (const batch of batches) {
    await supabase
      .from('google_ads_metrics')
      .upsert(batch, { onConflict: 'campaign_id,date' });
  }
}
```

## Monitoramento e Logs

### Estrutura de Logs

```typescript
interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  service: 'google-ads';
  operation: string;
  clientId?: string;
  customerId?: string;
  duration?: number;
  success: boolean;
  error?: string;
  metadata?: any;
}
```

### Métricas Coletadas

- **Sync Performance**: Taxa de sucesso, duração média
- **API Usage**: Requests por minuto, rate limit hits
- **Token Health**: Refresh rate, failures
- **Cache Performance**: Hit rate, miss rate
- **Error Rates**: Por tipo de erro, por cliente

### Alertas Configurados

```typescript
// Exemplos de alertas
const ALERTS = {
  SYNC_FAILURE_RATE: {
    threshold: 0.1, // 10%
    window: '1h',
    action: 'notify_admin'
  },
  TOKEN_REFRESH_FAILURE: {
    threshold: 3, // 3 falhas consecutivas
    window: '24h',
    action: 'disable_connection'
  },
  API_RATE_LIMIT: {
    threshold: 0.9, // 90% do limite
    window: '1h',
    action: 'throttle_requests'
  }
};
```

## Deployment e Configuração

### Variáveis de Ambiente

#### Obrigatórias
```bash
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_DEVELOPER_TOKEN=your_developer_token
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

#### Opcionais
```bash
GOOGLE_ADS_CACHE_TTL=900
GOOGLE_ADS_RATE_LIMIT_PER_MINUTE=1000
GOOGLE_ADS_BATCH_SIZE=50
GOOGLE_ADS_SYNC_INTERVAL_HOURS=6
GOOGLE_ADS_LOG_LEVEL=info
```

### Scripts de Deploy

```bash
# Aplicar schema do banco
node scripts/apply-google-ads-schema.js

# Validar configuração
node scripts/validate-google-env.js

# Deploy Vercel
vercel --prod

# Verificar health
curl https://your-domain.com/api/google/monitoring/health
```

### Checklist de Deploy

- [ ] Schema aplicado no banco de dados
- [ ] Variáveis de ambiente configuradas
- [ ] OAuth credentials configurados no Google Cloud
- [ ] Redirect URIs atualizados
- [ ] RLS policies ativas
- [ ] Cron jobs configurados
- [ ] Monitoramento ativo
- [ ] Alertas configurados

## Troubleshooting

### Problemas Comuns

#### 1. Erro de Autenticação
```bash
# Verificar tokens
SELECT customer_id, status, token_expires_at 
FROM google_ads_connections 
WHERE client_id = 'CLIENT_UUID';

# Forçar refresh
curl -X POST /api/google/auth/refresh \
  -d '{"clientId": "CLIENT_UUID"}'
```

#### 2. Sync Lento
```sql
-- Verificar syncs em andamento
SELECT * FROM google_ads_sync_logs 
WHERE status = 'syncing' 
AND started_at < NOW() - INTERVAL '30 minutes';
```

#### 3. Dados Inconsistentes
```sql
-- Verificar duplicatas
SELECT campaign_id, date, COUNT(*) 
FROM google_ads_metrics 
GROUP BY campaign_id, date 
HAVING COUNT(*) > 1;
```

### Comandos de Debug

```bash
# Logs em tempo real
tail -f logs/google-ads.log | grep "CLIENT_UUID"

# Status geral do sistema
node scripts/google-ads-health-check.js

# Forçar limpeza de cache
redis-cli FLUSHDB

# Verificar performance de queries
SELECT query, calls, mean_time 
FROM pg_stat_statements 
WHERE query LIKE '%google_ads_%' 
ORDER BY mean_time DESC;
```

### Escalação de Problemas

1. **Nível 1**: Problemas de usuário (reconexão, dados desatualizados)
2. **Nível 2**: Problemas técnicos (performance, sync failures)
3. **Nível 3**: Problemas de infraestrutura (rate limits, API changes)

## Manutenção e Operações

### Rotinas de Manutenção

#### Diária
- Limpeza de OAuth states expirados
- Verificação de tokens próximos ao vencimento
- Análise de logs de erro

#### Semanal
- Limpeza de logs antigos
- Análise de performance de queries
- Verificação de métricas de sistema

#### Mensal
- Revisão de alertas e thresholds
- Análise de uso de API
- Planejamento de capacidade

### Backup e Recovery

```bash
# Backup de configurações (sem tokens)
pg_dump --table=google_ads_connections \
        --data-only \
        --exclude-column=refresh_token \
        --exclude-column=access_token \
        > backup/google_connections.sql

# Backup de métricas
pg_dump --table=google_ads_metrics \
        --data-only \
        > backup/google_metrics.sql
```

### Monitoramento de Saúde

```sql
-- Query de health check
CREATE OR REPLACE FUNCTION google_ads_health_check()
RETURNS TABLE (
  component TEXT,
  status TEXT,
  details JSONB
) AS $
BEGIN
  -- Verificar conexões ativas
  RETURN QUERY
  SELECT 
    'connections'::TEXT,
    CASE WHEN COUNT(*) > 0 THEN 'healthy' ELSE 'warning' END::TEXT,
    jsonb_build_object('active_connections', COUNT(*))
  FROM google_ads_connections 
  WHERE status = 'active';
  
  -- Verificar syncs recentes
  RETURN QUERY
  SELECT 
    'sync_health'::TEXT,
    CASE 
      WHEN success_rate >= 0.9 THEN 'healthy'
      WHEN success_rate >= 0.7 THEN 'warning'
      ELSE 'critical'
    END::TEXT,
    jsonb_build_object('success_rate', success_rate, 'total_syncs', total_syncs)
  FROM (
    SELECT 
      COUNT(*) FILTER (WHERE status = 'success')::FLOAT / COUNT(*) as success_rate,
      COUNT(*) as total_syncs
    FROM google_ads_sync_logs 
    WHERE started_at >= NOW() - INTERVAL '24 hours'
  ) stats;
END;
$ LANGUAGE plpgsql;
```

## Recursos Adicionais

### Documentação Externa
- [Google Ads API Documentation](https://developers.google.com/google-ads/api/docs)
- [OAuth 2.0 Guide](https://developers.google.com/identity/protocols/oauth2)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)

### Ferramentas de Desenvolvimento
- [Google Ads API Explorer](https://developers.google.com/google-ads/api/rest/reference)
- [OAuth 2.0 Playground](https://developers.google.com/oauthplayground)
- [Supabase SQL Editor](https://app.supabase.com)

### Contato e Suporte
- **Documentação**: Consulte este documento e guias específicos
- **Logs**: Verifique logs de aplicação e banco de dados
- **Monitoramento**: Use dashboards de métricas e alertas
- **Escalação**: Siga procedimentos de escalação por nível

---

**Última Atualização**: Dezembro 2024  
**Versão**: 1.0  
**Mantenedores**: Equipe de Desenvolvimento