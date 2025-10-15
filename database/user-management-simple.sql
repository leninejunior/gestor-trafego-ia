-- Schema simplificado para gerenciamento de usuários
-- Execute este SQL diretamente no Supabase SQL Editor

-- 1. Adicionar colunas de suspensão na tabela user_profiles
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS suspended_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS last_sign_in_at TIMESTAMPTZ;

-- 2. Adicionar colunas de remoção na tabela memberships
ALTER TABLE memberships 
ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS removed_by UUID REFERENCES auth.users(id);

-- 3. Criar tabela para histórico de atividades dos usuários
CREATE TABLE IF NOT EXISTS user_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    details JSONB,
    performed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Índices para performance
CREATE INDEX IF NOT EXISTS idx_user_activities_user_id ON user_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activities_created_at ON user_activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activities_action ON user_activities(action);

-- 5. Adicionar metadados aos convites
ALTER TABLE organization_invites 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 6. Função para sincronizar dados do auth.users com user_profiles
CREATE OR REPLACE FUNCTION sync_user_profiles_with_auth()
RETURNS VOID AS $$
BEGIN
    -- Atualizar emails dos user_profiles com dados do auth.users
    UPDATE user_profiles 
    SET email = au.email,
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

-- 7. Executar sincronização
SELECT sync_user_profiles_with_auth();

-- 8. RLS Policies para user_activities
ALTER TABLE user_activities ENABLE ROW LEVEL SECURITY;

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

-- 9. Inserir algumas atividades de exemplo
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

-- Comentários
COMMENT ON TABLE user_activities IS 'Histórico de atividades e ações realizadas pelos usuários';
COMMENT ON COLUMN user_profiles.is_suspended IS 'Indica se o usuário está suspenso';
COMMENT ON COLUMN user_profiles.suspended_at IS 'Data e hora da suspensão';
COMMENT ON COLUMN user_profiles.suspended_by IS 'ID do usuário que realizou a suspensão';
COMMENT ON COLUMN user_profiles.suspension_reason IS 'Motivo da suspensão';