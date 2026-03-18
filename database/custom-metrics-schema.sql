-- Schema para Sistema de Métricas Personalizadas

-- Tabela para armazenar métricas customizadas
CREATE TABLE IF NOT EXISTS custom_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    formula TEXT NOT NULL, -- Fórmula matemática (ex: "spend / clicks * 100")
    base_metrics JSONB NOT NULL, -- Métricas base utilizadas
    currency_type VARCHAR(10) DEFAULT 'BRL', -- BRL, USD, EUR, POINTS
    display_symbol VARCHAR(10) DEFAULT 'R$',
    decimal_places INTEGER DEFAULT 2,
    is_percentage BOOLEAN DEFAULT false,
    category VARCHAR(100), -- CPC, CTR, ROAS, CUSTOM
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela para valores calculados das métricas (cache)
CREATE TABLE IF NOT EXISTS custom_metric_values (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    custom_metric_id UUID REFERENCES custom_metrics(id) ON DELETE CASCADE,
    campaign_id VARCHAR(255),
    ad_account_id VARCHAR(255),
    date_range_start DATE,
    date_range_end DATE,
    calculated_value DECIMAL(15,4),
    raw_data JSONB, -- Dados brutos utilizados no cálculo
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela para objetivos/ranges das métricas
CREATE TABLE IF NOT EXISTS metric_objectives (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    metric_name VARCHAR(255) NOT NULL, -- Nome da métrica (custom ou padrão)
    metric_type VARCHAR(50) NOT NULL, -- 'standard' ou 'custom'
    custom_metric_id UUID REFERENCES custom_metrics(id) ON DELETE CASCADE,
    min_value DECIMAL(15,4),
    max_value DECIMAL(15,4),
    target_value DECIMAL(15,4),
    campaign_objective VARCHAR(100), -- CONVERSIONS, TRAFFIC, AWARENESS, etc.
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela para alertas de performance
CREATE TABLE IF NOT EXISTS performance_alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    metric_objective_id UUID REFERENCES metric_objectives(id) ON DELETE CASCADE,
    campaign_id VARCHAR(255),
    alert_type VARCHAR(50) NOT NULL, -- 'above_max', 'below_min', 'target_reached'
    current_value DECIMAL(15,4),
    threshold_value DECIMAL(15,4),
    severity VARCHAR(20) DEFAULT 'medium', -- low, medium, high, critical
    message TEXT,
    is_read BOOLEAN DEFAULT false,
    is_resolved BOOLEAN DEFAULT false,
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Tabela para visualizações personalizadas
CREATE TABLE IF NOT EXISTS custom_dashboard_views (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    view_config JSONB NOT NULL, -- Configuração das colunas, filtros, etc.
    is_default BOOLEAN DEFAULT false,
    is_shared BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela para integrações de e-commerce
CREATE TABLE IF NOT EXISTS ecommerce_integrations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL, -- shopify, nuvemshop, hotmart, etc.
    store_name VARCHAR(255),
    api_credentials JSONB, -- Credenciais criptografadas
    webhook_url TEXT,
    sync_settings JSONB, -- Configurações de sincronização
    last_sync_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela para conversões de e-commerce
CREATE TABLE IF NOT EXISTS ecommerce_conversions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    integration_id UUID REFERENCES ecommerce_integrations(id) ON DELETE CASCADE,
    order_id VARCHAR(255) NOT NULL,
    campaign_id VARCHAR(255),
    utm_source VARCHAR(255),
    utm_medium VARCHAR(255),
    utm_campaign VARCHAR(255),
    utm_content VARCHAR(255),
    utm_term VARCHAR(255),
    customer_email VARCHAR(255),
    order_value DECIMAL(10,2),
    currency VARCHAR(10) DEFAULT 'BRL',
    products JSONB, -- Array de produtos
    conversion_date TIMESTAMP WITH TIME ZONE,
    attribution_window INTEGER DEFAULT 7, -- Janela de atribuição em dias
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela para UTMs inteligentes
CREATE TABLE IF NOT EXISTS smart_utms (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    campaign_name VARCHAR(255),
    utm_source VARCHAR(255) NOT NULL,
    utm_medium VARCHAR(255) NOT NULL,
    utm_campaign VARCHAR(255) NOT NULL,
    utm_content VARCHAR(255),
    utm_term VARCHAR(255),
    full_url TEXT NOT NULL,
    short_url TEXT,
    clicks INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    revenue DECIMAL(10,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_custom_metrics_user_org ON custom_metrics(user_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_custom_metric_values_metric_date ON custom_metric_values(custom_metric_id, date_range_start, date_range_end);
CREATE INDEX IF NOT EXISTS idx_performance_alerts_user_unread ON performance_alerts(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_ecommerce_conversions_campaign ON ecommerce_conversions(campaign_id, conversion_date);
CREATE INDEX IF NOT EXISTS idx_smart_utms_campaign ON smart_utms(utm_campaign, created_at);

-- RLS Policies
ALTER TABLE custom_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_metric_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE metric_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_dashboard_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecommerce_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecommerce_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_utms ENABLE ROW LEVEL SECURITY;

-- Policies para custom_metrics
CREATE POLICY "Users can view own custom metrics" ON custom_metrics
    FOR SELECT USING (
        user_id = auth.uid() OR 
        organization_id IN (
            SELECT organization_id FROM organization_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create custom metrics" ON custom_metrics
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own custom metrics" ON custom_metrics
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own custom metrics" ON custom_metrics
    FOR DELETE USING (user_id = auth.uid());

-- Policies similares para outras tabelas
CREATE POLICY "Users can view own metric values" ON custom_metric_values
    FOR SELECT USING (
        custom_metric_id IN (
            SELECT id FROM custom_metrics 
            WHERE user_id = auth.uid() OR organization_id IN (
                SELECT organization_id FROM organization_members 
                WHERE user_id = auth.uid()
            )
        )
    );

-- Functions para cálculo de métricas
CREATE OR REPLACE FUNCTION calculate_custom_metric(
    metric_id UUID,
    campaign_data JSONB
) RETURNS DECIMAL AS $$
DECLARE
    metric_record custom_metrics%ROWTYPE;
    result DECIMAL;
BEGIN
    SELECT * INTO metric_record FROM custom_metrics WHERE id = metric_id;
    
    -- Aqui implementaríamos o parser de fórmulas
    -- Por enquanto, retorna um valor mock
    RETURN 0.0;
END;
$$ LANGUAGE plpgsql;

-- Function para trigger de alertas
CREATE OR REPLACE FUNCTION check_metric_alerts()
RETURNS TRIGGER AS $$
BEGIN
    -- Verifica se o valor está fora dos objetivos definidos
    -- Cria alertas automáticos se necessário
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para alertas automáticos
CREATE TRIGGER trigger_metric_alerts
    AFTER INSERT OR UPDATE ON custom_metric_values
    FOR EACH ROW EXECUTE FUNCTION check_metric_alerts();

-- Comentários para documentação
COMMENT ON TABLE custom_metrics IS 'Armazena métricas personalizadas criadas pelos usuários';
COMMENT ON TABLE custom_metric_values IS 'Cache dos valores calculados das métricas personalizadas';
COMMENT ON TABLE metric_objectives IS 'Objetivos e ranges definidos para cada métrica';
COMMENT ON TABLE performance_alerts IS 'Alertas automáticos baseados na performance das métricas';
COMMENT ON TABLE custom_dashboard_views IS 'Visualizações personalizadas dos dashboards';
COMMENT ON TABLE ecommerce_integrations IS 'Configurações das integrações com plataformas de e-commerce';
COMMENT ON TABLE ecommerce_conversions IS 'Conversões rastreadas das integrações de e-commerce';
COMMENT ON TABLE smart_utms IS 'UTMs inteligentes com tracking avançado';