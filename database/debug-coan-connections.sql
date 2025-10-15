-- Debug das conexões Meta do cliente Coan Consultoria
-- Verificar se há conexões ativas e campanhas sincronizadas

-- 1. Buscar o cliente Coan
SELECT 
    id,
    name,
    organization_name,
    created_at
FROM clients 
WHERE name ILIKE '%coan%' 
   OR organization_name ILIKE '%coan%';

-- 2. Verificar conexões Meta do cliente Coan
SELECT 
    c.name as client_name,
    cmc.id as connection_id,
    cmc.account_name,
    cmc.ad_account_id,
    cmc.is_active,
    cmc.access_token IS NOT NULL as has_token,
    cmc.created_at,
    cmc.updated_at
FROM client_meta_connections cmc 
JOIN clients c ON c.id = cmc.client_id 
WHERE c.name ILIKE '%coan%' 
   OR c.organization_name ILIKE '%coan%'
ORDER BY cmc.created_at DESC;

-- 3. Verificar campanhas sincronizadas para o cliente Coan
SELECT 
    c.name as client_name,
    cmc.account_name,
    mc.name as campaign_name,
    mc.status,
    mc.objective,
    mc.external_id,
    mc.created_time,
    mc.updated_at
FROM meta_campaigns mc
JOIN client_meta_connections cmc ON cmc.id = mc.connection_id
JOIN clients c ON c.id = cmc.client_id
WHERE c.name ILIKE '%coan%' 
   OR c.organization_name ILIKE '%coan%'
ORDER BY mc.updated_at DESC;

-- 4. Contar total de campanhas por cliente
SELECT 
    c.name as client_name,
    COUNT(mc.id) as total_campaigns,
    COUNT(CASE WHEN mc.status = 'ACTIVE' THEN 1 END) as active_campaigns
FROM clients c
LEFT JOIN client_meta_connections cmc ON cmc.client_id = c.id AND cmc.is_active = true
LEFT JOIN meta_campaigns mc ON mc.connection_id = cmc.id
WHERE c.name ILIKE '%coan%' 
   OR c.organization_name ILIKE '%coan%'
GROUP BY c.id, c.name;