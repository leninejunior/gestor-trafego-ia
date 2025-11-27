-- =====================================================
-- Limpar Conexões Google Ads Pendentes
-- =====================================================
-- Remove todas as conexões com customer_id = 'pending'
-- Essas são conexões incompletas do fluxo OAuth

DELETE FROM google_ads_connections
WHERE customer_id = 'pending'
OR customer_id IS NULL;

-- Verificar quantas foram deletadas
SELECT 'Conexões pendentes removidas' as status;
SELECT COUNT(*) as remaining_connections
FROM google_ads_connections;
