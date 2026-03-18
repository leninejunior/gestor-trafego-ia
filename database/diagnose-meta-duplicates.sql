-- Diagnóstico de Duplicatas em Meta Connections
-- Execute este script para identificar o problema

-- 1. Ver todas as conexões Meta com detalhes
SELECT 
  id,
  client_id,
  ad_account_id,
  account_name,
  is_active,
  created_at,
  updated_at
FROM client_meta_connections
ORDER BY ad_account_id, created_at DESC;

-- 2. Identificar contas duplicadas (mesmo ad_account_id para o mesmo cliente)
SELECT 
  client_id,
  ad_account_id,
  COUNT(*) as total_duplicatas,
  array_agg(id ORDER BY created_at DESC) as connection_ids,
  array_agg(is_active ORDER BY created_at DESC) as status_list
FROM client_meta_connections
GROUP BY client_id, ad_account_id
HAVING COUNT(*) > 1;

-- 3. Ver total de conexões por cliente
SELECT 
  c.id as client_id,
  c.name as client_name,
  COUNT(cmc.id) as total_connections,
  COUNT(DISTINCT cmc.ad_account_id) as unique_accounts
FROM clients c
LEFT JOIN client_meta_connections cmc ON cmc.client_id = c.id
GROUP BY c.id, c.name
ORDER BY total_connections DESC;

-- 4. Ver conexões ativas vs inativas
SELECT 
  is_active,
  COUNT(*) as total
FROM client_meta_connections
GROUP BY is_active;

-- 5. Identificar qual usuário/organização está vendo essas contas
SELECT 
  c.id as client_id,
  c.name as client_name,
  c.org_id,
  o.name as organization_name,
  COUNT(cmc.id) as total_meta_connections
FROM clients c
LEFT JOIN organizations o ON o.id = c.org_id
LEFT JOIN client_meta_connections cmc ON cmc.client_id = c.id
GROUP BY c.id, c.name, c.org_id, o.name
ORDER BY total_meta_connections DESC;
