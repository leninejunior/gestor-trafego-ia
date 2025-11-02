# Google Ads Database Schema Documentation

## Overview

Esta documentação descreve o schema completo do banco de dados para a integração Google Ads, incluindo todas as tabelas, relacionamentos, índices e políticas RLS.

## Diagrama de Relacionamentos

```
┌─────────────────┐    ┌──────────────────────┐    ┌─────────────────────┐
│     clients     │    │ google_ads_connections│    │ google_ads_campaigns│
│                 │    │                      │    │                     │
│ id (PK)         │◄───┤ client_id (FK)       │◄───┤ connection_id (FK)  │
│ name            │    │ customer_id          │    │ campaign_id         │
│ organization_id │    │ refresh_token        │    │ campaign_name       │
│                 │    │ access_token         │    │ status              │
└─────────────────┘    │ token_expires_at     │    │ budget_amount       │
                       │ last_sync_at         │    └─────────────────────┘
                       │ status               │              │
                       └──────────────────────┘              │
                                 │                           │
                                 │                           ▼
                       ┌──────────────────────┐    ┌─────────────────────┐
                       │ google_ads_sync_logs │    │ google_ads_metrics  │
                       │                      │    │                     │
                       │ connection_id (FK)   │    │ campaign_id (FK)    │
                       │ sync_type            │    │ date                │
                       │ status               │    │ impressions         │
                       │ campaigns_synced     │    │ clicks              │
                       │ error_message        │    │ conversions         │
                       └──────────────────────┘    │ cost                │
                                                   │ ctr                 │
                                                   │ conversion_rate     │
                                                   └─────────────────────┘
```

## Tabelas Principais

### google_ads_connections

Armazena as conexões OAuth com contas Google Ads.

```sql
CREATE TABLE google_ads_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL,
  refresh_token TEXT NOT NULL, -- encrypted
  access_token TEXT, -- encrypted
  token_expires_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(client_id, customer_id),
  CONSTRAINT valid_token_expiry CHECK (
    (access_token IS NULL AND token_expires_at IS NULL) OR
    (access_token IS NOT NULL AND token_expires_at IS NOT NULL)
  )
);

-- Índices
CREATE INDEX idx_google_connections_client ON google_ads_connections(client_id);
CREATE INDEX idx_google_connections_status ON google_ads_connections(status);
CREATE INDEX idx_google_connections_sync ON google_ads_connections(last_sync_at);

-- Trigger para updated_at
CREATE TRIGGER update_google_connections_updated_at
  BEFORE UPDATE ON google_ads_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

**Campos:**
- `id`: Identificador único da conexão
- `client_id`: Referência ao cliente (FK)
- `customer_id`: ID da conta Google Ads
- `refresh_token`: Token de refresh criptografado
- `access_token`: Token de acesso criptografado
- `token_expires_at`: Data de expiração do access token
- `last_sync_at`: Timestamp da última sincronização
- `status`: Status da conexão (active, expired, revoked)

### google_ads_campaigns

Armazena informações das campanhas Google Ads.

```sql
CREATE TABLE google_ads_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES google_ads_connections(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ENABLED', 'PAUSED', 'REMOVED')),
  budget_amount DECIMAL(10, 2),
  budget_currency TEXT DEFAULT 'USD',
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(connection_id, campaign_id),
  CONSTRAINT valid_budget CHECK (budget_amount >= 0),
  CONSTRAINT valid_dates CHECK (end_date IS NULL OR end_date >= start_date)
);

-- Índices
CREATE INDEX idx_google_campaigns_client ON google_ads_campaigns(client_id);
CREATE INDEX idx_google_campaigns_connection ON google_ads_campaigns(connection_id);
CREATE INDEX idx_google_campaigns_status ON google_ads_campaigns(status);
CREATE INDEX idx_google_campaigns_name ON google_ads_campaigns(campaign_name);

-- Trigger para updated_at
CREATE TRIGGER update_google_campaigns_updated_at
  BEFORE UPDATE ON google_ads_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

**Campos:**
- `id`: Identificador único interno
- `client_id`: Referência ao cliente (FK)
- `connection_id`: Referência à conexão Google Ads (FK)
- `campaign_id`: ID da campanha no Google Ads
- `campaign_name`: Nome da campanha
- `status`: Status da campanha (ENABLED, PAUSED, REMOVED)
- `budget_amount`: Valor do orçamento
- `budget_currency`: Moeda do orçamento
- `start_date`: Data de início da campanha
- `end_date`: Data de fim da campanha (opcional)

