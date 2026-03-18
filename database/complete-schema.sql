-- Schema completo para o sistema de Ads Manager
-- Execute este script no SQL Editor do Supabase

-- 1. Criar tabela de organizações
CREATE TABLE IF NOT EXISTS organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Organização Padrão',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Criar tabela de memberships (associação usuário-organização)
CREATE TABLE IF NOT EXISTS memberships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'admin',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, org_id)
);

-- 3. Criar tabela de clientes
CREATE TABLE IF NOT EXISTS clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Criar tabela para conexões Meta Ads
CREATE TABLE IF NOT EXISTS client_meta_connections (
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

-- 5. Criar tabela para contas de anúncios (Google Ads e outros)
CREATE TABLE IF NOT EXISTS ad_accounts (
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

-- 6. Criar tabela para tokens OAuth
CREATE TABLE IF NOT EXISTS oauth_tokens (
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

-- 7. Criar tabela para campanhas Meta
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

-- 8. Criar tabela para insights de campanhas Meta
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

-- 9. Criar função para criar organização e adicionar admin
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

-- 10. Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_org_id ON memberships(org_id);
CREATE INDEX IF NOT EXISTS idx_clients_org_id ON clients(org_id);
CREATE INDEX IF NOT EXISTS idx_client_meta_connections_client_id ON client_meta_connections(client_id);
CREATE INDEX IF NOT EXISTS idx_ad_accounts_client_id ON ad_accounts(client_id);
CREATE INDEX IF NOT EXISTS idx_ad_accounts_org_id ON ad_accounts(org_id);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_ad_account_id ON oauth_tokens(ad_account_id);

-- 11. Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplicar trigger em todas as tabelas
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

-- 12. Habilitar RLS (Row Level Security)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_meta_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_campaign_insights ENABLE ROW LEVEL SECURITY;

-- 13. Políticas RLS para organizations
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

-- 14. Políticas RLS para memberships
CREATE POLICY "Users can view their own memberships" ON memberships
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own memberships" ON memberships
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- 15. Políticas RLS para clients
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

-- 16. Políticas RLS para client_meta_connections
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

-- 17. Políticas RLS para ad_accounts
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

-- 18. Políticas RLS para oauth_tokens
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

-- 19. Inserir dados de exemplo (opcional)
-- Descomente as linhas abaixo se quiser dados de teste

-- INSERT INTO organizations (name) VALUES ('Organização de Exemplo');
-- INSERT INTO clients (name, org_id) 
-- SELECT 'Cliente Exemplo', id FROM organizations WHERE name = 'Organização de Exemplo';

-- Fim do script