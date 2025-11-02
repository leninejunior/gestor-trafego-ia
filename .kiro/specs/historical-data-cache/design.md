# Design Document - Sistema de Cache de Dados Históricos Multi-Plataforma

## Overview

Sistema de cache de dados históricos configurável por plano de assinatura, preparado para suportar múltiplas plataformas de anúncios (Meta Ads e Google Ads). O sistema permite que administradores configurem limites personalizados de retenção, sincronização e recursos por plano, otimizando custos de API e garantindo performance.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Admin Panel                              │
│  - Configuração de Planos                                    │
│  - Limites de Recursos                                       │
│  - Monitoramento de Uso                                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Plan Configuration Service                  │
│  - Gerencia limites por plano                               │
│  - Valida configurações                                      │
│  - Aplica regras de negócio                                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Multi-Platform Sync Engine                 │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │  Meta Ads Sync   │  │ Google Ads Sync  │                │
│  │  - OAuth 2.0     │  │ - OAuth 2.0      │                │
│  │  - Marketing API │  │ - Ads API        │                │
│  └──────────────────┘  └──────────────────┘                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Historical Data Cache (Supabase)                │
│  - Particionamento por mês                                   │
│  - Índices otimizados                                        │
│  - RLS por cliente                                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Hybrid Data Service                       │
│  - Últimos 7 dias: API em tempo real                        │
│  - 8+ dias: Cache histórico                                 │
│  - Fallback automático                                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Dashboard UI                            │
│  - Visualização de métricas                                 │
│  - Indicadores de limites                                   │
│  - Exportação de dados                                      │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Plan Configuration Service

**Responsabilidade**: Gerenciar configurações de limites por plano

```typescript
interface PlanLimits {
  id: string;
  plan_id: string;
  
  // Limites de recursos
  max_clients: number;           // -1 = ilimitado
  max_campaigns_per_client: number; // -1 = ilimitado
  
  // Cache e retenção
  data_retention_days: number;   // 30-3650 dias
  sync_interval_hours: number;   // 1-168 horas
  
  // Exportação
  allow_csv_export: boolean;
  allow_json_export: boolean;
  
  // Metadados
  created_at: timestamp;
  updated_at: timestamp;
}

class PlanConfigurationService {
  async getPlanLimits(planId: string): Promise<PlanLimits>
  async updatePlanLimits(planId: string, limits: Partial<PlanLimits>): Promise<PlanLimits>
  async validateLimits(limits: Partial<PlanLimits>): Promise<ValidationResult>
  async getUserPlanLimits(userId: string): Promise<PlanLimits>
}
```

### 2. Multi-Platform Sync Engine

**Responsabilidade**: Sincronizar dados de múltiplas plataformas de anúncios

```typescript
enum AdPlatform {
  META = 'meta',
  GOOGLE = 'google'
}

interface SyncConfig {
  platform: AdPlatform;
  client_id: string;
  account_id: string;
  access_token: string;
  last_sync: timestamp;
  next_sync: timestamp;
}

interface CampaignInsight {
  id: string;
  platform: AdPlatform;
  client_id: string;
  campaign_id: string;
  campaign_name: string;
  date: date;
  
  // Métricas universais
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  
  // Métricas calculadas
  ctr: number;
  cpc: number;
  cpm: number;
  conversion_rate: number;
  
  // Metadados
  is_deleted: boolean;
  synced_at: timestamp;
}

abstract class BaseSyncAdapter {
  abstract platform: AdPlatform;
  abstract authenticate(credentials: any): Promise<void>;
  abstract fetchCampaigns(accountId: string): Promise<Campaign[]>;
  abstract fetchInsights(campaignId: string, dateRange: DateRange): Promise<CampaignInsight[]>;
  abstract validateConnection(): Promise<boolean>;
}

class MetaAdsSyncAdapter extends BaseSyncAdapter {
  platform = AdPlatform.META;
  // Implementação específica Meta Ads
}

class GoogleAdsSyncAdapter extends BaseSyncAdapter {
  platform = AdPlatform.GOOGLE;
  // Implementação específica Google Ads
}

class MultiPlatformSyncEngine {
  private adapters: Map<AdPlatform, BaseSyncAdapter>;
  
  async syncClient(clientId: string, platform: AdPlatform): Promise<SyncResult>
  async scheduleSyncJobs(): Promise<void>
  async getNextSyncTime(clientId: string): Promise<timestamp>
}
```

### 3. Historical Data Repository

**Responsabilidade**: Armazenar e recuperar dados históricos