### google_ads_metrics

Armazena métricas diárias das campanhas.

```sql
CREATE TABLE google_ads_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES google_ads_campaigns(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  conversions DECIMAL(10, 2) DEFAULT 0,
  cost DECIMAL(10, 2) DEFAULT 0,
  ctr DECIMAL(5, 2), -- Click-through rate
  conversion_rate DECIMAL(5, 2),
  cpc DECIMAL(10, 2), -- Cost per click
  cpa DECIMAL(10, 2), -- Cost per acquisition
  roas DECIMAL(10, 2), -- Return on ad spend
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(campaign_id, date),
  CONSTRAINT valid_metrics CHECK (
    impressions >= 0 AND 
    clicks >= 0 AND 
    conversions >= 0 AND 
    cost >= 0
  ),
  CONSTRAINT valid_rates CHECK (
    (ctr IS NULL OR ctr >= 0) AND
    (conversion_rate IS NULL OR conversion_rate >= 0) AND
    (cpc IS NULL OR cpc >= 0) AND
    (cpa IS NULL OR cpa >= 0)
  )
);

-- Índices para performance
CREATE INDEX idx_google_metrics_campaign_date ON google_ads_metrics(campaign_id, date DESC);
CREATE INDEX idx_google_metrics_date ON google_ads_metrics(date DESC);
CREATE INDEX idx_google_metrics_cost ON google_ads_metrics(cost DESC);

-- Trigger para updated_at
CREATE TRIGGER update_google_metrics_updated_at
  BEFORE UPDATE ON google_ads_metrics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

**Campos:**
- `id`: Identificador único
- `campaign_id`: Referência à campanha (FK)
- `date`: Data das métricas
- `impressions`: Número de impressões
- `clicks`: Número de cliques
- `conversions`: Número de conversões
- `cost`: Custo total
- `ctr`: Taxa de cliques (%)
- `conversion_rate`: Taxa de conversão (%)
- `cpc`: Custo por clique
- `cpa`: Custo por aquisição
- `roas`: Retorno sobre investimento em anúncios

### google_ads_sync_logs

Registra logs de sincronização para auditoria e debugging.

```sql
CREATE TABLE google_ads_sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  connection_id UUID NOT NULL REFERENCES google_ads_connections(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL CHECK (sync_type IN ('full', 'incremental', 'metrics')),
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
  campaigns_synced INTEGER DEFAULT 0,
  metrics_updated INTEGER DEFAULT 0,
  error_message TEXT,
  error_code TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_sync_counts CHECK (
    campaigns_synced >= 0 AND 
    metrics_updated >= 0
  ),
  CONSTRAINT valid_completion CHECK (
    (status = 'failed' AND completed_at IS NULL) OR
    (status IN ('success', 'partial') AND completed_at IS NOT NULL)
  )
);

-- Índices
CREATE INDEX idx_google_sync_logs_connection ON google_ads_sync_logs(connection_id);
CREATE INDEX idx_google_sync_logs_status ON google_ads_sync_logs(status);
CREATE INDEX idx_google_sync_logs_date ON google_ads_sync_logs(started_at DESC);

-- Índice composto para queries de status recente
CREATE INDEX idx_google_sync_logs_connection_date ON google_ads_sync_logs(connection_id, started_at DESC);
```

**Campos:**
- `id`: Identificador único do log
- `connection_id`: Referência à conexão (FK)
- `sync_type`: Tipo de sincronização (full, incremental, metrics)
- `status`: Status do sync (success, partial, failed)
- `campaigns_synced`: Número de campanhas sincronizadas
- `metrics_updated`: Número de métricas atualizadas
- `error_message`: Mensagem de erro (se houver)
- `error_code`: Código do erro (se houver)
- `started_at`: Timestamp de início
- `completed_at`: Timestamp de conclusão

## Tabelas de Suporte

### oauth_states

Armazena states temporários para validação OAuth.

```sql
CREATE TABLE oauth_states (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  state_value TEXT NOT NULL UNIQUE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'google',
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraint para expiração
  CONSTRAINT valid_expiry CHECK (expires_at > created_at)
);

-- Índices
CREATE INDEX idx_oauth_states_value ON oauth_states(state_value);
CREATE INDEX idx_oauth_states_expires ON oauth_states(expires_at);

