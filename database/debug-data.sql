-- Script para debugar dados após aplicar o schema SaaS

-- 1. Verificar se as tabelas existem
SELECT 
  schemaname,
  tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('organizations', 'memberships', 'clients', 'user_roles', 'subscription_plans')
ORDER BY tablename;

-- 2. Verificar usuários autenticados
SELECT 
  id,
  email,
  created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

-- 3. Verificar organizações
SELECT 
  id,
  name,
  created_at
FROM organizations
ORDER BY created_at DESC;

-- 4. Verificar memberships
SELECT 
  m.id,
  m.user_id,
  m.org_id,
  m.role,
  m.status,
  u.email as user_email,
  o.name as org_name
FROM memberships m
LEFT JOIN auth.users u ON m.user_id = u.id
LEFT JOIN organizations o ON m.org_id = o.id
ORDER BY m.created_at DESC;

-- 5. Verificar clientes
SELECT 
  c.id,
  c.name,
  c.org_id,
  c.created_at,
  o.name as org_name
FROM clients c
LEFT JOIN organizations o ON c.org_id = o.id
ORDER BY c.created_at DESC;

-- 6. Verificar roles
SELECT 
  id,
  name,
  description
FROM user_roles
ORDER BY name;

-- 7. Verificar planos
SELECT 
  id,
  name,
  price_monthly,
  max_clients
FROM subscription_plans
ORDER BY name;

-- 8. Verificar se há dados órfãos (clientes sem org_id)
SELECT 
  'Clientes sem org_id' as issue,
  COUNT(*) as count
FROM clients 
WHERE org_id IS NULL

UNION ALL

SELECT 
  'Memberships sem role_id' as issue,
  COUNT(*) as count
FROM memberships 
WHERE role_id IS NULL

UNION ALL

SELECT 
  'Organizações sem membros' as issue,
  COUNT(*) as count
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM memberships m WHERE m.org_id = o.id
);

-- 9. Verificar políticas RLS ativas
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename IN ('clients', 'memberships', 'organizations')
ORDER BY tablename, policyname;