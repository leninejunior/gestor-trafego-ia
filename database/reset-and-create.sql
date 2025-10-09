-- SCRIPT DE RESET COMPLETO DO BANCO DE DADOS
-- Este script apaga tudo e recria do zero
-- Execute no SQL Editor do Supabase

-- ========================================
-- 1. REMOVER TODAS AS TABELAS E FUNÇÕES
-- ========================================

-- Desabilitar RLS temporariamente
ALTER TABLE IF EXISTS organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS memberships DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS client_meta_connections DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ad_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS oauth_tokens DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS meta_campaigns DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS meta_campaign_insights DISABLE ROW LEVEL SECURITY;

-- Remover todas as políticas RLS
DROP POLICY IF EXISTS "Users can view their own organizations" ON organizations;
DROP POLICY IF EXISTS "Users can update their own organizations" ON organizations;
DROP POLICY IF EXISTS "Users can view their own memberships" ON memberships;
DROP POLICY IF EXISTS "Users can insert their own memberships" ON memberships;
DROP POLICY IF EXISTS "Users can view their own clients" ON clients;
DROP POLICY IF EXISTS "Users can insert their own clients" ON clients;
DROP POLICY IF EXISTS "Users can update their own clients" ON clients;
DROP POLICY IF EXISTS "Users can view their own client meta connections" ON client_meta_connections;
DROP POLICY IF EXISTS "Users can insert their own client meta connections" ON client_meta_connections;
DROP POLICY IF EXISTS "Users can view their own ad accounts" ON ad_accounts;
DROP POLICY IF EXISTS "Users can insert their own ad accounts" ON ad_accounts;
DROP POLICY IF EXISTS "Users can view their own oauth tokens" ON oauth_tokens;
DROP POLICY IF EXISTS "Users can insert their own oauth tokens" ON oauth_tokens;
DROP POLICY IF EXISTS "Users can update their own oauth tokens" ON oauth_tokens;

-- Remover triggers
DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
DROP TRIGGER IF EXISTS update_memberships_updated_at ON memberships;
DROP TRIGGER IF EXISTS update_clients_updated_at ON clients;
DROP TRIGGER IF EXISTS update_client_meta_connections_updated_at ON client_meta_connections;
DROP TRIGGER IF EXISTS update_ad_accounts_updated_at ON ad_accounts;
DROP TRIGGER IF EXISTS update_oauth_tokens_updated_at ON oauth_tokens;
DROP TRIGGER IF EXISTS update_meta_campaigns_updated_at ON meta_campaigns;
DROP TRIGGER IF EXISTS update_meta_campaign_insights_updated_at ON meta_campaign_insights;

-- Remover tabelas (ordem inversa devido às dependências)
DROP TABLE IF EXISTS meta_campaign_insights CASCADE;
DROP TABLE IF EXISTS meta_campaigns CASCADE;
DROP TABLE IF EXISTS oauth_tokens CASCADE;
DROP TABLE IF EXISTS ad_accounts CASCADE;
DROP TABLE IF EXISTS client_meta_connections CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS memberships CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;

-- Remover funções
DROP FUNCTION IF EXISTS create_org_and_add_admin();
DROP FUNCTION IF EXISTS update_updated_at_column();

-- ========================================
-- 2. CRIAR TUDO NOVAMENTE DO ZERO
-- ========================================

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Tabela de organizações
CREATE TABLE organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Minha Organização',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de memberships (usuário-organização)
CREATE TABLE memberships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'admin',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, org_id)
);

-- Tabela de clientes
CREATE TABLE clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela para conexões Meta Ads
CREATE TABLE client_meta_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  ad_account_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  account_name TEXT,
  currency TEXT DEFAULT 'BRL',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(client_id, ad_account_id)
);

-- Tabela para contas de anúncios (Google Ads e outros)
CREATE TABLE ad_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'google', 'meta', etc.
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  currency TEXT DEFAULT 'BRL',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(client_id, external_id, provider)
);

-- Tabela para tokens OAuth
CREATE TABLE oauth_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ad_account_id UUID NOT NULL REFERENCES ad_accounts(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(ad_account_id)
);

