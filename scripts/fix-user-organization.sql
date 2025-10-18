-- Script para corrigir problema de usuários sem organização
-- Execute este script no SQL Editor do Supabase

-- 1. Criar uma organização padrão se não existir
INSERT INTO organizations (name) 
SELECT 'Organização Padrão'
WHERE NOT EXISTS (SELECT 1 FROM organizations LIMIT 1);

-- 2. Obter o ID da primeira organização (ou a que acabamos de criar)
DO $$
DECLARE
    default_org_id UUID;
    user_record RECORD;
BEGIN
    -- Pegar a primeira organização disponível
    SELECT id INTO default_org_id FROM organizations LIMIT 1;
    
    -- Para cada usuário que não tem membership, criar uma
    FOR user_record IN 
        SELECT u.id as user_id
        FROM auth.users u
        LEFT JOIN memberships m ON u.id = m.user_id
        WHERE m.user_id IS NULL
    LOOP
        INSERT INTO memberships (user_id, org_id, role)
        VALUES (user_record.user_id, default_org_id, 'admin')
        ON CONFLICT (user_id, org_id) DO NOTHING;
        
        RAISE NOTICE 'Criada membership para usuário: %', user_record.user_id;
    END LOOP;
END $$;

-- 3. Verificar o resultado
SELECT 
    u.email,
    o.name as organization_name,
    m.role
FROM auth.users u
JOIN memberships m ON u.id = m.user_id
JOIN organizations o ON m.org_id = o.id;