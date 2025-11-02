-- EXECUTAR AGORA: Fix Subscription Schema
-- Execute este SQL no Supabase SQL Editor para corrigir o schema de subscriptions

-- 1. Renomear coluna org_id para organization_id
ALTER TABLE subscriptions 
RENAME COLUMN org_id TO organization_id;

-- 2. Adicionar foreign key para subscription_plans se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'subscriptions_plan_id_fkey' 
        AND table_name = 'subscriptions'
    ) THEN
        ALTER TABLE subscriptions 
        ADD CONSTRAINT subscriptions_plan_id_fkey 
        FOREIGN KEY (plan_id) REFERENCES subscription_plans(id) ON DELETE RESTRICT;
    END IF;
END $$;

-- 3. Adicionar foreign key para organizations se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'subscriptions_organization_id_fkey' 
        AND table_name = 'subscriptions'
    ) THEN
        ALTER TABLE subscriptions 
        ADD CONSTRAINT subscriptions_organization_id_fkey 
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 4. Atualizar estatísticas das tabelas para forçar refresh do cache
ANALYZE subscriptions;
ANALYZE subscription_plans;
ANALYZE organizations;

-- 5. Verificar se as relações estão funcionando
SELECT 
    s.id,
    s.status,
    s.organization_id,
    sp.name as plan_name,
    sp.monthly_price
FROM subscriptions s
JOIN subscription_plans sp ON s.plan_id = sp.id
LIMIT 5;

-- Se a query acima funcionar, o schema está correto!