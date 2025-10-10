-- Script rápido para resolver problema dos clientes
-- Execute este script no Supabase SQL Editor

-- 1. Verificar seu usuário atual (substitua pelo seu email)
-- IMPORTANTE: Substitua 'SEU_EMAIL_AQUI' pelo seu email real antes de executar!

DO $$
DECLARE
  user_email TEXT := 'SEU_EMAIL_AQUI'; -- MUDE AQUI!
  user_id_var UUID;
  existing_org_id UUID;
  new_org_id UUID;
  owner_role_id UUID;
  trial_plan_id UUID;
BEGIN
  -- Buscar seu usuário
  SELECT id INTO user_id_var
  FROM auth.users
  WHERE email = user_email;
  
  IF user_id_var IS NULL THEN
    RAISE EXCEPTION 'Usuário com email % não encontrado. Verifique se o email está correto.', user_email;
  END IF;
  
  RAISE NOTICE 'Usuário encontrado: % (ID: %)', user_email, user_id_var;
  
  -- Verificar se já tem organização
  SELECT org_id INTO existing_org_id
  FROM memberships
  WHERE user_id = user_id_var
  LIMIT 1;
  
  IF existing_org_id IS NOT NULL THEN
    RAISE NOTICE 'Usuário já tem organização: %', existing_org_id;
    
    -- Verificar quantos clientes tem nesta organização
    DECLARE
      client_count INTEGER;
    BEGIN
      SELECT COUNT(*) INTO client_count
      FROM clients
      WHERE org_id = existing_org_id;
      
      RAISE NOTICE 'Organização já tem % clientes', client_count;
    END;
    
  ELSE
    RAISE NOTICE 'Usuário não tem organização. Criando...';
    
    -- Buscar role de owner
    SELECT id INTO owner_role_id
    FROM user_roles
    WHERE name = 'owner'
    LIMIT 1;
    
    IF owner_role_id IS NULL THEN
      RAISE EXCEPTION 'Role "owner" não encontrada. Execute o schema completo primeiro.';
    END IF;
    
    -- Buscar plano trial
    SELECT id INTO trial_plan_id
    FROM subscription_plans
    WHERE name = 'Free Trial'
    LIMIT 1;
    
    IF trial_plan_id IS NULL THEN
      RAISE EXCEPTION 'Plano "Free Trial" não encontrado. Execute o schema completo primeiro.';
    END IF;
    
    -- Criar nova organização
    INSERT INTO organizations (name)
    VALUES ('Organização de ' || user_email)
    RETURNING id INTO new_org_id;
    
    RAISE NOTICE 'Organização criada: %', new_org_id;
    
    -- Criar membership
    INSERT INTO memberships (user_id, org_id, role, role_id, accepted_at, status)
    VALUES (user_id_var, new_org_id, 'owner', owner_role_id, NOW(), 'active');
    
    RAISE NOTICE 'Membership criado para usuário como owner';
    
    -- Criar assinatura trial
    INSERT INTO subscriptions (org_id, plan_id, status, current_period_start, current_period_end)
    VALUES (
      new_org_id,
      trial_plan_id,
      'active',
      NOW(),
      NOW() + INTERVAL '14 days'
    );
    
    RAISE NOTICE 'Assinatura trial criada (14 dias)';
    
    -- Migrar clientes órfãos se existirem
    DECLARE
      orphan_count INTEGER;
    BEGIN
      -- Verificar se existem clientes órfãos deste usuário
      SELECT COUNT(*) INTO orphan_count
      FROM clients
      WHERE org_id IS NULL;
      
      IF orphan_count > 0 THEN
        RAISE NOTICE 'Encontrados % clientes órfãos. Tentando migrar...', orphan_count;
        
        -- Tentar migrar clientes que podem ser deste usuário
        -- (Isso é uma estimativa, pois não temos user_id direto nos clientes)
        UPDATE clients 
        SET org_id = new_org_id
        WHERE org_id IS NULL
          AND created_at > (
            SELECT created_at - INTERVAL '1 day'
            FROM auth.users 
            WHERE id = user_id_var
          );
        
        GET DIAGNOSTICS orphan_count = ROW_COUNT;
        RAISE NOTICE 'Migrados % clientes para a nova organização', orphan_count;
      END IF;
    END;
    
    existing_org_id := new_org_id;
  END IF;
  
  -- Verificação final
  DECLARE
    final_client_count INTEGER;
    final_membership_count INTEGER;
    final_subscription_count INTEGER;
  BEGIN
    SELECT COUNT(*) INTO final_client_count
    FROM clients
    WHERE org_id = existing_org_id;
    
    SELECT COUNT(*) INTO final_membership_count
    FROM memberships
    WHERE org_id = existing_org_id;
    
    SELECT COUNT(*) INTO final_subscription_count
    FROM subscriptions
    WHERE org_id = existing_org_id;
    
    RAISE NOTICE '=== RESULTADO FINAL ===';
    RAISE NOTICE 'Organização ID: %', existing_org_id;
    RAISE NOTICE 'Clientes na organização: %', final_client_count;
    RAISE NOTICE 'Membros na organização: %', final_membership_count;
    RAISE NOTICE 'Assinaturas ativas: %', final_subscription_count;
    RAISE NOTICE '=====================';
  END;
  
END $$;

-- 2. Verificar resultado
SELECT 
  'Verificação Final' as status,
  u.email,
  o.name as organizacao,
  m.role as funcao,
  COUNT(c.id) as total_clientes
FROM auth.users u
JOIN memberships m ON u.id = m.user_id
JOIN organizations o ON m.org_id = o.id
LEFT JOIN clients c ON o.id = c.org_id
WHERE u.email = 'SEU_EMAIL_AQUI' -- MUDE AQUI TAMBÉM!
GROUP BY u.email, o.name, m.role;

-- 3. Verificar plano ativo
SELECT 
  'Plano Ativo' as status,
  sp.name as plano,
  s.status,
  s.current_period_end as expira_em
FROM subscriptions s
JOIN subscription_plans sp ON s.plan_id = sp.id
JOIN memberships m ON s.org_id = m.org_id
JOIN auth.users u ON m.user_id = u.id
WHERE u.email = 'SEU_EMAIL_AQUI'; -- MUDE AQUI TAMBÉM!