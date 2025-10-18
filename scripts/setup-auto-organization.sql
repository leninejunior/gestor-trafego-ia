-- Script para configurar criação automática de organização para novos usuários
-- Execute este script no SQL Editor do Supabase

-- 1. Função para lidar com novos usuários
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_org_id UUID;
BEGIN
    -- Verificar se já existe uma organização padrão
    SELECT id INTO default_org_id 
    FROM organizations 
    WHERE name = 'Organização Padrão' 
    LIMIT 1;
    
    -- Se não existir, criar uma
    IF default_org_id IS NULL THEN
        INSERT INTO organizations (name) 
        VALUES ('Organização Padrão') 
        RETURNING id INTO default_org_id;
    END IF;
    
    -- Criar membership para o novo usuário
    INSERT INTO memberships (user_id, org_id, role)
    VALUES (NEW.id, default_org_id, 'admin')
    ON CONFLICT (user_id, org_id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Criar trigger para executar a função quando um novo usuário for criado
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 3. Verificar se o trigger foi criado
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';