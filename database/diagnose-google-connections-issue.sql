-- ============================================================================
-- DIAGNÓSTICO: Problema de Conexões Google Ads
-- ============================================================================
-- Problema: Conexões não aparecem no cliente após seleção
-- Dashboard mostra todas as tentativas de conexão
-- ============================================================================

-- 1. Ver TODAS as conexões Google Ads
SELECT 
  id,
  client_id,
  customer_id,
  status,
  user_id,
  created_at,
  updated_at,
  last_sync_at
FROM google_ads_connections
ORDER BY created_at DESC;

-- 2. Ver conexões por cliente
SELECT 
  c.name as client_name,
  c.id as client_id,
  gac.id as connection_id,
  gac.customer_id,
  gac.status,
  gac.user_id,
  gac.created_at,
  gac.last_sync_at
FROM clients c
LEFT JOIN google_ads_connections gac ON gac.client_id = c.id
ORDER BY c.name, gac.created_at DESC;

-- 3. Ver conexões órfãs (sem client_id)
SELECT 
  id,
  customer_id,
  status,
  user_id,
  created_at
FROM google_ads_connections
WHERE client_id IS NULL
ORDER BY created_at DESC;

-- 4. Ver conexões duplicadas (mesmo customer_id para mesmo cliente)
SELECT 
  client_id,
  customer_id,
  COUNT(*) as total,
  array_agg(id) as connection_ids,
  array_agg(status) as stattatuses
FROM google_ads_connections
GROUP BY client_id, customer_id
HAVING COUNT(*) > 1;

-- 5. Ver estados OAuth pendentes
SELECT 
  id,
  client_id,
  state,
  created_at,
  expires_at,
  CASE 
    WHEN expires_at < NOW() THEN 'EXPIRADO'
    ELSE 'VÁLIDO'
  END as status
FROM oauth_states
WHERE created_at > NOW() - INTERVAL '1 day'
ORDER BY created_at DESC;

-- 6. Contar conexões por status
SELECT 
  status,
  COUNT(*) as total
FROM google_ads_connections
GROUP BY status;

-- 7. Ver últimas 10 conexões criadas
SELECT 
  id,
  client_id,
  customer_id,
  status,
  user_id,
  created_at,
  last_sync_at
FROM google_ads_connections
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================================
-- LIMPEZA (se necessário)
-- ============================================================================

-- Desativar conexões órfãs
-- UPDATE google_ads_connections
-- SET is_active = false
-- WHERE client_id IS NULL;

-- Deletar conexões órfãs antigas (mais de 1 dia)
-- DELETE FROM google_ads_connections
-- WHERE client_id IS NULL
-- AND created_at < NOW() - INTERVAL '1 day';

-- Deletar estados OAuth expirados
-- DELETE FROM oauth_states
-- WHERE expires_at < NOW();
