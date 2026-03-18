-- Schema para gerenciamento completo de usuários
-- Adicionar colunas para suspensão e controle de usuários

-- Adicionar colunas de suspensão na tabela user_profiles
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS suspended_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS last_sign_in_at TIMESTAMPTZ;

-- Adicionar colunas de remoção na tabela memberships
ALTER TABLE memberships 
ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS removed_by UUID REFERENCES auth.users(id);

-- Renomear coluna org_id para organization_id se necessário
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'memberships' AND column_name = 'org_id') THEN
        ALTER TABLE memberships RENAME COLUMN org_id TO organization_id;
    END IF;
END $$;

-- Criar tabela para histórico de atividades dos usuários
CREATE TABLE IF NOT EXISTS user_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    details JSONB,
    performed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_user_activities_user_id ON user_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activities_created_at ON user_activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activities_action ON user_activities(action);

-- Adicionar metadados aos convites (usando organization_invites que já existe)
ALTER TABLE organization_invites 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Função para registrar atividades automaticamente
CREATE OR REPLACE FUNCTION log_user_activity()
RETURNS TRIGGER AS $$
BEGIN
    -- Log para suspensão de usuário
    IF TG_OP = 'UPDATE' AND OLD.is_suspended = FALSE AND NEW.is_suspended = TRUE THEN
        INSERT INTO user_activities (user_id, action, details, performed_by)
        VALUES (NEW.id, 'user_suspended', 
                jsonb_build_object('reason', NEW.suspension_reason), 
                NEW.suspended_by);
    END IF;
    
    -- Log para reativação de usuário
    IF TG_OP = 'UPDATE' AND OLD.is_suspended = TRUE AND NEW.is_suspended = FALSE THEN
        INSERT INTO user_activities (user_id, action, details, performed_by)
        VALUES (NEW.id, 'user_unsuspended', 
                jsonb_build_object('previous_reason', OLD.suspension_reason), 
                COALESCE(NEW.suspended_by, auth.uid()));
    END IF;
    
    -- Log para deleção de usuário
    IF TG_OP = 'UPDATE' AND OLD.is_deleted = FALSE AND NEW.is_deleted = TRUE THEN
        INSERT INTO user_activities (user_id, action, details, performed_by)
        VALUES (NEW.id, 'user_deleted', 
                jsonb_build_object('email', NEW.email), 
                NEW.deleted_by);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para log automático
DROP TRIGGER IF EXISTS trigger_log_user_activity ON user_profiles;
CREATE TRIGGER trigger_log_user_activity
    AFTER UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION log_user_activity();

-- Função para registrar atividades de membership
CREATE OR REPLACE FUNCTION log_membership_activity()
RETURNS TRIGGER AS $$
BEGIN
    -- Log para mudança de role
    IF TG_OP = 'UPDATE' AND OLD.role_id != NEW.role_id THEN
        INSERT INTO user_activities (user_id, action, details, performed_by)
        VALUES (NEW.user_id, 'role_changed', 
                jsonb_build_object(
                    'old_role_id', OLD.role_id,
                    'new_role_id', NEW.role_id,
                    'organization_id', NEW.organization_id
                ), 
                auth.uid());
    END IF;
    
    -- Log para remoção da organização
    IF TG_OP = 'UPDATE' AND OLD.status != 'removed' AND NEW.status = 'removed' THEN
        INSERT INTO user_activities (user_id, action, details, performed_by)
        VALUES (NEW.user_id, 'removed_from_organization', 
                jsonb_build_object('organization_id', NEW.organization_id), 
                NEW.removed_by);
    END IF;
    
    -- Log para aceitação de convite
    IF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'active' THEN
        INSERT INTO user_activities (user_id, action, details, performed_by)
        VALUES (NEW.user_id, 'invite_accepted', 
                jsonb_build_object('organization_id', NEW.organization_id), 
                NEW.user_id);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para log de membership
DROP TRIGGER IF EXISTS trigger_log_membership_activity ON memberships;
CREATE TRIGGER trigger_log_membership_activity
    AFTER UPDATE ON memberships
    FOR EACH ROW
    EXECUTE FUNCTION log_membership_activity();

-- RLS Policies para user_activities
ALTER TABLE user_activities ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Super admins can view all activities" ON user_activities;
DROP POLICY IF EXISTS "Users can view own activities" ON user_activities;
DROP POLICY IF EXISTS "Super admins can insert activities" ON user_activities;

-- Super admins podem ver todas as atividades
CREATE POLICY "Super admins can view all activities" ON user_activities
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM memberships m
            JOIN user_roles ur ON m.role_id = ur.id
            WHERE m.user_id = auth.uid()
            AND m.status = 'active'
            AND ur.name = 'super_admin'
        )
    );

-- Usuários podem ver suas próprias atividades
CREATE POLICY "Users can view own activities" ON user_activities
    FOR SELECT USING (user_id = auth.uid());

-- Super admins podem inserir atividades
CREATE POLICY "Super admins can insert activities" ON user_activities
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM memberships m
            JOIN user_roles ur ON m.role_id = ur.id
            WHERE m.user_id = auth.uid()
            AND m.status = 'active'
            AND ur.name = 'super_admin'
        )
    );

