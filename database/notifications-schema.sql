-- Schema para sistema de notificações e sincronização

-- Tabela de notificações
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('info', 'success', 'warning', 'error')),
    category TEXT NOT NULL CHECK (category IN ('campaign', 'sync', 'billing', 'system', 'performance')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    action_url TEXT,
    action_label TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_organization_id ON notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority);
CREATE INDEX IF NOT EXISTS idx_notifications_category ON notifications(category);

-- Tabela de regras de notificação
CREATE TABLE IF NOT EXISTS notification_rules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    condition TEXT NOT NULL, -- Condição SQL-like para trigger
    template JSONB NOT NULL, -- Template da notificação
    is_active BOOLEAN DEFAULT TRUE,
    frequency TEXT DEFAULT 'immediate' CHECK (frequency IN ('immediate', 'daily', 'weekly')),
    channels TEXT[] DEFAULT ARRAY['in_app'], -- ['in_app', 'email', 'webhook']
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para regras
CREATE INDEX IF NOT EXISTS idx_notification_rules_organization_id ON notification_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_notification_rules_is_active ON notification_rules(is_active);

-- Tabela de tokens Meta para usuários
CREATE TABLE IF NOT EXISTS user_meta_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    token_type TEXT DEFAULT 'user_access_token',
    expires_at TIMESTAMPTZ,
    scopes TEXT[],
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, is_active) -- Apenas um token ativo por usuário
);

-- Índices para tokens
CREATE INDEX IF NOT EXISTS idx_user_meta_tokens_user_id ON user_meta_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_meta_tokens_is_active ON user_meta_tokens(is_active);

-- Tabela de campanhas Meta
CREATE TABLE IF NOT EXISTS meta_campaigns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    campaign_id TEXT NOT NULL, -- ID da campanha no Meta
    connection_id UUID NOT NULL REFERENCES client_meta_connections(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT,
    objective TEXT,
    created_time TIMESTAMPTZ,
    updated_time TIMESTAMPTZ,
    start_time TIMESTAMPTZ,
    stop_time TIMESTAMPTZ,
    daily_budget DECIMAL(10,2),
    lifetime_budget DECIMAL(10,2),
    bid_strategy TEXT,
    last_sync TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(campaign_id, connection_id)
);

-- Índices para campanhas
CREATE INDEX IF NOT EXISTS idx_meta_campaigns_connection_id ON meta_campaigns(connection_id);
CREATE INDEX IF NOT EXISTS idx_meta_campaigns_campaign_id ON meta_campaigns(campaign_id);
CREATE INDEX IF NOT EXISTS idx_meta_campaigns_status ON meta_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_meta_campaigns_last_sync ON meta_campaigns(last_sync);

-- Tabela de insights Meta
CREATE TABLE IF NOT EXISTS meta_insights (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    campaign_id TEXT NOT NULL, -- ID da campanha no Meta
    connection_id UUID NOT NULL REFERENCES client_meta_connections(id) ON DELETE CASCADE,
    date_start DATE NOT NULL,
    date_stop DATE NOT NULL,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    spend DECIMAL(10,2) DEFAULT 0,
    ctr DECIMAL(5,2) DEFAULT 0,
    cpc DECIMAL(10,2) DEFAULT 0,
    cpm DECIMAL(10,2) DEFAULT 0,
    reach INTEGER DEFAULT 0,
    frequency DECIMAL(5,2) DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    cost_per_conversion DECIMAL(10,2) DEFAULT 0,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(campaign_id, date_start, date_stop)
);

-- Índices para insights
CREATE INDEX IF NOT EXISTS idx_meta_insights_campaign_id ON meta_insights(campaign_id);
CREATE INDEX IF NOT EXISTS idx_meta_insights_connection_id ON meta_insights(connection_id);
CREATE INDEX IF NOT EXISTS idx_meta_insights_date_start ON meta_insights(date_start);
CREATE INDEX IF NOT EXISTS idx_meta_insights_date_stop ON meta_insights(date_stop);
CREATE INDEX IF NOT EXISTS idx_meta_insights_synced_at ON meta_insights(synced_at);

-- Tabela de agendamentos de sincronização
CREATE TABLE IF NOT EXISTS sync_schedules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    sync_type TEXT NOT NULL, -- 'meta_ads', 'google_ads', etc.
    interval_hours INTEGER DEFAULT 24,
    sync_config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    last_run TIMESTAMPTZ,
    next_run TIMESTAMPTZ,
    last_status TEXT, -- 'success', 'error', 'partial'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, sync_type)
);

-- Índices para schedules
CREATE INDEX IF NOT EXISTS idx_sync_schedules_user_id ON sync_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_schedules_is_active ON sync_schedules(is_active);
CREATE INDEX IF NOT EXISTS idx_sync_schedules_next_run ON sync_schedules(next_run);

-- Tabela de logs de sincronização
CREATE TABLE IF NOT EXISTS sync_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    sync_type TEXT NOT NULL,
    status TEXT NOT NULL, -- 'success', 'error', 'partial_success'
    results JSONB DEFAULT '{}',
    error_message TEXT,
    duration_ms INTEGER,
    records_processed INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para logs
CREATE INDEX IF NOT EXISTS idx_sync_logs_user_id ON sync_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_sync_type ON sync_logs(sync_type);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_sync_logs_created_at ON sync_logs(created_at DESC);

