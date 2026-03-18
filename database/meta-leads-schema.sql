-- =====================================================
-- META LEAD ADS - SCHEMA DE LEADS
-- =====================================================
-- Tabelas para armazenar leads capturados via Facebook Lead Ads
-- Suporta formulários customizados e campos dinâmicos

-- Tabela para armazenar formulários de lead ads
CREATE TABLE IF NOT EXISTS meta_lead_forms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id UUID NOT NULL REFERENCES client_meta_connections(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL, -- ID do formulário no Meta
  name TEXT NOT NULL,
  status TEXT NOT NULL, -- ACTIVE, PAUSED, DELETED
  locale TEXT DEFAULT 'pt_BR',
  questions JSONB, -- Perguntas do formulário
  privacy_policy_url TEXT,
  created_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(connection_id, external_id)
);

-- Tabela para armazenar leads capturados
CREATE TABLE IF NOT EXISTS meta_leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id UUID NOT NULL REFERENCES client_meta_connections(id) ON DELETE CASCADE,
  form_id UUID REFERENCES meta_lead_forms(id) ON DELETE SET NULL,
  external_id TEXT NOT NULL, -- ID do lead no Meta
  ad_id TEXT, -- ID do anúncio que gerou o lead
  ad_name TEXT,
  adset_id TEXT, -- ID do conjunto de anúncios
  adset_name TEXT,
  campaign_id TEXT, -- ID da campanha
  campaign_name TEXT,
  created_time TIMESTAMP WITH TIME ZONE NOT NULL,
  field_data JSONB NOT NULL, -- Dados do formulário (nome, email, telefone, etc)
  is_organic BOOLEAN DEFAULT false,
  platform TEXT, -- FACEBOOK, INSTAGRAM, MESSENGER
  status TEXT DEFAULT 'new', -- new, contacted, qualified, converted, lost
  notes TEXT,
  assigned_to UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(connection_id, external_id)
);

-- Tabela para histórico de sincronização de leads
CREATE TABLE IF NOT EXISTS meta_lead_sync_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id UUID NOT NULL REFERENCES client_meta_connections(id) ON DELETE CASCADE,
  form_id UUID REFERENCES meta_lead_forms(id) ON DELETE SET NULL,
  leads_synced INTEGER DEFAULT 0,
  leads_new INTEGER DEFAULT 0,
  leads_updated INTEGER DEFAULT 0,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  sync_started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  sync_completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_meta_lead_forms_connection_id ON meta_lead_forms(connection_id);
