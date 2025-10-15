-- Debug: Verificar dados de campanhas

-- 1. Verificar usuário atual
SELECT 
  'USUÁRIO ATUAL' as tipo,
  id,
  email,
  created_at
FROM auth.users 
WHERE email = 'lenine.engrene@gmail.com';

-- 2. Verificar memberships
SELECT 
  'MEMBERSHIPS' as tipo,
  m.id,
  m.user_id,
  m.role,
  m.status,
  o.name as org_name
FROM memberships m
LEFT JOIN organizations o ON m.organization_id = o.id
WHERE m.user_id = (SELECT id FROM auth.users WHERE email = 'lenine.engrene@gmail.com');

-- 3. Verificar clientes
SELECT 
  'CLIENTES' as tipo,
  c.id,
  c.name,
  c.org_id,
  o.name as org_name
FROM clients c
LEFT JOIN organizations o ON c.org_id = o.id
ORDER BY c.name;

-- 4. Verificar conexões Meta
SELECT 
  'CONEXÕES META' as tipo,
  cmc.id,
  cmc.client_id,
  c.name as client_name,
  cmc.account_name,
  cmc.account_id,
  cmc.is_active
FROM client_meta_connections cmc
LEFT JOIN clients c ON cmc.client_id = c.id
ORDER BY c.name;

-- 5. Verificar campanhas Meta
SELECT 
  'CAMPANHAS META' as tipo,
  COUNT(*) as total_campanhas,
  client_id,
  c.name as client_name
FROM meta_campaigns mc
LEFT JOIN clients c ON mc.client_id = c.id
GROUP BY client_id, c.name
ORDER BY total_campanhas DESC;

-- 6. Verificar estrutura da tabela meta_campaigns
SELECT 
  'ESTRUTURA META_CAMPAIGNS' as tipo,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'meta_campaigns' 
  AND table_schema = 'public'
ORDER BY ordinal_position;