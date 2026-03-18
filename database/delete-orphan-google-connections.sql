-- =====================================================
-- Delete Orphan Google Ads Connections
-- =====================================================
-- Remove conexões que:
-- 1. Têm customer_id = 'pending' (nunca foram completadas)
-- 2. Não têm cliente válido associado
-- 3. Foram criadas há mais de 1 hora (timeout)

-- Deletar conexões órfãs
DELETE FROM google_ads_connections
WHERE 
  customer_id = 'pending'
  OR client_id NOT IN (SELECT id FROM clients)
  OR (customer_id = 'pending' AND created_at < NOW() - INTERVAL '1 hour');

-- Verificar resultado
SELECT 'Conexões restantes após limpeza:' as status;
SELECT COUNT(*) as total_connections FROM google_ads_connections;

SELECT 'Conexões por status:' as status;
SELECT status, COUNT(*) as count FROM google_ads_connections GROUP BY status;
