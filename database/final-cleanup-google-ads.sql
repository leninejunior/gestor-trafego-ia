-- =====================================================
-- LIMPEZA FINAL: Remove TODAS as conexões órfãs
-- =====================================================

-- 1. Delete sync logs de conexões órfãs
DELETE FROM google_ads_sync_logs
WHERE connection_id IN (
  SELECT gac.id FROM google_ads_connections gac
  WHERE gac.client_id IS NULL
     OR gac.client_id NOT IN (SELECT id FROM clients)
);

-- 2. Delete metrics de campanhas órfãs
DELETE FROM google_ads_metrics
WHERE campaign_id IN (
  SELECT gac.id FROM google_ads_campaigns gac
  WHERE gac.connection_id IN (
    SELECT gac2.id FROM google_ads_connections gac2
    WHERE gac2.client_id IS NULL
       OR gac2.client_id NOT IN (SELECT id FROM clients)
  )
);

-- 3. Delete campanhas órfãs
DELETE FROM google_ads_campaigns
WHERE connection_id IN (
  SELECT gac.id FROM google_ads_connections gac
  WHERE gac.client_id IS NULL
     OR gac.client_id NOT IN (SELECT id FROM clients)
);

-- 4. Delete conexões órfãs (SEM client_id válido)
DELETE FROM google_ads_connections
WHERE client_id IS NULL
   OR client_id NOT IN (SELECT id FROM clients);

-- 5. Verificar resultado
SELECT 'RESULTADO FINAL:' as status;
SELECT COUNT(*) as remaining_connections FROM google_ads_connections;
SELECT COUNT(*) as remaining_campaigns FROM google_ads_campaigns;
SELECT COUNT(*) as remaining_metrics FROM google_ads_metrics;
