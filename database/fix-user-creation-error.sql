-- Fix para erro na criação de usuário
-- Este script corrige problemas com o trigger de criação de perfil de usuário

-- 1. Verificar se a tabela user_profiles existe
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_profiles') THEN
        -- Criar tabela user_profiles se não existir
        CREATE TABLE user_profiles (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
            first_name TEXT,
            last_name TEXT,
            avatar_url TEXT,
            phone TEXT,
            timezone TEXT DEFAULT 'America/Sao_Paulo',
            language TEXT DEFAULT 'pt-BR',
            onboarding_completed BOOLEAN DEFAULT false,
            last_login_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        RAISE NOTICE 'Tabela user_profiles criada com sucesso';
    ELSE
        RAISE NOTICE 'Tabela user_profiles já existe';
    END IF;
END $$;

-- 2. Habilitar RLS na tabela user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 3. Criar políticas RLS para user_profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
CREATE POLICY "Users can view their own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
CREATE POLICY "Users can update their own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;
CREATE POLICY "Users can insert their own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 4. Criar função segura para criar perfil de usuário
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Tentar inserir o perfil, ignorar se já existir
    INSERT INTO user_profiles (user_id, first_name, last_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'last_name', '')
    )
    ON CONFLICT (user_id) DO NOTHING;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log do erro mas não falha a criação do usuário
        RAISE WARNING 'Erro ao criar perfil do usuário %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;

-- 5. Recriar o trigger
DROP TRIGGER IF EXISTS create_user_profile_trigger ON auth.users;
CREATE TRIGGER create_user_profile_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION create_user_profile();

-- 6. Verificar se há usuários sem perfil e criar perfis para eles
INSERT INTO user_profiles (user_id, first_name, last_name)
SELECT 
    u.id,
    COALESCE(u.raw_user_meta_data->>'first_name', ''),
    COALESCE(u.raw_user_meta_data->>'last_name', '')
FROM auth.users u
LEFT JOIN user_profiles up ON u.id = up.user_id
WHERE up.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- 7. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

-- 8. Verificar se tudo está funcionando
DO $$
DECLARE
    user_count INTEGER;
    profile_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_count FROM auth.users;
    SELECT COUNT(*) INTO profile_count FROM user_profiles;
    
    RAISE NOTICE 'Usuários: %, Perfis: %', user_count, profile_count;
    
    IF user_count > profile_count THEN
        RAISE WARNING 'Há % usuários sem perfil', (user_count - profile_count);
    ELSE
        RAISE NOTICE 'Todos os usuários têm perfil criado';
    END IF;
END $$;