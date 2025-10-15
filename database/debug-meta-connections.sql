-- Debug das conexões Meta Ads
-- Executar no Supabase SQL Editor

-- 1. Verificar todas as conexões Meta (sem RLS)
SELECT 
  cmc.id,
  cmc.client_id,
  cmc.ad_account_id,
  cmc.account_name,
  cmc.is_active,
  cmc.created_at,
  c.name as client_name,
  c.org_id
FROM client_meta_connections cmc
LEFT JOIN clients c ON cmc.client_id = c.id
ORDER BY cmc.created_at DESC;

-- 2. Verificar campanhas Meta (sem RLS)
SELECT 
  mc.id,
  mc.connection_id,
  mc.external_id,
  mc.name,
  mc.status,
  mc.objective,
  mc.created_time,
  cmc.account_name,
  c.name as client_name
FROM meta_campaigns mc
LEFT JOIN client_meta_connections cmc ON mc.connection_id = cmc.id
LEFT JOIN clients c ON cmc.client_id = c.id
ORDER BY mc.created_at DESC;

-- 3. Verificar insights de campanhas (sem RLS)
SELECT 
  mci.id,
  mci.campaign_id,
  mci.date_start,
  mci.date_stop,
  mci.impressions,
  mci.clicks,
  mci.spend,
  mc.name as campaign_name
FROM meta_campaign_insights mci
LEFT JOIN meta_campaigns mc ON mci.campaign_id = mc.id
ORDER BY mci.date_start DESC
LIMIT 10;

-- 4. Verificar usuário atual e memberships
SELECT 
  auth.uid() as current_user_id,
  auth.email() as current_user_email;

SELECT 
  m.id,
  m.user_id,
  m.org_id,
  m.role,
  m.status,
  o.name as org_name
FROM memberships m
LEFT JOIN organizations o ON m.org_id = o.id
WHERE m.user_id = auth.uid();

-- 5. Verificar clientes do usuário atual
SELECT 
  c.id,
  c.name,
  c.org_id,
  o.name as org_name
FROM clients c
LEFT JOIN organizations o ON c.org_id = o.id
LEFT JOIN memberships m ON o.id = m.org_id
WHERE m.user_id = auth.uid()
  AND m.status = 'active';