```typescript
interface DataQuery {
  client_id: string;
  platform?: AdPlatform;
  campaign_ids?: string[];
  date_from: date;
  date_to: date;
  metrics?: string[];
}

class HistoricalDataRepository {
  async storeInsights(insights: CampaignInsight[]): Promise<void>
  async queryInsights(query: DataQuery): Promise<CampaignInsight[]>
  async deleteExpiredData(retentionDays: number): Promise<number>
  async getStorageStats(clientId: string): Promise<StorageStats>
}
```

### 4. Hybrid Data Service

**Responsabilidade**: Combinar dados de cache e API em tempo real

```typescript
interface DataSource {
  source: 'cache' | 'api';
  data: CampaignInsight[];
  cached_at?: timestamp;
}

class HybridDataService {
  async getData(query: DataQuery): Promise<DataSource>
  async refreshRecentData(clientId: string): Promise<void>
  async validateDataFreshness(data: CampaignInsight[]): Promise<boolean>
}
```

### 5. Feature Gate Integration

**Responsabilidade**: Validar limites e permissões por plano

```typescript
class CacheFeatureGate {
  async checkDataRetention(userId: string, requestedDays: number): Promise<boolean>
  async checkClientLimit(userId: string): Promise<{ allowed: boolean; current: number; limit: number }>
  async checkCampaignLimit(clientId: string): Promise<{ allowed: boolean; current: number; limit: number }>
  async checkExportPermission(userId: string, format: 'csv' | 'json'): Promise<boolean>
}
```

## Data Models

### Database Schema

```sql
-- Extensão da tabela subscription_plans
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS plan_limits JSONB;

-- Tabela de configuração de limites por plano
CREATE TABLE plan_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
  
  -- Limites de recursos
  max_clients INTEGER NOT NULL DEFAULT 5,
  max_campaigns_per_client INTEGER NOT NULL DEFAULT 25,
  
  -- Cache e retenção
  data_retention_days INTEGER NOT NULL DEFAULT 90 CHECK (data_retention_days BETWEEN 30 AND 3650),
  sync_interval_hours INTEGER NOT NULL DEFAULT 24 CHECK (sync_interval_hours BETWEEN 1 AND 168),
  
  -- Exportação
  allow_csv_export BOOLEAN NOT NULL DEFAULT false,
  allow_json_export BOOLEAN NOT NULL DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(plan_id)
);

-- Tabela de dados históricos multi-plataforma (particionada por mês)
CREATE TABLE campaign_insights_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Identificação
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('meta', 'google')),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  campaign_id VARCHAR(255) NOT NULL,
  campaign_name VARCHAR(500) NOT NULL,
  date DATE NOT NULL,
  
  -- Métricas universais
  impressions BIGINT NOT NULL DEFAULT 0,
  clicks BIGINT NOT NULL DEFAULT 0,
  spend DECIMAL(12,2) NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  
  -- Métricas calculadas
  ctr DECIMAL(5,2),
  cpc DECIMAL(8,2),
  cpm DECIMAL(8,2),
  conversion_rate DECIMAL(5,2),
  
  -- Metadados
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Índices compostos
  UNIQUE(platform, client_id, campaign_id, date)
) PARTITION BY RANGE (date);

-- Criar partições mensais (exemplo para 2025)
CREATE TABLE campaign_insights_history_2025_01 PARTITION OF campaign_insights_history
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE campaign_insights_history_2025_02 PARTITION OF campaign_insights_history
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

-- Índices otimizados
CREATE INDEX idx_insights_client_date ON campaign_insights_history(client_id, date DESC);
CREATE INDEX idx_insights_platform_campaign ON campaign_insights_history(platform, campaign_id);
CREATE INDEX idx_insights_date_range ON campaign_insights_history(date) WHERE NOT is_deleted;

-- Tabela de configuração de sincronização
CREATE TABLE sync_configurations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('meta', 'google')),
  account_id VARCHAR(255) NOT NULL,
  
  -- OAuth
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  
  -- Sincronização
  last_sync_at TIMESTAMPTZ,
  next_sync_at TIMESTAMPTZ,
  sync_status VARCHAR(20) DEFAULT 'pending',
  last_error TEXT,
  
  -- Metadados
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(client_id, platform, account_id)
);

CREATE INDEX idx_sync_next_sync ON sync_configurations(next_sync_at) WHERE sync_status = 'active';

-- Tabela de logs de sincronização
CREATE TABLE sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sync_config_id UUID NOT NULL REFERENCES sync_configurations(id) ON DELETE CASCADE,
  
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL,
  
  records_synced INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  error_message TEXT,
  
  -- Metadados
  duration_ms INTEGER,
  api_calls_made INTEGER
);

CREATE INDEX idx_sync_logs_config ON sync_logs(sync_config_id, started_at DESC);
```

### RLS Policies

