-- Script para migrar dados existentes para a nova estrutura SaaS
-- Execute apenas se você tinha dados antes do schema SaaS

-- 1. Verificar se existem clientes sem org_id
DO $$
DECLARE
  orphan_clients_count INTEGER;
  user_record RECORD;
  new_org_id UUID;
  owner_role_id UUID;
BEGIN
  -- Contar clientes órfãos
  SELECT COUNT(*) INTO orphan_clients_count
  FROM clients 
  WHERE org_id IS NULL;
  
  RAISE NOTICE 'Encontrados % clientes sem organização', orphan_clients_count;
  
  IF orphan_clients_count > 0 THEN
    -- Buscar role de owner
    SELECT id INTO owner_role_id
    FROM user_roles
    WHERE name = 'owner'
    LIMIT 1;
    
    -- Para cada usuário que tem clientes órfãos, criar organização
    FOR user_record IN 
      SELECT DISTINCT u.id, u.email
      FROM auth.users u
      WHERE EXISTS (
        SELECT 1 FROM clients c 
        WHERE c.user_id = u.id AND c.org_id IS NULL
      )
    LOOP
      RAISE NOTICE 'Processando usuário: %', user_record.email;
      
      -- Verificar se usuário já tem organização
      SELECT org_id INTO new_org_id
      FROM memberships
      WHERE user_id = user_record.id
      LIMIT 1;
      
      -- Se não tem organização, criar uma
      IF new_org_id IS NULL THEN
        -- Criar nova organização
        INSERT INTO organizations (name)
        VALUES ('Organização de ' || COALESCE(user_record.email, 'Usuário'))
        RETURNING id INTO new_org_id;
        
        RAISE NOTICE 'Criada organização % para usuário %', new_org_id, user_record.email;
        
        -- Criar membership
        INSERT INTO memberships (user_id, org_id, role, role_id, accepted_at, status)
        VALUES (user_record.id, new_org_id, 'owner', owner_role_id, NOW(), 'active');
        
        RAISE NOTICE 'Criado membership para usuário %', user_record.email;
      END IF;
      
      -- Atualizar clientes órfãos deste usuário
      UPDATE clients 
      SET org_id = new_org_id
      WHERE user_id = user_record.id AND org_id IS NULL;
      
      RAISE NOTICE 'Atualizados clientes do usuário %', user_record.email;
    END LOOP;
  END IF;
  
  -- Verificar resultado
  SELECT COUNT(*) INTO orphan_clients_count
  FROM clients 
  WHERE org_id IS NULL;
  
  RAISE NOTICE 'Restam % clientes sem organização após migração', orphan_clients_count;
END $$;

-- 2. Atualizar memberships sem role_id
UPDATE memberships 
SET role_id = (
  SELECT id FROM user_roles 
  WHERE name = CASE 
    WHEN memberships.role = 'owner' THEN 'owner'
    WHEN memberships.role = 'admin' THEN 'admin'
    ELSE 'manager'
  END
  LIMIT 1
)
WHERE role_id IS NULL;

-- 3. Criar assinaturas trial para organizações sem plano
INSERT INTO subscriptions (org_id, plan_id, status, current_period_start, current_period_end)
SELECT 
  o.id,
  (SELECT id FROM subscription_plans WHERE name = 'Free Trial' LIMIT 1),
  'active',
  NOW(),
  NOW() + INTERVAL '14 days'
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM subscriptions s WHERE s.org_id = o.id
);

-- 4. Verificar resultado final
SELECT 
  'Organizações' as tabela,
  COUNT(*) as total
FROM organizations

UNION ALL

SELECT 
  'Memberships' as tabela,
  COUNT(*) as total
FROM memberships

UNION ALL

SELECT 
  'Clientes' as tabela,
  COUNT(*) as total
FROM clients

UNION ALL

SELECT 
  'Clientes com org_id' as tabela,
  COUNT(*) as total
FROM clients
WHERE org_id IS NOT NULL

UNION ALL

SELECT 
  'Assinaturas' as tabela,
  COUNT(*) as total
FROM subscriptions;

-- Mensagem final
SELECT 'Migração concluída com sucesso!' as status;