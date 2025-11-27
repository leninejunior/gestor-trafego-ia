-- =====================================================
-- DELETE ALL ORPHAN GOOGLE ADS CONNECTIONS
-- =====================================================
-- Remove todas as conexões que:
-- 1. Têm customer_id = 'temp-customer'
-- 2. Não têm um client_id válido
-- 3. Não estão associadas a uma organização

-- Primeiro, deletar sync logs dessas conexões
DELETE FROM google_ads_sync_logs
WHERE connection_id IN (
  SELECT id FROM google_ads_connections
  WHERE customer_id = 'temp-customer'
    OR client_id IS NULL
    OR client_id NOT IN (SELECT id FROM clients)
);

-- Deletar métricas dessas campanhas
DELETE FROM google_ads_metrics
WHERE campaign_id IN (
  SELECT id FROM google_ads_campaigns
  WHERE connection_id IN (
    SELECT id FROM google_ads_connections
    WHERE customer_id = 'temp-customer'
      OR client_id IS NULL
      OR client_id NOT IN (SELECT id FROM clients)
  )
);

-- Deletar campanhas dessas conexões
DELETE FROM google_ads_campaigns
WHERE connection_id IN (
  SELECT id FROM google_ads_connections
  WHERE customer_id = 'temp-customer'
    OR client_id IS NULL
    OR client_id NOT IN (SELECT id FROM clients)
);

-- Deletar as conexões órfãs
DELETE FROM google_ads_connections
WHERE customer_id = 'temp-customer'
  OR client_id IS NULL
  OR client_id NOT IN (SELECT id FROM clients);

-- Verificar resultado
SELECT 'Conexões restantes após limpeza:' as status;
SELECT COUNT(*) as total_connections FROM google_ads_connections;

SELECT 'Campanhas restantes:' as status;
SELECT COUNT(*) as total_campaigns FROM google_ads_campaigns;