-- Atualizar tabela de conexões Meta para incluir sync info
ALTER TABLE client_meta_connections 
ADD COLUMN IF NOT EXISTS last_sync TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'active' CHECK (sync_status IN ('active', 'error', 'paused')),
ADD COLUMN IF NOT EXISTS sync_error TEXT;

-- Função para limpar notificações antigas (mais de 30 dias)
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS void AS $$
BEGIN
    DELETE FROM notifications 
    WHERE created_at < NOW() - INTERVAL '30 days'
    AND is_read = true;
    
    DELETE FROM sync_logs 
    WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Função para contar notificações não lidas
CREATE OR REPLACE FUNCTION get_unread_notifications_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM notifications
        WHERE user_id = p_user_id
        AND is_read = false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para marcar notificações como lidas automaticamente após 7 dias
CREATE OR REPLACE FUNCTION auto_mark_old_notifications_read()
RETURNS void AS $$
BEGIN
    UPDATE notifications 
    SET is_read = true, read_at = NOW()
    WHERE created_at < NOW() - INTERVAL '7 days'
    AND is_read = false
    AND priority IN ('low', 'medium');
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger nas tabelas
DROP TRIGGER IF EXISTS update_notifications_updated_at ON notifications;
CREATE TRIGGER update_notifications_updated_at
    BEFORE UPDATE ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_notification_rules_updated_at ON notification_rules;
CREATE TRIGGER update_notification_rules_updated_at
    BEFORE UPDATE ON notification_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_meta_tokens_updated_at ON user_meta_tokens;
CREATE TRIGGER update_user_meta_tokens_updated_at
    BEFORE UPDATE ON user_meta_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_meta_campaigns_updated_at ON meta_campaigns;
CREATE TRIGGER update_meta_campaigns_updated_at
    BEFORE UPDATE ON meta_campaigns
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sync_schedules_updated_at ON sync_schedules;
CREATE TRIGGER update_sync_schedules_updated_at
    BEFORE UPDATE ON sync_schedules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies

-- Notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications" ON notifications
    FOR DELETE USING (auth.uid() = user_id);

-- Notification Rules
ALTER TABLE notification_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view notification rules from their organization" ON notification_rules
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM memberships 
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

-- User Meta Tokens
ALTER TABLE user_meta_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own Meta tokens" ON user_meta_tokens
    FOR ALL USING (auth.uid() = user_id);

-- Meta Campaigns
ALTER TABLE meta_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view campaigns from their connections" ON meta_campaigns
    FOR SELECT USING (
        connection_id IN (
            SELECT id FROM client_meta_connections 
            WHERE created_by = auth.uid()
        )
    );

-- Meta Insights
ALTER TABLE meta_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view insights from their connections" ON meta_insights
    FOR SELECT USING (
        connection_id IN (
            SELECT id FROM client_meta_connections 
            WHERE created_by = auth.uid()
        )
    );

-- Sync Schedules
ALTER TABLE sync_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own sync schedules" ON sync_schedules
    FOR ALL USING (auth.uid() = user_id);

-- Sync Logs
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sync logs" ON sync_logs
    FOR SELECT USING (auth.uid() = user_id);

-- Comentários nas tabelas
COMMENT ON TABLE notifications IS 'Sistema de notificações in-app para usuários';
COMMENT ON TABLE notification_rules IS 'Regras automáticas para geração de notificações';
COMMENT ON TABLE user_meta_tokens IS 'Tokens de acesso do Meta Ads por usuário';
COMMENT ON TABLE meta_campaigns IS 'Campanhas sincronizadas do Meta Ads';
COMMENT ON TABLE meta_insights IS 'Dados de performance das campanhas Meta';
COMMENT ON TABLE sync_schedules IS 'Agendamentos de sincronização automática';
COMMENT ON TABLE sync_logs IS 'Histórico de execuções de sincronização';

-- Inserir regras de notificação padrão (exemplo)
INSERT INTO notification_rules (organization_id, name, description, condition, template, frequency, channels)
SELECT 
    id as organization_id,
    'Queda de Performance',
    'Notifica quando CTR de campanha fica abaixo de 1%',
    'campaign_performance_drop',
    '{"title": "Alerta: Queda de Performance", "message": "A campanha \"{{campaignName}}\" está com CTR de {{ctr}}%, abaixo do esperado.", "type": "warning", "category": "performance", "priority": "high", "actionUrl": "/dashboard/analytics/advanced", "actionLabel": "Ver Analytics"}',
    'daily',
    ARRAY['in_app', 'email']
FROM organizations
WHERE NOT EXISTS (
    SELECT 1 FROM notification_rules 
    WHERE organization_id = organizations.id 
    AND name = 'Queda de Performance'
);

-- Função para executar limpeza automática (pode ser chamada por cron)
CREATE OR REPLACE FUNCTION run_maintenance_tasks()
RETURNS void AS $$
BEGIN
    -- Limpar notificações antigas
    PERFORM cleanup_old_notifications();
    
    -- Marcar notificações antigas como lidas
    PERFORM auto_mark_old_notifications_read();
    
    -- Log da execução
    INSERT INTO sync_logs (user_id, sync_type, status, results, created_at)
    VALUES (
        '00000000-0000-0000-0000-000000000000'::uuid, 
        'maintenance', 
        'success', 
        '{"task": "cleanup_and_auto_read", "executed_at": "' || NOW() || '"}',
        NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;