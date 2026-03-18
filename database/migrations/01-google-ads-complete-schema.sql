-- ============================================================================
-- GOOGLE ADS SCHEMA COMPLETO - Execute DEPOIS do 00-complete-base-schema.sql
-- ============================================================================
-- Este script cria todas as tabelas do Google Ads com RLS e criptografia
-- Requer: organizations, memberships, clients já criadas
-- ============================================================================

-- 1. TABELA DE CHAVES DE CRIPTOGRAFIA
-- ============================================================================

CREATE TABLE IF NOT EXISTS google_ads_encryption_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key_data TEXT NOT NULL,
  algorithm VARCHAR(50) DEFAULT 'aes-256-gcm',
  version INTEGER DEFAULT 1,
  key_hash TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  CONSTRAINT valid_algorithm CHECK (algorithm IN ('aes-256-gcm', 'aes-256-cbc'))
);

-- 2. TABELA DE CONEXÕES GOOGLE ADS
-- ============================================================================

CREATE TABLE IF NOT EXISTS google_ads_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL,
  account_name TEXT,
  refresh_token TEXT NOT NULL,
  access_token TEXT,
  token_expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, customer_id)
);

-- 3. TABELA DE CAMPANHAS GOOGLE ADS
-- ============================================================================

CREATE TABLE IF NOT EXISTS google_ads_campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES google_ads_connections(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  budget_amount_micros BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(connection_id, campaign_id)
);

-- 4. TABELA DE MÉTRICAS
-- ============================================================================

CREATE TABLE IF NOT EXISTS google_ads_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES google_ads_campaigns(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  cost_micros BIGINT DEFAULT 0,
  conversions DECIMAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, date)
);

-- 5. TABELA DE LOGS DE SINCRONIZAÇÃO
-- ============================================================================