CREATE INDEX IF NOT EXISTS idx_meta_lead_forms_external_id ON meta_lead_forms(external_id);
CREATE INDEX IF NOT EXISTS idx_meta_leads_connection_id ON meta_leads(connection_id);
CREATE INDEX IF NOT EXISTS idx_meta_leads_form_id ON meta_leads(form_id);
CREATE INDEX IF NOT EXISTS idx_meta_leads_external_id ON meta_leads(external_id);
CREATE INDEX IF NOT EXISTS idx_meta_leads_created_time ON meta_leads(created_time DESC);
CREATE INDEX IF NOT EXISTS idx_meta_leads_status ON meta_leads(status);
CREATE INDEX IF NOT EXISTS idx_meta_leads_campaign_id ON meta_leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_meta_lead_sync_logs_connection_id ON meta_lead_sync_logs(connection_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_meta_lead_forms_updated_at 
    BEFORE UPDATE ON meta_lead_forms 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meta_leads_updated_at 
    BEFORE UPDATE ON meta_leads 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- RLS (Row Level Security) Policies
-- =====================================================

ALTER TABLE meta_lead_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_lead_sync_logs ENABLE ROW LEVEL SECURITY;

-- Políticas para meta_lead_forms
CREATE POLICY "Users can view their own lead forms" ON meta_lead_forms
    FOR SELECT USING (
        connection_id IN (
            SELECT cmc.id FROM client_meta_connections cmc
            JOIN clients c ON cmc.client_id = c.id
            JOIN memberships m ON c.org_id = m.organization_id
            WHERE m.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own lead forms" ON meta_lead_forms
    FOR INSERT WITH CHECK (
        connection_id IN (
            SELECT cmc.id FROM client_meta_connections cmc
            JOIN clients c ON cmc.client_id = c.id
            JOIN memberships m ON c.org_id = m.organization_id
            WHERE m.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own lead forms" ON meta_lead_forms
    FOR UPDATE USING (
        connection_id IN (
            SELECT cmc.id FROM client_meta_connections cmc
            JOIN clients c ON cmc.client_id = c.id
            JOIN memberships m ON c.org_id = m.organization_id
            WHERE m.user_id = auth.uid()
        )
    );

-- Políticas para meta_leads
CREATE POLICY "Users can view their own leads" ON meta_leads
    FOR SELECT USING (
        connection_id IN (
            SELECT cmc.id FROM client_meta_connections cmc
            JOIN clients c ON cmc.client_id = c.id
            JOIN memberships m ON c.org_id = m.organization_id
            WHERE m.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own leads" ON meta_leads
    FOR INSERT WITH CHECK (
        connection_id IN (
            SELECT cmc.id FROM client_meta_connections cmc
            JOIN clients c ON cmc.client_id = c.id
            JOIN memberships m ON c.org_id = m.organization_id
            WHERE m.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own leads" ON meta_leads
    FOR UPDATE USING (
        connection_id IN (
            SELECT cmc.id FROM client_meta_connections cmc
            JOIN clients c ON cmc.client_id = c.id
            JOIN memberships m ON c.org_id = m.organization_id
            WHERE m.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their own leads" ON meta_leads
    FOR DELETE USING (
        connection_id IN (
            SELECT cmc.id FROM client_meta_connections cmc
            JOIN clients c ON cmc.client_id = c.id
            JOIN memberships m ON c.org_id = m.organization_id
            WHERE m.user_id = auth.uid()
        )
    );

-- Políticas para meta_lead_sync_logs
CREATE POLICY "Users can view their own sync logs" ON meta_lead_sync_logs
    FOR SELECT USING (
        connection_id IN (
            SELECT cmc.id FROM client_meta_connections cmc
            JOIN clients c ON cmc.client_id = c.id
            JOIN memberships m ON c.org_id = m.organization_id
            WHERE m.user_id = auth.uid()
        )
    );

-- Service role tem acesso total
CREATE POLICY "service_role_full_access_lead_forms" ON meta_lead_forms
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_full_access_leads" ON meta_leads
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_full_access_sync_logs" ON meta_lead_sync_logs
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =====================================================
-- Views úteis
-- =====================================================

-- View para estatísticas de leads por campanha
CREATE OR REPLACE VIEW meta_lead_stats_by_campaign AS
SELECT 
  ml.connection_id,
  ml.campaign_id,
  ml.campaign_name,
  COUNT(*) as total_leads,
  COUNT(*) FILTER (WHERE ml.status = 'new') as new_leads,
  COUNT(*) FILTER (WHERE ml.status = 'contacted') as contacted_leads,
  COUNT(*) FILTER (WHERE ml.status = 'qualified') as qualified_leads,
  COUNT(*) FILTER (WHERE ml.status = 'converted') as converted_leads,
  COUNT(*) FILTER (WHERE ml.status = 'lost') as lost_leads,
  MIN(ml.created_time) as first_lead_date,
  MAX(ml.created_time) as last_lead_date
FROM meta_leads ml
GROUP BY ml.connection_id, ml.campaign_id, ml.campaign_name;

-- View para leads recentes com informações completas
CREATE OR REPLACE VIEW meta_leads_recent AS
SELECT 
  ml.id,
  ml.connection_id,
  cmc.client_id,
  c.name as client_name,
  ml.external_id,
  ml.campaign_name,
  ml.adset_name,
  ml.ad_name,
  ml.field_data,
  ml.status,
  ml.created_time,
  ml.platform,
  ml.notes,
  ml.assigned_to,
  u.email as assigned_to_email
FROM meta_leads ml
JOIN client_meta_connections cmc ON ml.connection_id = cmc.id
JOIN clients c ON cmc.client_id = c.id
LEFT JOIN auth.users u ON ml.assigned_to = u.id
ORDER BY ml.created_time DESC;