```sql
-- RLS para plan_limits (apenas admins)
ALTER TABLE plan_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage plan limits"
  ON plan_limits
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

-- RLS para campaign_insights_history
ALTER TABLE campaign_insights_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their client insights"
  ON campaign_insights_history
  FOR SELECT
  USING (
    client_id IN (
      SELECT c.id FROM clients c
      INNER JOIN memberships m ON m.organization_id = c.organization_id
      WHERE m.user_id = auth.uid()
    )
  );

-- RLS para sync_configurations
ALTER TABLE sync_configurations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their client sync configs"
  ON sync_configurations
  FOR ALL
  USING (
    client_id IN (
      SELECT c.id FROM clients c
      INNER JOIN memberships m ON m.organization_id = c.organization_id
      WHERE m.user_id = auth.uid()
    )
  );
```

## Error Handling

### Estratégias de Erro

1. **API Rate Limiting**
   - Implementar exponential backoff
   - Queue de retry com prioridade
   - Fallback para dados em cache

2. **Token Expiration**
   - Refresh automático de tokens
   - Notificação ao usuário se refresh falhar
   - Desabilitar sync até reautenticação

3. **Data Inconsistency**
   - Validação de dados antes de armazenar
   - Logs detalhados de erros
   - Reconciliação periódica

4. **Storage Limits**
   - Monitoramento de uso de storage
   - Alertas quando atingir 80% do limite
   - Limpeza automática de dados expirados

### Error Response Format

```typescript
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    retry_after?: number;
  };
}

// Códigos de erro
enum ErrorCode {
  PLAN_LIMIT_EXCEEDED = 'PLAN_LIMIT_EXCEEDED',
  DATA_RETENTION_EXCEEDED = 'DATA_RETENTION_EXCEEDED',
  SYNC_FAILED = 'SYNC_FAILED',
  API_RATE_LIMIT = 'API_RATE_LIMIT',
  INVALID_TOKEN = 'INVALID_TOKEN',
  EXPORT_NOT_ALLOWED = 'EXPORT_NOT_ALLOWED'
}
```

## Testing Strategy

### Unit Tests

1. **Plan Configuration Service**
   - Validação de limites
   - Cálculo de retenção
   - Aplicação de regras

2. **Sync Adapters**
   - Autenticação
   - Transformação de dados
   - Tratamento de erros

3. **Feature Gate**
   - Verificação de limites
   - Permissões de exportação

### Integration Tests

1. **End-to-End Sync Flow**
   - Meta Ads → Cache → Dashboard
   - Google Ads → Cache → Dashboard

2. **Hybrid Data Service**
   - Combinação cache + API
   - Fallback scenarios

3. **Data Retention**
   - Limpeza automática
   - Particionamento

### Performance Tests

1. **Query Performance**
   - Queries com 90 dias de dados
   - Queries com múltiplas campanhas
   - Agregações complexas

2. **Sync Performance**
   - Sincronização de 100+ campanhas
   - Processamento em lote
   - Concorrência

## Implementation Notes

### Fase 1: Infraestrutura Base
- Schema de banco de dados
- Plan Configuration Service
- Feature Gate Integration

### Fase 2: Meta Ads Sync
- Meta Ads Sync Adapter
- Historical Data Repository
- Cron Jobs

### Fase 3: Google Ads Sync
- Google Ads Sync Adapter
- Unificação de métricas
- Testes de integração

### Fase 4: Hybrid Data Service
- Lógica de cache vs API
- Otimizações de performance
- Monitoramento

### Fase 5: Admin Panel & UI
- Interface de configuração de planos
- Dashboard com indicadores de limites
- Exportação de dados

## Performance Considerations

1. **Database Optimization**
   - Particionamento mensal automático
   - Índices compostos otimizados
   - Materialized views para agregações

2. **Caching Strategy**
   - Redis para dados frequentes
   - Cache de configurações de plano
   - Invalidação inteligente

3. **API Optimization**
   - Batch requests quando possível
   - Parallel sync para múltiplos clientes
   - Rate limiting inteligente

4. **Query Optimization**
   - Limit de 90 dias por query
   - Paginação de resultados
   - Agregações no banco

## Security Considerations

1. **Token Storage**
   - Criptografia de access tokens
   - Rotação automática
   - Vault para secrets

2. **Data Isolation**
   - RLS em todas as tabelas
   - Validação de client_id
   - Audit logs

3. **API Security**
   - Rate limiting por usuário
   - Validação de permissões
   - CORS configurado

## Monitoring & Observability

1. **Métricas**
   - Taxa de sucesso de sync
   - Tempo médio de sync
   - Uso de storage por cliente
   - API calls por plataforma

2. **Alertas**
   - Falhas consecutivas de sync
   - Storage acima de 80%
   - Tokens expirados
   - Performance degradada

3. **Logs**
   - Sync logs detalhados
   - Error tracking
   - Audit trail de configurações