CREATE TABLE IF NOT EXISTS google_ads_sync_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES google_ads_connections(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL,
  status TEXT NOT NULL,
  records_synced INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABELA DE AUDITORIA
-- ============================================================================

CREATE TABLE IF NOT EXISTS google_ads_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES google_ads_connections(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  operation TEXT NOT NULL,
  action TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  details JSONB,
  resource_type TEXT,
  resource_id TEXT,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  sensitive_data BOOLEAN DEFAULT false,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. ÍNDICES PARA PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_google_ads_connections_client_id 
  ON google_ads_connections(client_id);
CREATE INDEX IF NOT EXISTS idx_google_ads_connections_customer_id 
  ON google_ads_connections(customer_id);
CREATE INDEX IF NOT EXISTS idx_google_ads_connections_active 
  ON google_ads_connections(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_google_ads_campaigns_client_id 
  ON google_ads_campaigns(client_id);
CREATE INDEX IF NOT EXISTS idx_google_ads_campaigns_connection_id 
  ON google_ads_campaigns(connection_id);
CREATE INDEX IF NOT EXISTS idx_google_ads_campaigns_campaign_id 
  ON google_ads_campaigns(campaign_id);

CREATE INDEX IF NOT EXISTS idx_google_ads_metrics_client_id 
  ON google_ads_metrics(client_id);
CREATE INDEX IF NOT EXISTS idx_google_ads_metrics_campaign_id 
  ON google_ads_metrics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_google_ads_metrics_date 
  ON google_ads_metrics(date DESC);

CREATE INDEX IF NOT EXISTS idx_google_ads_sync_logs_client_id 
  ON google_ads_sync_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_google_ads_sync_logs_connection_id 
  ON google_ads_sync_logs(connection_id);
CREATE INDEX IF NOT EXISTS idx_google_ads_sync_logs_created_at 
  ON google_ads_sync_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_google_ads_audit_log_client_id 
  ON google_ads_audit_log(client_id);
CREATE INDEX IF NOT EXISTS idx_google_ads_audit_log_operation 
  ON google_ads_audit_log(operation);
CREATE INDEX IF NOT EXISTS idx_google_ads_audit_log_created_at 
  ON google_ads_audit_log(created_at DESC);

-- 8. TRIGGERS PARA UPDATED_AT
-- ============================================================================

DROP TRIGGER IF EXISTS update_google_ads_connections_updated_at ON google_ads_connections;
CREATE TRIGGER update_google_ads_connections_updated_at 
    BEFORE UPDATE ON google_ads_connections 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_google_ads_campaigns_updated_at ON google_ads_campaigns;
CREATE TRIGGER update_google_ads_campaigns_updated_at 
    BEFORE UPDATE ON google_ads_campaigns 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_google_ads_metrics_updated_at ON google_ads_metrics;
CREATE TRIGGER update_google_ads_metrics_updated_at 
    BEFORE UPDATE ON google_ads_metrics 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 9. HABILITAR RLS
-- ============================================================================

ALTER TABLE google_ads_encryption_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_audit_log ENABLE ROW LEVEL SECURITY;

-- 10. POLÍTICAS RLS - ENCRYPTION KEYS (apenas service_role)
-- ============================================================================

DROP POLICY IF EXISTS "service_role_full_access_encryption_keys" ON google_ads_encryption_keys;
CREATE POLICY "service_role_full_access_encryption_keys"
  ON google_ads_encryption_keys
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 11. POLÍTICAS RLS - CONNECTIONS
-- ============================================================================

DROP POLICY IF EXISTS "google_connections_client_select" ON google_ads_connections;
CREATE POLICY "google_connections_client_select"
  ON google_ads_connections
  FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT c.id 
      FROM clients c
      JOIN memberships m ON m.org_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "google_connections_client_insert" ON google_ads_connections;
CREATE POLICY "google_connections_client_insert"
  ON google_ads_connections
  FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id IN (
      SELECT c.id 
      FROM clients c
      JOIN memberships m ON m.org_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "google_connections_client_update" ON google_ads_connections;
CREATE POLICY "google_connections_client_update"
  ON google_ads_connections
  FOR UPDATE
  TO authenticated
  USING (
    client_id IN (
      SELECT c.id 
      FROM clients c
      JOIN memberships m ON m.org_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "service_role_full_access_connections" ON google_ads_connections;
CREATE POLICY "service_role_full_access_connections"
  ON google_ads_connections
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 12. POLÍTICAS RLS - CAMPAIGNS
-- ============================================================================

DROP POLICY IF EXISTS "google_campaigns_client_select" ON google_ads_campaigns;
CREATE POLICY "google_campaigns_client_select"
  ON google_ads_campaigns
  FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT c.id 
      FROM clients c
      JOIN memberships m ON m.org_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "service_role_full_access_campaigns" ON google_ads_campaigns;
CREATE POLICY "service_role_full_access_campaigns"
  ON google_ads_campaigns
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 13. POLÍTICAS RLS - METRICS
-- ============================================================================

DROP POLICY IF EXISTS "google_metrics_client_select" ON google_ads_metrics;
CREATE POLICY "google_metrics_client_select"
  ON google_ads_metrics
  FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT c.id 
      FROM clients c
      JOIN memberships m ON m.org_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "service_role_full_access_metrics" ON google_ads_metrics;
CREATE POLICY "service_role_full_access_metrics"
  ON google_ads_metrics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 14. POLÍTICAS RLS - SYNC LOGS
-- ============================================================================

DROP POLICY IF EXISTS "google_sync_logs_client_select" ON google_ads_sync_logs;
CREATE POLICY "google_sync_logs_client_select"
  ON google_ads_sync_logs
  FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT c.id 
      FROM clients c
      JOIN memberships m ON m.org_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "service_role_full_access_sync_logs" ON google_ads_sync_logs;
CREATE POLICY "service_role_full_access_sync_logs"
  ON google_ads_sync_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 15. POLÍTICAS RLS - AUDIT LOG
-- ============================================================================

DROP POLICY IF EXISTS "google_audit_log_client_select" ON google_ads_audit_log;
CREATE POLICY "google_audit_log_client_select"
  ON google_ads_audit_log
  FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT c.id 
      FROM clients c
      JOIN memberships m ON m.org_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "service_role_full_access_audit_log" ON google_ads_audit_log;
CREATE POLICY "service_role_full_access_audit_log"
  ON google_ads_audit_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- FIM DO SCHEMA GOOGLE ADS
-- ============================================================================
-- Schema criado com sucesso!
-- Próximo passo: Testar com node scripts/test-google-health-check.js
-- ============================================================================
