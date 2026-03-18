-- =====================================================
-- Migração: Adicionar Tabelas de Hierarquia Meta Ads
-- Data: 2025-12-10
-- Descrição: Criar tabelas meta_adsets e meta_ads
-- =====================================================

-- Tabela para conjuntos de anúncios (Ad Sets)
CREATE TABLE IF NOT EXISTS meta_adsets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id UUID NOT NULL REFERENCES client_meta_connections(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES meta_campaigns(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  daily_budget DECIMAL,
  lifetime_budget DECIMAL,
  optimization_goal TEXT,
  billing_event TEXT,
  targeting JSONB,
  created_time TIMESTAMP WITH TIME ZONE,
  updated_time TIMESTAMP WITH TIME ZONE,
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(connection_id, external_id)
);

-- Tabela para anúncios (Ads)
CREATE TABLE IF NOT EXISTS meta_ads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id UUID NOT NULL REFERENCES client_meta_connections(id) ON DELETE CASCADE,
  adset_id UUID NOT NULL REFERENCES meta_adsets(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  creative_id TEXT,
  created_time TIMESTAMP WITH TIME ZONE,
  updated_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(connection_id, external_id)
);

-- Tabela para insights de adsets
CREATE TABLE IF NOT EXISTS meta_adset_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  adset_id UUID NOT NULL REFERENCES meta_adsets(id) ON DELETE CASCADE,
  date_start DATE NOT NULL,
  date_stop DATE NOT NULL,
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  spend DECIMAL DEFAULT 0,
  reach BIGINT DEFAULT 0,
  frequency DECIMAL DEFAULT 0,
  cpm DECIMAL DEFAULT 0,
  cpc DECIMAL DEFAULT 0,
  ctr DECIMAL DEFAULT 0,
  cost_per_conversion DECIMAL DEFAULT 0,
  conversions BIGINT DEFAULT 0,
  conversion_rate DECIMAL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(adset_id, date_start, date_stop)
);

-- Tabela para insights de ads
CREATE TABLE IF NOT EXISTS meta_ad_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ad_id UUID NOT NULL REFERENCES meta_ads(id) ON DELETE CASCADE,
  date_start DATE NOT NULL,
  date_stop DATE NOT NULL,
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  spend DECIMAL DEFAULT 0,
  reach BIGINT DEFAULT 0,
  frequency DECIMAL DEFAULT 0,
  cpm DECIMAL DEFAULT 0,
  cpc DECIMAL DEFAULT 0,
  ctr DECIMAL DEFAULT 0,
  cost_per_conversion DECIMAL DEFAULT 0,
  conversions BIGINT DEFAULT 0,
  conversion_rate DECIMAL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(ad_id, date_start, date_stop)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_meta_adsets_connection_id ON meta_adsets(connection_id);
CREATE INDEX IF NOT EXISTS idx_meta_adsets_campaign_id ON meta_adsets(campaign_id);
CREATE INDEX IF NOT EXISTS idx_meta_adsets_external_id ON meta_adsets(external_id);

CREATE INDEX IF NOT EXISTS idx_meta_ads_connection_id ON meta_ads(connection_id);
CREATE INDEX IF NOT EXISTS idx_meta_ads_adset_id ON meta_ads(adset_id);
CREATE INDEX IF NOT EXISTS idx_meta_ads_external_id ON meta_ads(external_id);

CREATE INDEX IF NOT EXISTS idx_meta_adset_insights_adset_id ON meta_adset_insights(adset_id);
CREATE INDEX IF NOT EXISTS idx_meta_adset_insights_date_range ON meta_adset_insights(date_start, date_stop);

CREATE INDEX IF NOT EXISTS idx_meta_ad_insights_ad_id ON meta_ad_insights(ad_id);
CREATE INDEX IF NOT EXISTS idx_meta_ad_insights_date_range ON meta_ad_insights(date_start, date_stop);

-- Triggers para updated_at
CREATE TRIGGER update_meta_adsets_updated_at 
    BEFORE UPDATE ON meta_adsets 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meta_ads_updated_at 
    BEFORE UPDATE ON meta_ads 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meta_adset_insights_updated_at 
    BEFORE UPDATE ON meta_adset_insights 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meta_ad_insights_updated_at 
    BEFORE UPDATE ON meta_ad_insights 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security)
ALTER TABLE meta_adsets ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_adset_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_ad_insights ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para meta_adsets
CREATE POLICY "Users can view their client adsets" ON meta_adsets
  FOR SELECT
  USING (
    connection_id IN (
      SELECT cmc.id FROM client_meta_connections cmc
      JOIN clients c ON c.id = cmc.client_id
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role has full access to adsets" ON meta_adsets
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Políticas RLS para meta_ads
CREATE POLICY "Users can view their client ads" ON meta_ads
  FOR SELECT
  USING (
    connection_id IN (
      SELECT cmc.id FROM client_meta_connections cmc
      JOIN clients c ON c.id = cmc.client_id
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role has full access to ads" ON meta_ads
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Políticas RLS para meta_adset_insights
CREATE POLICY "Users can view their client adset insights" ON meta_adset_insights
  FOR SELECT
  USING (
    adset_id IN (
      SELECT ma.id FROM meta_adsets ma
      JOIN client_meta_connections cmc ON cmc.id = ma.connection_id
      JOIN clients c ON c.id = cmc.client_id
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role has full access to adset insights" ON meta_adset_insights
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Políticas RLS para meta_ad_insights
CREATE POLICY "Users can view their client ad insights" ON meta_ad_insights
  FOR SELECT
  USING (
    ad_id IN (
      SELECT ma.id FROM meta_ads ma
      JOIN meta_adsets mas ON mas.id = ma.adset_id
      JOIN client_meta_connections cmc ON cmc.id = mas.connection_id
      JOIN clients c ON c.id = cmc.client_id
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role has full access to ad insights" ON meta_ad_insights
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Verificação
SELECT 
  'meta_adsets' as tabela,
  COUNT(*) as total_colunas
FROM information_schema.columns 
WHERE table_name = 'meta_adsets'
UNION ALL
SELECT 
  'meta_ads' as tabela,
  COUNT(*) as total_colunas
FROM information_schema.columns 
WHERE table_name = 'meta_ads';
