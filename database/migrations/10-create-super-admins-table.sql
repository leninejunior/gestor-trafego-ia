-- =============================================
-- Migration: Create Super Admins Table
-- Date: 2025-12-18
-- Description: Creates super_admins table as specified in design document and migrates data from master_users
-- =============================================

-- 1. Create super_admins table as specified in design document
CREATE TABLE IF NOT EXISTS super_admins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    UNIQUE(user_id)
);

-- 2. Migrate existing data from master_users to super_admins (if master_users exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'master_users') THEN
        INSERT INTO super_admins (user_id, created_by, created_at, updated_at, is_active, notes)
        SELECT 
            user_id, 
            created_by, 
            created_at, 
            updated_at, 
            is_active, 
            COALESCE(notes, 'Migrated from master_users table')
        FROM master_users
        ON CONFLICT (user_id) DO NOTHING;
        
        RAISE NOTICE 'Migrated % records from master_users to super_admins', 
            (SELECT COUNT(*) FROM master_users);
    END IF;
END $$;

-- 3. Enable RLS on super_admins table
ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies for super_admins

-- Super admins can see themselves
CREATE POLICY "super_admins_self_read" ON super_admins
    FOR SELECT USING (user_id = auth.uid());

-- Super admins can manage other super admins
CREATE POLICY "super_admins_admin_all" ON super_admins
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM super_admins sa
            WHERE sa.user_id = auth.uid() AND sa.is_active = true
        )
    );

-- Service role has full access
CREATE POLICY "service_role_full_access_super_admins"
  ON super_admins
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_super_admins_user_id ON super_admins(user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_super_admins_active ON super_admins(is_active);

-- 6. Create trigger for updated_at
CREATE TRIGGER update_super_admins_updated_at
    BEFORE UPDATE ON super_admins
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. Update existing functions to use super_admins instead of master_users
CREATE OR REPLACE FUNCTION get_user_type(user_id_param UUID)
RETURNS user_type_enum
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
    result user_type_enum;
BEGIN
    -- Verificar se é super admin (updated to use super_admins table)
    SELECT 'master'::user_type_enum INTO result
    FROM super_admins
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
$func$;

-- 8. Update permissions function to use super_admins
CREATE OR REPLACE FUNCTION check_user_permissions(
    user_id_param UUID,
    resource_type TEXT,
    action TEXT,
    client_id_param UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
    user_type_val user_type_enum;
    has_permission BOOLEAN := false;
    user_permissions JSONB;
BEGIN
    -- Obter tipo de usuário
    user_type_val := get_user_type(user_id_param);
    
    -- Super admins têm acesso total (updated to use super_admins logic)
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
$func$;

-- 9. Update limits function to use super_admins
CREATE OR REPLACE FUNCTION get_user_limits(user_id_param UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
    user_type_val user_type_enum;
    limits JSONB;
    plan_features JSONB;
BEGIN
    user_type_val := get_user_type(user_id_param);
    
    -- Super admins não têm limites (updated to use super_admins logic)
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
$func$;

-- 10. Add comments for documentation
COMMENT ON TABLE super_admins IS 'Super admin users with unlimited access to the system (replaces master_users)';
COMMENT ON COLUMN super_admins.user_id IS 'Reference to auth.users - the super admin user';
COMMENT ON COLUMN super_admins.created_by IS 'Which super admin created this record';
COMMENT ON COLUMN super_admins.is_active IS 'Whether this super admin is currently active';
COMMENT ON COLUMN super_admins.notes IS 'Optional notes about this super admin';

-- 11. Optional: Drop master_users table after successful migration (uncomment if desired)
-- WARNING: Only run this after verifying the migration was successful
-- DROP TABLE IF EXISTS master_users CASCADE;

RAISE NOTICE 'Super admins table created successfully. Migration complete.';