-- Cleanup automático de states expirados
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states()
RETURNS void AS $$
BEGIN
  DELETE FROM oauth_states 
  WHERE expires_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;
```

## Row Level Security (RLS)

### Políticas de Segurança

Todas as tabelas Google Ads implementam RLS para isolamento de dados por cliente.

```sql
-- Habilitar RLS em todas as tabelas
ALTER TABLE google_ads_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;

-- Política para google_ads_connections
CREATE POLICY "Users can only access their client's Google connections"
  ON google_ads_connections
  FOR ALL
  USING (
    client_id IN (
      SELECT client_id FROM organization_memberships
      WHERE user_id = auth.uid()
    )
  );

-- Política para google_ads_campaigns
CREATE POLICY "Users can only access their client's Google campaigns"
  ON google_ads_campaigns
  FOR ALL
  USING (
    client_id IN (
      SELECT client_id FROM organization_memberships
      WHERE user_id = auth.uid()
    )
  );

-- Política para google_ads_metrics
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

-- Política para google_ads_sync_logs
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

-- Política para oauth_states
CREATE POLICY "Users can only access their own OAuth states"
  ON oauth_states
  FOR ALL
  USING (
    client_id IN (
      SELECT client_id FROM organization_memberships
      WHERE user_id = auth.uid()
    )
  );
```

## Funções e Triggers

### Função para Updated At

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Função para Limpeza de Dados

```sql
-- Limpeza de métricas antigas baseada no plano
CREATE OR REPLACE FUNCTION cleanup_old_google_metrics()
RETURNS void AS $$
DECLARE
  retention_days INTEGER;
  client_record RECORD;
BEGIN
  FOR client_record IN 
    SELECT DISTINCT c.id, c.subscription_plan
    FROM clients c
    INNER JOIN google_ads_connections gac ON gac.client_id = c.id
  LOOP
    -- Determinar período de retenção baseado no plano
    CASE client_record.subscription_plan
      WHEN 'basic' THEN retention_days := 30;
      WHEN 'pro' THEN retention_days := 90;
      WHEN 'enterprise' THEN retention_days := 365;
      ELSE retention_days := 30;
    END CASE;
    
    -- Deletar métricas antigas
    DELETE FROM google_ads_metrics
    WHERE campaign_id IN (
      SELECT id FROM google_ads_campaigns 
      WHERE client_id = client_record.id
    )
    AND date < CURRENT_DATE - INTERVAL '1 day' * retention_days;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
