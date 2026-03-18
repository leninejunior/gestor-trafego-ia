-- =============================================
-- Migration: User Access Control System
-- Date: 2025-12-16
-- Description: Implementa sistema completo de controle de acesso baseado em tipos de usuário
-- =============================================

-- 1. Criar enum para tipos de usuário
DO $$ BEGIN
    CREATE TYPE user_type_enum AS ENUM ('master', 'regular', 'client');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Criar tabela de tipos de usuário (master users)
CREATE TABLE IF NOT EXISTS master_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    UNIQUE(user_id)
);

-- 3. Criar tabela de usuários cliente (client users)
CREATE TABLE IF NOT EXISTS client_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    permissions JSONB DEFAULT '{"read_campaigns": true, "read_reports": true, "read_insights": true}'::jsonb,
    notes TEXT,
    UNIQUE(user_id, client_id)
);

-- 4. Adicionar coluna user_type na tabela memberships (para usuários regulares)
ALTER TABLE memberships 
ADD COLUMN IF NOT EXISTS user_type user_type_enum DEFAULT 'regular';

-- 5. Criar função para determinar tipo de usuário
CREATE OR REPLACE FUNCTION get_user_type(user_id_param UUID)
RETURNS user_type_enum
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result user_type_enum;
BEGIN
    -- Verificar se é master user
    SELECT 'master'::user_type_enum INTO result
    FROM master_users
    WHERE user_id = user_id_param AND is_active = true
    LIMIT 1;
    
    IF FOUND THEN
        RETURN result;
    END IF;
    
    -- Verificar se é client user
    SELECT 'client'::user_type_enum INTO result
    FROM client_users
    WHERE user_id = user_id_param AND is_active = true
    LIMIT 1;
    
    IF FOUND THEN
        RETURN result;
    END IF;
    
    -- Default: regular user
    RETURN 'regular'::user_type_enum;
END;
$$;

-- 6. Criar função para verificar permissões de usuário
CREATE OR REPLACE FUNCTION check_user_permissions(
    user_id_param UUID,
    resource_type TEXT,
    action TEXT,
    client_id_param UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_type_val user_type_enum;
    has_permission BOOLEAN := false;
    user_permissions JSONB;
BEGIN
    -- Obter tipo de usuário
    user_type_val := get_user_type(user_id_param);
    
    -- Master users têm acesso total
    IF user_type_val = 'master' THEN
        RETURN true;
    END IF;
    
    -- Client users têm acesso limitado
    IF user_type_val = 'client' THEN
        -- Verificar se o client_id corresponde ao usuário
        IF client_id_param IS NULL THEN
            RETURN false;
        END IF;
        
        SELECT permissions INTO user_permissions
        FROM client_users
        WHERE user_id = user_id_param 
        AND client_id = client_id_param 
        AND is_active = true;
        
        IF NOT FOUND THEN
            RETURN false;
        END IF;
        
        -- Verificar permissões específicas
        CASE resource_type
            WHEN 'campaigns' THEN
                has_permission := (user_permissions->>'read_campaigns')::boolean;
            WHEN 'reports' THEN
                has_permission := (user_permissions->>'read_reports')::boolean;
            WHEN 'insights' THEN
                has_permission := (user_permissions->>'read_insights')::boolean;
            ELSE
                has_permission := false;
        END CASE;
        
        RETURN has_permission AND action = 'read';
    END IF;
    
    -- Regular users: verificar assinatura ativa
    IF user_type_val = 'regular' THEN
        -- Verificar se tem organização com assinatura ativa
        SELECT EXISTS(
            SELECT 1
            FROM memberships m
            JOIN subscriptions s ON s.organization_id = m.organization_id
            WHERE m.user_id = user_id_param
            AND s.status = 'active'
        ) INTO has_permission;
        
        RETURN has_permission;
    END IF;
    
    RETURN false;
END;
$$;

-- 7. Criar função para obter limites do usuário
CREATE OR REPLACE FUNCTION get_user_limits(user_id_param UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_type_val user_type_enum;
    limits JSONB;
    plan_features JSONB;
BEGIN
    user_type_val := get_user_type(user_id_param);
    
    -- Master users não têm limites
    IF user_type_val = 'master' THEN
        RETURN '{
            "unlimited": true,
            "max_clients": null,
            "max_campaigns": null,
            "max_ad_accounts": null,
            "data_retention_days": null,
            "export_formats": ["csv", "json", "xlsx"]
        }'::jsonb;
    END IF;
    
    -- Client users têm acesso limitado
    IF user_type_val = 'client' THEN
        RETURN '{
            "unlimited": false,
            "max_clients": 1,
            "max_campaigns": null,
            "max_ad_accounts": 1,
            "data_retention_days": 30,
            "export_formats": ["csv"],
            "read_only": true
        }'::jsonb;
    END IF;
    
    -- Regular users: obter limites do plano
    SELECT sp.features INTO plan_features
    FROM memberships m
    JOIN subscriptions s ON s.organization_id = m.organization_id
    JOIN subscription_plans sp ON sp.id = s.plan_id
    WHERE m.user_id = user_id_param
    AND s.status = 'active'
    LIMIT 1;
    
    IF plan_features IS NULL THEN
        -- Sem plano ativo - limites básicos
        RETURN '{
            "unlimited": false,
            "max_clients": 1,
            "max_campaigns": 5,
            "max_ad_accounts": 1,
            "data_retention_days": 7,
            "export_formats": []
        }'::jsonb;
    END IF;
    
    RETURN plan_features;
