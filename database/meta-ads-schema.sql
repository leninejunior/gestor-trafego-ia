-- Tabela para armazenar conexões com Meta Ads
CREATE TABLE IF NOT EXISTS client_meta_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  ad_account_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  account_name TEXT,
  currency TEXT DEFAULT 'BRL',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela para armazenar dados de campanhas Meta
CREATE TABLE IF NOT EXISTS meta_campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id UUID NOT NULL REFERENCES client_meta_connections(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  objective TEXT,
  daily_budget DECIMAL,
  lifetime_budget DECIMAL,
  created_time TIMESTAMP WITH TIME ZONE,
  updated_time TIMESTAMP WITH TIME ZONE,
  start_time TIMESTAMP WITH TIME ZONE,
  stop_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(connection_id, external_id)
);

-- Tabela para armazenar insights de campanhas Meta
CREATE TABLE IF NOT EXISTS meta_campaign_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES meta_campaigns(id) ON DELETE CASCADE,
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
  UNIQUE(campaign_id, date_start, date_stop)
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_client_meta_connections_client_id ON client_meta_connections(client_id);
CREATE INDEX IF NOT EXISTS idx_client_meta_connections_ad_account_id ON client_meta_connections(ad_account_id);
CREATE INDEX IF NOT EXISTS idx_meta_campaigns_connection_id ON meta_campaigns(connection_id);
CREATE INDEX IF NOT EXISTS idx_meta_campaigns_external_id ON meta_campaigns(external_id);
CREATE INDEX IF NOT EXISTS idx_meta_campaign_insights_campaign_id ON meta_campaign_insights(campaign_id);
CREATE INDEX IF NOT EXISTS idx_meta_campaign_insights_date_range ON meta_campaign_insights(date_start, date_stop);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_client_meta_connections_updated_at 
    BEFORE UPDATE ON client_meta_connections 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meta_campaigns_updated_at 
    BEFORE UPDATE ON meta_campaigns 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meta_campaign_insights_updated_at 
    BEFORE UPDATE ON meta_campaign_insights 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) policies
ALTER TABLE client_meta_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_campaign_insights ENABLE ROW LEVEL SECURITY;

-- Política para client_meta_connections
CREATE POLICY "Users can view their own client meta connections" ON client_meta_connections
    FOR SELECT USING (
        client_id IN (
            SELECT c.id FROM clients c
            JOIN memberships m ON c.org_id = m.org_id
            WHERE m.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own client meta connections" ON client_meta_connections
    FOR INSERT WITH CHECK (
        client_id IN (
            SELECT c.id FROM clients c
            JOIN memberships m ON c.org_id = m.org_id
            WHERE m.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own client meta connections" ON client_meta_connections
    FOR UPDATE USING (
        client_id IN (
            SELECT c.id FROM clients c
            JOIN memberships m ON c.org_id = m.org_id
            WHERE m.user_id = auth.uid()
        )
    );

-- Política para meta_campaigns
CREATE POLICY "Users can view their own meta campaigns" ON meta_campaigns
    FOR SELECT USING (
        connection_id IN (
            SELECT cmc.id FROM client_meta_connections cmc
            JOIN clients c ON cmc.client_id = c.id
            JOIN memberships m ON c.org_id = m.org_id
            WHERE m.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own meta campaigns" ON meta_campaigns
    FOR INSERT WITH CHECK (
        connection_id IN (
            SELECT cmc.id FROM client_meta_connections cmc
            JOIN clients c ON cmc.client_id = c.id
            JOIN memberships m ON c.org_id = m.org_id
            WHERE m.user_id = auth.uid()
        )
    );

-- Política para meta_campaign_insights
CREATE POLICY "Users can view their own meta campaign insights" ON meta_campaign_insights
    FOR SELECT USING (
        campaign_id IN (
            SELECT mc.id FROM meta_campaigns mc
            JOIN client_meta_connections cmc ON mc.connection_id = cmc.id
            JOIN clients c ON cmc.client_id = c.id
            JOIN memberships m ON c.org_id = m.org_id
            WHERE m.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own meta campaign insights" ON meta_campaign_insights
    FOR INSERT WITH CHECK (
        campaign_id IN (
            SELECT mc.id FROM meta_campaigns mc
            JOIN client_meta_connections cmc ON mc.connection_id = cmc.id
            JOIN clients c ON cmc.client_id = c.id
            JOIN memberships m ON c.org_id = m.org_id
            WHERE m.user_id = auth.uid()
        )
    );