```

### Função para Estatísticas de Sync

```sql
CREATE OR REPLACE FUNCTION get_google_sync_stats(p_client_id UUID)
RETURNS TABLE (
  total_syncs BIGINT,
  successful_syncs BIGINT,
  failed_syncs BIGINT,
  last_sync_at TIMESTAMPTZ,
  avg_sync_duration INTERVAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_syncs,
    COUNT(*) FILTER (WHERE status = 'success') as successful_syncs,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_syncs,
    MAX(completed_at) as last_sync_at,
    AVG(completed_at - started_at) as avg_sync_duration
  FROM google_ads_sync_logs gsl
  INNER JOIN google_ads_connections gac ON gac.id = gsl.connection_id
  WHERE gac.client_id = p_client_id
    AND gsl.started_at >= CURRENT_DATE - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;
```

## Views Úteis

### View de Campanhas com Métricas Recentes

```sql
CREATE VIEW google_campaigns_with_recent_metrics AS
SELECT 
  c.id,
  c.client_id,
  c.campaign_id,
  c.campaign_name,
  c.status,
  c.budget_amount,
  c.budget_currency,
  m.date as last_metric_date,
  m.impressions,
  m.clicks,
  m.conversions,
  m.cost,
  m.ctr,
  m.roas
FROM google_ads_campaigns c
LEFT JOIN LATERAL (
  SELECT *
  FROM google_ads_metrics
  WHERE campaign_id = c.id
  ORDER BY date DESC
  LIMIT 1
) m ON true;
```

### View de Status de Conexões

```sql
CREATE VIEW google_connection_status AS
SELECT 
  c.id,
  c.client_id,
  c.customer_id,
  c.status,
  c.last_sync_at,
  c.token_expires_at,
  CASE 
    WHEN c.token_expires_at < NOW() THEN 'expired'
    WHEN c.token_expires_at < NOW() + INTERVAL '1 day' THEN 'expiring_soon'
    ELSE 'valid'
  END as token_status,
  COUNT(camp.id) as total_campaigns,
  COUNT(camp.id) FILTER (WHERE camp.status = 'ENABLED') as active_campaigns,
  MAX(sl.started_at) as last_sync_attempt,
  sl.status as last_sync_status
FROM google_ads_connections c
LEFT JOIN google_ads_campaigns camp ON camp.connection_id = c.id
LEFT JOIN LATERAL (
  SELECT status, started_at
  FROM google_ads_sync_logs
  WHERE connection_id = c.id
  ORDER BY started_at DESC
  LIMIT 1
) sl ON true
GROUP BY c.id, c.client_id, c.customer_id, c.status, c.last_sync_at, 
         c.token_expires_at, sl.status, sl.started_at;
```

## Índices de Performance

### Índices Compostos para Queries Comuns

```sql
-- Para queries de métricas por período
CREATE INDEX idx_google_metrics_campaign_date_cost 
ON google_ads_metrics(campaign_id, date DESC, cost DESC);

-- Para agregações por cliente
CREATE INDEX idx_google_campaigns_client_status 
ON google_ads_campaigns(client_id, status) 
WHERE status = 'ENABLED';

-- Para queries de sync recente
CREATE INDEX idx_google_sync_recent 
ON google_ads_sync_logs(connection_id, started_at DESC, status)
WHERE started_at >= CURRENT_DATE - INTERVAL '7 days';
```

## Backup e Manutenção

### Estratégia de Backup

```sql
-- Backup incremental de métricas (diário)
CREATE OR REPLACE FUNCTION backup_google_metrics_incremental()
RETURNS void AS $$
BEGIN
  -- Exportar métricas do dia anterior
  COPY (
    SELECT * FROM google_ads_metrics 
    WHERE date = CURRENT_DATE - INTERVAL '1 day'
  ) TO '/backup/google_metrics_' || TO_CHAR(CURRENT_DATE - INTERVAL '1 day', 'YYYY-MM-DD') || '.csv' 
  WITH CSV HEADER;
END;
$$ LANGUAGE plpgsql;
```

### Manutenção Automática

```sql
-- Job de limpeza semanal
CREATE OR REPLACE FUNCTION weekly_google_maintenance()
RETURNS void AS $$
BEGIN
  -- Limpar OAuth states expirados
  PERFORM cleanup_expired_oauth_states();
  
  -- Limpar métricas antigas
  PERFORM cleanup_old_google_metrics();
  
  -- Atualizar estatísticas das tabelas
  ANALYZE google_ads_connections;
  ANALYZE google_ads_campaigns;
  ANALYZE google_ads_metrics;
  ANALYZE google_ads_sync_logs;
  
  -- Log da manutenção
  INSERT INTO system_maintenance_logs (operation, status, completed_at)
  VALUES ('google_ads_weekly_cleanup', 'success', NOW());
END;
$$ LANGUAGE plpgsql;
```

## Monitoramento de Performance

### Queries de Diagnóstico

```sql
-- Verificar performance de queries
SELECT 
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation
FROM pg_stats 
WHERE schemaname = 'public' 
  AND tablename LIKE 'google_ads_%'
ORDER BY tablename, attname;

-- Verificar uso de índices
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE schemaname = 'public' 
  AND tablename LIKE 'google_ads_%'
ORDER BY idx_scan DESC;
```

### Alertas de Performance

```sql
-- Detectar tabelas com muitas rows sem índice adequado
CREATE OR REPLACE FUNCTION check_google_table_performance()
RETURNS TABLE (
  table_name TEXT,
  row_count BIGINT,
  seq_scan BIGINT,
  seq_tup_read BIGINT,
  idx_scan BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.tablename::TEXT,
    t.n_tup_ins + t.n_tup_upd as row_count,
    t.seq_scan,
    t.seq_tup_read,
    COALESCE(i.idx_scan, 0) as idx_scan
  FROM pg_stat_user_tables t
  LEFT JOIN (
    SELECT 
      tablename,
      SUM(idx_scan) as idx_scan
    FROM pg_stat_user_indexes
    WHERE schemaname = 'public'
    GROUP BY tablename
  ) i ON i.tablename = t.tablename
  WHERE t.schemaname = 'public'
    AND t.tablename LIKE 'google_ads_%'
    AND t.seq_scan > t.n_tup_ins * 0.1; -- Mais de 10% de seq scans
END;
$$ LANGUAGE plpgsql;
```