END;
$$;

-- 8. Habilitar RLS nas novas tabelas
ALTER TABLE master_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_users ENABLE ROW LEVEL SECURITY;

-- 9. Políticas RLS para master_users
CREATE POLICY "master_users_self_read" ON master_users
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "master_users_admin_all" ON master_users
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM master_users mu
            WHERE mu.user_id = auth.uid() AND mu.is_active = true
        )
    );

-- 10. Políticas RLS para client_users
CREATE POLICY "client_users_self_read" ON client_users
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "client_users_org_admin_all" ON client_users
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM memberships m
            JOIN clients c ON c.org_id = m.organization_id
            WHERE m.user_id = auth.uid()
            AND c.id = client_users.client_id
            AND m.role = 'admin'
        )
    );

CREATE POLICY "client_users_master_all" ON client_users
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM master_users mu
            WHERE mu.user_id = auth.uid() AND mu.is_active = true
        )
    );

-- 11. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_master_users_user_id ON master_users(user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_client_users_user_id ON client_users(user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_client_users_client_id ON client_users(client_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_memberships_user_type ON memberships(user_type);

-- 12. Triggers para updated_at
CREATE TRIGGER update_master_users_updated_at
    BEFORE UPDATE ON master_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_client_users_updated_at
    BEFORE UPDATE ON client_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 13. Comentários para documentação
COMMENT ON TABLE master_users IS 'Usuários master com acesso ilimitado ao sistema';
COMMENT ON TABLE client_users IS 'Usuários cliente com acesso restrito aos dados de sua agência';
COMMENT ON FUNCTION get_user_type(UUID) IS 'Determina o tipo de usuário (master, regular, client)';
COMMENT ON FUNCTION check_user_permissions(UUID, TEXT, TEXT, UUID) IS 'Verifica permissões de acesso baseadas no tipo de usuário';
COMMENT ON FUNCTION get_user_limits(UUID) IS 'Retorna limites e recursos disponíveis para o usuário';

-- 14. Inserir usuário master inicial (substitua pelo email do admin)
-- INSERT INTO master_users (user_id, created_by, notes)
-- SELECT id, id, 'Usuário master inicial criado durante migração'
-- FROM auth.users
-- WHERE email = 'admin@example.com'
-- ON CONFLICT (user_id) DO NOTHING;