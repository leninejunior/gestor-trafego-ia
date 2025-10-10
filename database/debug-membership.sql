-- Debug do problema de membership

-- 1. Ver todos os usuários
SELECT 
  'USUÁRIOS:' as info,
  id,
  email,
  created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 3;

-- 2. Ver todos os memberships
SELECT 
  'MEMBERSHIPS:' as info,
  m.id,
  m.user_id,
  m.org_id,
  m.role,
  m.status,
  u.email as user_email
FROM memberships m
LEFT JOIN auth.users u ON m.user_id = u.id
ORDER BY m.created_at DESC;

-- 3. Ver todas as organizações
SELECT 
  'ORGANIZAÇÕES:' as info,
  id,
  name,
  created_at
FROM organizations
ORDER BY created_at DESC;

-- 4. Verificar se há problema na query específica
-- (substitua o UUID pelo ID do seu usuário da primeira query)
SELECT 
  'TESTE QUERY ESPECÍFICA:' as info,
  m.org_id,
  u.email
FROM memberships m
JOIN auth.users u ON m.user_id = u.id
WHERE u.email LIKE '%@%'  -- Pega qualquer email válido
ORDER BY u.created_at DESC
LIMIT 1;

-- 5. Forçar criação de membership se não existir
DO $$
DECLARE
  latest_user_id UUID;
  latest_user_email TEXT;
  existing_membership_id UUID;
  existing_org_id UUID;
  owner_role_id UUID;
BEGIN
  -- Pegar usuário mais recente
  SELECT id, email INTO latest_user_id, latest_user_email
  FROM auth.users
  ORDER BY created_at DESC
  LIMIT 1;
  
  RAISE NOTICE 'Verificando usuário: % (%)', latest_user_email, latest_user_id;
  
  -- Verificar se já tem membership
  SELECT id, org_id INTO existing_membership_id, existing_org_id
  FROM memberships
  WHERE user_id = latest_user_id
  LIMIT 1;
  
  IF existing_membership_id IS NULL THEN
    RAISE NOTICE 'PROBLEMA: Usuário não tem membership!';
    
    -- Verificar se existe alguma organização
    SELECT id INTO existing_org_id
    FROM organizations
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF existing_org_id IS NULL THEN
      RAISE NOTICE 'Criando organização...';
      INSERT INTO organizations (name)
      VALUES ('Organização de ' || latest_user_email)
      RETURNING id INTO existing_org_id;
    END IF;
    
    -- Buscar role de owner
    SELECT id INTO owner_role_id
    FROM user_roles
    WHERE name = 'owner'
    LIMIT 1;
    
    -- Criar membership
    INSERT INTO memberships (user_id, org_id, role, role_id, accepted_at, status)
    VALUES (latest_user_id, existing_org_id, 'owner', owner_role_id, NOW(), 'active');
    
    RAISE NOTICE 'Membership criado para organização %', existing_org_id;
  ELSE
    RAISE NOTICE 'Membership já existe: % (org: %)', existing_membership_id, existing_org_id;
  END IF;
END $$;

-- 6. Verificar resultado final
SELECT 
  'RESULTADO FINAL:' as info,
  u.email,
  m.org_id,
  m.role,
  m.status,
  o.name as org_name
FROM auth.users u
JOIN memberships m ON u.id = m.user_id
JOIN organizations o ON m.org_id = o.id
ORDER BY u.created_at DESC
LIMIT 1;