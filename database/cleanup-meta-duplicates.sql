-- ============================================
-- LIMPEZA DE CONEXÕES META DUPLICADAS
-- ============================================
-- Este script remove conexões duplicadas e órfãs do Meta Ads

-- 1. Identificar conexões duplicadas (mesmo ad_account_id + client_id)
SELECT 
  client_id,
  ad_account_id,
  COUNT(*) as total,
  array_agg(id ORDER BY created_at DESC) as connection_ids,
  array_agg(created_at ORDER BY created_at DESC) as dates
FROM client_meta_connections
GROUP BY client_id, ad_account_id
HAVING COUNT(*) > 1;

-- 2. Manter apenas a conexão mais recente, deletar as antigas
WITH duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY client_id, ad_account_id 
      ORDER BY created_at DESC
    ) as rn
  FROM client_meta_connections
)
DELETE FROM client_meta_connections
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- 3. Remover conexões órfãs (client_id não existe)
DELETE FROM client_meta_connections
WHERE client_id NOT IN (SELECT id FROM clients);

-- 4. Remover conexões inativas antigas (mais de 30 dias)
DELETE FROM client_meta_connections
WHERE is_active = false 
  AND updated_at < NOW() - INTERVAL '30 days';

-- 5. Verificar resultado final
SELECT 
  c.name as client_name,
  cmc.ad_account_id,
  cmc.account_name,
  cmc.is_active,
  cmc.created_at,
  cmc.updated_at
FROM client_meta_connections cmc
JOIN clients c ON c.id = cmc.client_id
ORDER BY c.name, cmc.ad_account_id;

-- 6. Estatísticas finais
SELECT 
  COUNT(*) as total_connections,
  COUNT(DISTINCT client_id) as unique_clients,
  COUNT(DISTINCT ad_account_id) as unique_ad_accounts,
  SUM(CASE WHEN is_active THEN 1 ELSE 0 END) as active_connections
FROM client_meta_connections;