-- Função para buscar usuários com filtros (para super admins)
CREATE OR REPLACE FUNCTION get_users_for_admin(
    search_term TEXT DEFAULT NULL,
    status_filter TEXT DEFAULT 'all',
    role_filter TEXT DEFAULT 'all',
    page_num INTEGER DEFAULT 1,
    page_size INTEGER DEFAULT 50
)
RETURNS TABLE (
    user_data JSONB,
    total_count BIGINT
) AS $$
DECLARE
    offset_val INTEGER;
BEGIN
    -- Verificar se é super admin
    IF NOT EXISTS (
        SELECT 1 FROM memberships m
        JOIN user_roles ur ON m.role_id = ur.id
        WHERE m.user_id = auth.uid()
        AND m.status = 'active'
        AND ur.name = 'super_admin'
    ) THEN
        RAISE EXCEPTION 'Access denied: Super admin required';
    END IF;
    
    offset_val := (page_num - 1) * page_size;
    
    RETURN QUERY
    WITH filtered_users AS (
        SELECT 
            up.*,
            COUNT(*) OVER() as total_count
        FROM user_profiles up
        WHERE 
            (search_term IS NULL OR 
             up.first_name ILIKE '%' || search_term || '%' OR
             up.last_name ILIKE '%' || search_term || '%' OR
             up.email ILIKE '%' || search_term || '%')
        AND up.is_deleted = FALSE
        ORDER BY up.created_at DESC
        LIMIT page_size OFFSET offset_val
    )
    SELECT 
        jsonb_build_object(
            'id', fu.id,
            'first_name', fu.first_name,
            'last_name', fu.last_name,
            'email', fu.email,
            'created_at', fu.created_at,
            'last_sign_in_at', fu.last_sign_in_at,
            'is_suspended', fu.is_suspended,
            'suspended_at', fu.suspended_at,
            'suspension_reason', fu.suspension_reason,
            'memberships', COALESCE(
                (SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', m.id,
                        'role', m.role,
                        'status', m.status,
                        'created_at', m.created_at,
                        'accepted_at', m.accepted_at,
                        'organization_id', m.organization_id,
                        'role_id', m.role_id,
                        'organizations', jsonb_build_object(
                            'id', o.id,
                            'name', o.name,
                            'created_at', o.created_at
                        ),
                        'user_roles', jsonb_build_object(
                            'id', ur.id,
                            'name', ur.name,
                            'permissions', ur.permissions,
                            'description', ur.description
                        )
                    )
                ) FROM memberships m
                LEFT JOIN organizations o ON m.organization_id = o.id
                LEFT JOIN user_roles ur ON m.role_id = ur.id
                WHERE m.user_id = fu.id
                AND m.status != 'removed'),
                '[]'::jsonb
            )
        ) as user_data,
        fu.total_count
    FROM filtered_users fu;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentários para documentação
COMMENT ON TABLE user_activities IS 'Histórico de atividades e ações realizadas pelos usuários';
COMMENT ON COLUMN user_profiles.is_suspended IS 'Indica se o usuário está suspenso';
COMMENT ON COLUMN user_profiles.suspended_at IS 'Data e hora da suspensão';
COMMENT ON COLUMN user_profiles.suspended_by IS 'ID do usuário que realizou a suspensão';
COMMENT ON COLUMN user_profiles.suspension_reason IS 'Motivo da suspensão';
COMMENT ON FUNCTION get_users_for_admin IS 'Função para buscar usuários com filtros (apenas super admins)';

-- Função para sincronizar dados do auth.users com user_profiles
CREATE OR REPLACE FUNCTION sync_user_profiles_with_auth()
RETURNS VOID AS $$
BEGIN
    -- Atualizar emails dos user_profiles com dados do auth.users
    UPDATE user_profiles 
    SET email = au.email,
        created_at = COALESCE(user_profiles.created_at, au.created_at),
        last_sign_in_at = au.last_sign_in_at
    FROM auth.users au
    WHERE user_profiles.user_id = au.id
    AND (user_profiles.email IS NULL OR user_profiles.email != au.email);
    
    -- Criar user_profiles para usuários que não têm
    INSERT INTO user_profiles (user_id, email, first_name, last_name, created_at, last_sign_in_at)
    SELECT 
        au.id,
        au.email,
        COALESCE(au.raw_user_meta_data->>'first_name', ''),
        COALESCE(au.raw_user_meta_data->>'last_name', ''),
        au.created_at,
        au.last_sign_in_at
    FROM auth.users au
    WHERE NOT EXISTS (
        SELECT 1 FROM user_profiles up WHERE up.user_id = au.id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Executar sincronização
SELECT sync_user_profiles_with_auth();

-- Inserir algumas atividades de exemplo para usuários existentes
INSERT INTO user_activities (user_id, action, details, performed_by)
SELECT 
    up.user_id,
    'user_created',
    jsonb_build_object('email', up.email, 'created_via', 'system'),
    up.user_id
FROM user_profiles up
WHERE NOT EXISTS (
    SELECT 1 FROM user_activities ua 
    WHERE ua.user_id = up.user_id 
    AND ua.action = 'user_created'
)
LIMIT 10;