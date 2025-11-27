-- =====================================================
-- Diagnóstico: Entender por que conexões aparecem
-- =====================================================

-- 1. Ver TODAS as conexões (sem RLS)
SELECT 'TODAS AS CONEXÕES NO BANCO:' as status;
SELECT 
  gac.id,
  gac.customer_id,
  gac.client_id,
  c.name as client_name,
  c.org_id,
  gac.status,
  gac.created_at
FROM google_ads_connections gac
LEFT JOIN clients c ON gac.client_id = c.id
ORDER BY gac.created_at DESC;

-- 2. Ver sua organização e clientes
SELECT 'SUA ORGANIZAÇÃO E CLIENTES:' as status;
SELECT 
  m.user_id,
  m.organization_id,
  o.name as org_name,
  c.id as client_id,
  c.name as client_name
FROM memberships m
LEFT JOIN organizations o ON m.organization_id = o.id
LEFT JOIN clients c ON c.org_id = m.organization_id
WHERE m.user_id = auth.uid()
AND m.status = 'active';

-- 3. Conexões que DEVERIAM ser visíveis para você
SELECT 'CONEXÕES QUE DEVERIAM SER VISÍVEIS:' as status;
SELECT 
  gac.id,
  gac.customer_id,
  c.name as client_name,
  gac.status
FROM google_ads_connections gac
INNER JOIN clients c ON gac.client_id = c.id
INNER JOIN memberships m ON m.organization_id = c.org_id
WHERE m.user_id = auth.uid() 
AND m.status = 'active';

-- 4. Conexões órfãs (sem cliente válido)
SELECT 'CONEXÕES ÓRFÃS (SEM CLIENTE):' as status;
SELECT 
  gac.id,
  gac.customer_id,
  gac.client_id,
  gac.status,
  gac.created_at
FROM google_ads_connections gac
LEFT JOIN clients c ON gac.client_id = c.id
WHERE c.id IS NULL;

-- 5. Clientes órfãos (sem organização)
SELECT 'CLIENTES ÓRFÃOS (SEM ORGANIZAÇÃO):' as status;
SELECT 
  c.id,
  c.name,
  c.org_id,
  COUNT(gac.id) as connection_count
FROM clients c
LEFT JOIN google_ads_connections gac ON gac.client_id = c.id
LEFT JOIN organizations o ON c.org_id = o.id
WHERE o.id IS NULL
GROUP BY c.id, c.name, c.org_id;
