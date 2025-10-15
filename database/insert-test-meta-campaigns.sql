-- Inserir campanhas de teste no banco para verificar se a API funciona
-- Executar no Supabase SQL Editor

-- Primeiro, verificar se há conexões Meta
SELECT 
  id,
  client_id,
  ad_account_id,
  account_name,
  is_active
FROM client_meta_connections 
WHERE is_active = true
LIMIT 5;

-- Se houver conexões, inserir campanhas de teste
-- Substitua 'CONNECTION_ID_AQUI' pelo ID real da conexão

INSERT INTO meta_campaigns (
  connection_id,
  external_id,
  name,
  status,
  objective,
  daily_budget,
  created_time,
  updated_time
) VALUES 
(
  (SELECT id FROM client_meta_connections WHERE is_active = true LIMIT 1),
  'test_campaign_real_1',
  'Campanha Real de Teste - Vendas Black Friday',
  'ACTIVE',
  'CONVERSIONS',
  5000.00,
  NOW() - INTERVAL '7 days',
  NOW()
),
(
  (SELECT id FROM client_meta_connections WHERE is_active = true LIMIT 1),
  'test_campaign_real_2',
  'Campanha Real de Teste - Brand Awareness',
  'ACTIVE',
  'BRAND_AWARENESS',
  3000.00,
  NOW() - INTERVAL '5 days',
  NOW()
),
(
  (SELECT id FROM client_meta_connections WHERE is_active = true LIMIT 1),
  'test_campaign_real_3',
  'Campanha Real de Teste - Lead Generation',
  'PAUSED',
  'LEAD_GENERATION',
  2000.00,
  NOW() - INTERVAL '3 days',
  NOW()
)
ON CONFLICT (connection_id, external_id) DO UPDATE SET
  name = EXCLUDED.name,
  status = EXCLUDED.status,
  updated_time = NOW();

-- Inserir insights de teste para as campanhas
INSERT INTO meta_campaign_insights (
  campaign_id,
  date_start,
  date_stop,
  impressions,
  clicks,
  spend,
  reach,
  frequency,
  cpm,
  cpc,
  ctr,
  conversions
) 
SELECT 
  mc.id,
  CURRENT_DATE - INTERVAL '1 day',
  CURRENT_DATE - INTERVAL '1 day',
  FLOOR(RANDOM() * 50000 + 10000)::BIGINT,
  FLOOR(RANDOM() * 1000 + 200)::BIGINT,
  ROUND((RANDOM() * 500 + 100)::NUMERIC, 2),
  FLOOR(RANDOM() * 30000 + 8000)::BIGINT,
  ROUND((RANDOM() * 0.5 + 1.2)::NUMERIC, 2),
  ROUND((RANDOM() * 10 + 5)::NUMERIC, 2),
  ROUND((RANDOM() * 2 + 0.5)::NUMERIC, 2),
  ROUND((RANDOM() * 3 + 1)::NUMERIC, 2),
  FLOOR(RANDOM() * 50 + 10)::BIGINT
FROM meta_campaigns mc
WHERE mc.external_id LIKE 'test_campaign_real_%'
ON CONFLICT (campaign_id, date_start, date_stop) DO UPDATE SET
  impressions = EXCLUDED.impressions,
  clicks = EXCLUDED.clicks,
  spend = EXCLUDED.spend,
  updated_at = NOW();

-- Verificar se as campanhas foram inseridas
SELECT 
  mc.id,
  mc.external_id,
  mc.name,
  mc.status,
  mc.objective,
  cmc.account_name,
  c.name as client_name
FROM meta_campaigns mc
LEFT JOIN client_meta_connections cmc ON mc.connection_id = cmc.id
LEFT JOIN clients c ON cmc.client_id = c.id
WHERE mc.external_id LIKE 'test_campaign_real_%';