-- Tabela para campanhas Meta
CREATE TABLE meta_campaigns (
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

-- Tabela para insights de campanhas Meta
CREATE TABLE meta_campaign_insights (
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

-- ========================================
-- 3. CRIAR ÍNDICES
-- ========================================

CREATE INDEX idx_memberships_user_id ON memberships(user_id);
CREATE INDEX idx_memberships_org_id ON memberships(org_id);
CREATE INDEX idx_clients_org_id ON clients(org_id);
CREATE INDEX idx_client_meta_connections_client_id ON client_meta_connections(client_id);
CREATE INDEX idx_ad_accounts_client_id ON ad_accounts(client_id);
CREATE INDEX idx_ad_accounts_org_id ON ad_accounts(org_id);
CREATE INDEX idx_oauth_tokens_ad_account_id ON oauth_tokens(ad_account_id);

-- ========================================
-- 4. CRIAR TRIGGERS
-- ========================================

CREATE TRIGGER update_organizations_updated_at 
    BEFORE UPDATE ON organizations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_memberships_updated_at 
    BEFORE UPDATE ON memberships 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at 
    BEFORE UPDATE ON clients 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_client_meta_connections_updated_at 
    BEFORE UPDATE ON client_meta_connections 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ad_accounts_updated_at 
    BEFORE UPDATE ON ad_accounts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oauth_tokens_updated_at 
    BEFORE UPDATE ON oauth_tokens 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meta_campaigns_updated_at 
    BEFORE UPDATE ON meta_campaigns 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meta_campaign_insights_updated_at 
    BEFORE UPDATE ON meta_campaign_insights 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- 5. FUNÇÃO PARA CRIAR ORGANIZAÇÃO
-- ========================================

CREATE OR REPLACE FUNCTION create_org_and_add_admin()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_org_id UUID;
  current_user_id UUID;
BEGIN
  -- Obter o ID do usuário atual
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- Criar nova organização
  INSERT INTO organizations (name)
  VALUES ('Minha Organização')
  RETURNING id INTO new_org_id;

  -- Adicionar usuário como admin da organização
  INSERT INTO memberships (user_id, org_id, role)
  VALUES (current_user_id, new_org_id, 'admin');

  RETURN new_org_id;
END;
$$;

-- ========================================
-- 6. HABILITAR RLS E CRIAR POLÍTICAS
-- ========================================

-- Habilitar RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_meta_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_campaign_insights ENABLE ROW LEVEL SECURITY;

-- Políticas para organizations
CREATE POLICY "Users can view their own organizations" ON organizations
    FOR SELECT USING (
        id IN (
            SELECT org_id FROM memberships 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own organizations" ON organizations
    FOR UPDATE USING (
        id IN (
            SELECT org_id FROM memberships 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Políticas para memberships
CREATE POLICY "Users can view their own memberships" ON memberships
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own memberships" ON memberships
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Políticas para clients
CREATE POLICY "Users can view their own clients" ON clients
    FOR SELECT USING (
        org_id IN (
            SELECT org_id FROM memberships 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own clients" ON clients
    FOR INSERT WITH CHECK (
        org_id IN (
            SELECT org_id FROM memberships 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own clients" ON clients
    FOR UPDATE USING (
        org_id IN (
            SELECT org_id FROM memberships 
            WHERE user_id = auth.uid()
        )
    );

-- Políticas para client_meta_connections
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

-- Políticas para ad_accounts
CREATE POLICY "Users can view their own ad accounts" ON ad_accounts
    FOR SELECT USING (
        org_id IN (
            SELECT org_id FROM memberships 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own ad accounts" ON ad_accounts
    FOR INSERT WITH CHECK (
        org_id IN (
            SELECT org_id FROM memberships 
            WHERE user_id = auth.uid()
        )
    );

-- Políticas para oauth_tokens
CREATE POLICY "Users can view their own oauth tokens" ON oauth_tokens
    FOR SELECT USING (
        org_id IN (
            SELECT org_id FROM memberships 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own oauth tokens" ON oauth_tokens
    FOR INSERT WITH CHECK (
        org_id IN (
            SELECT org_id FROM memberships 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own oauth tokens" ON oauth_tokens
    FOR UPDATE USING (
        org_id IN (
            SELECT org_id FROM memberships 
            WHERE user_id = auth.uid()
        )
    );

-- Políticas para meta_campaigns
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

-- Políticas para meta_campaign_insights
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

-- ========================================
-- 7. VERIFICAÇÃO FINAL
-- ========================================

-- Verificar se todas as tabelas foram criadas
SELECT 
    'Tabela criada: ' || table_name as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'organizations', 
    'memberships', 
    'clients', 
    'client_meta_connections', 
    'ad_accounts', 
    'oauth_tokens', 
    'meta_campaigns', 
    'meta_campaign_insights'
)
ORDER BY table_name;

-- Verificar se a função foi criada
SELECT 
    'Função criada: ' || routine_name as status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'create_org_and_add_admin';

-- Mensagem de sucesso
SELECT '✅ BANCO DE DADOS RESETADO E RECRIADO COM SUCESSO!' as resultado;