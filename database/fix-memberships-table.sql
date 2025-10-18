-- Script para corrigir a tabela memberships
-- Execute este script no SQL Editor do Supabase

-- 1. Verificar a estrutura atual da tabela memberships
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'memberships'
ORDER BY ordinal_position;

-- 2. Adicionar coluna org_id se não existir
DO $$ 
BEGIN
    -- Verificar se a coluna org_id existe
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'memberships' 
        AND column_name = 'org_id'
    ) THEN
        -- Adicionar a coluna org_id
        ALTER TABLE memberships 
        ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
        
        RAISE NOTICE 'Coluna org_id adicionada à tabela memberships';
    ELSE
        RAISE NOTICE 'Coluna org_id já existe na tabela memberships';
    END IF;
END $$;

-- 3. Se a tabela memberships tiver dados sem org_id, precisamos corrigir
-- Primeiro, criar uma organização padrão se não existir
INSERT INTO organizations (name) 
SELECT 'Organização Padrão'
WHERE NOT EXISTS (SELECT 1 FROM organizations LIMIT 1);

-- 4. Atualizar registros de memberships que não têm org_id
DO $$
DECLARE
    default_org_id UUID;
BEGIN
    -- Pegar a primeira organização disponível
    SELECT id INTO default_org_id FROM organizations LIMIT 1;
    
    -- Atualizar memberships sem org_id
    UPDATE memberships 
    SET org_id = default_org_id 
    WHERE org_id IS NULL;
    
    RAISE NOTICE 'Memberships atualizadas com org_id padrão';
END $$;

-- 5. Tornar org_id NOT NULL se ainda não for
DO $$
BEGIN
    ALTER TABLE memberships 
    ALTER COLUMN org_id SET NOT NULL;
    
    RAISE NOTICE 'Coluna org_id configurada como NOT NULL';
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Não foi possível tornar org_id NOT NULL: %', SQLERRM;
END $$;

-- 6. Adicionar constraint UNIQUE se não existir
DO $$
BEGIN
    ALTER TABLE memberships 
    ADD CONSTRAINT memberships_user_org_unique UNIQUE (user_id, org_id);
    
    RAISE NOTICE 'Constraint UNIQUE adicionada';
EXCEPTION
    WHEN duplicate_table THEN
        RAISE NOTICE 'Constraint UNIQUE já existe';
END $$;

-- 7. Verificar o resultado final
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'memberships'
ORDER BY ordinal_position;

-- 8. Verificar dados
SELECT 
    m.id,
    u.email,
    o.name as organization_name,
    m.role,
    m.created_at
FROM memberships m
LEFT JOIN auth.users u ON m.user_id = u.id
LEFT JOIN organizations o ON m.org_id = o.id
ORDER BY m.created_at DESC;