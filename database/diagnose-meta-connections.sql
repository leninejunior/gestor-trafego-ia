-- Diagnóstico completo das conexões Meta Ads
-- Execute este script no Supabase SQL Editor para identificar problemas

-- 1. Verificar estrutura da tabela client_meta_connections
SELECT 
    'Estrutura da tabela client_meta_connections' as diagnostico,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'client_meta_connections'
ORDER BY ordinal_position;

-- 2. Contar total de conexões Meta
SELECT 
    'Total de conexões Meta' as diagnostico,
    COUNT(*) as total
FROM client_meta_connections;

-- 3. Verificar conexões por cliente
SELECT 
    'Conexões por cliente' as diagnostico,
    c.id as client_id,
    c.name as client_name,
    COUNT(cmc.id) as total_connections,
    COUNT(CASE WHEN cmc.is_active THEN 1 END) as active_connections
FROM clients c
LEFT JOIN client_meta_connections cmc ON c.id = cmc.client_id
GROUP BY c.id, c.name
ORDER BY total_connections DESC;

-- 4. Verificar conexões órfãs (sem cliente válido)
SELECT 
    'Conexões órfãs (sem cliente)' as diagnostico,
    cmc.*
FROM client_meta_connections cmc
LEFT JOIN clients c ON cmc.client_id = c.id
WHERE c.id IS NULL;

-- 5. Verificar políticas RLS ativas
SELECT 
    'Políticas RLS para client_meta_connections' as diagnostico,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'client_meta_connections';

-- 6. Verificar se RLS está habilitado
SELECT 
    'Status RLS' as diagnostico,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'client_meta_connections';

-- 7. Verificar conexões com tokens expirados ou inválidos
SELECT 
    'Conexões com possíveis problemas' as diagnostico,
    cmc.id,
    cmc.ad_account_id,
    cmc.account_name,
    cmc.is_active,
    cmc.created_at,
    cmc.updated_at,
    c.name as client_name,
    CASE 
        WHEN cmc.access_token IS NULL THEN 'Token ausente'
        WHEN LENGTH(cmc.access_token) < 50 THEN 'Token muito curto'
        WHEN cmc.updated_at < NOW() - INTERVAL '60 days' THEN 'Não atualizado há mais de 60 dias'
        ELSE 'OK'
    END as status
FROM client_meta_connections cmc
JOIN clients c ON cmc.client_id = c.id
ORDER BY cmc.updated_at DESC;

-- 8. Verificar relacionamento com organizações
SELECT 
    'Conexões por organização' as diagnostico,
    o.id as org_id,
    o.name as org_name,
    COUNT(DISTINCT c.id) as total_clients,
    COUNT(cmc.id) as total_connections
FROM organizations o
LEFT JOIN clients c ON c.org_id = o.id
LEFT JOIN client_meta_connections cmc ON cmc.client_id = c.id
GROUP BY o.id, o.name
ORDER BY total_connections DESC;

-- 9. Verificar últimas conexões criadas
SELECT 
    'Últimas 10 conexões criadas' as diagnostico,
    cmc.id,
    cmc.ad_account_id,
    cmc.account_name,
    cmc.is_active,
    cmc.created_at,
    c.name as client_name,
    o.name as org_name
FROM client_meta_connections cmc
JOIN clients c ON cmc.client_id = c.id
JOIN organizations o ON c.org_id = o.id
ORDER BY cmc.created_at DESC
LIMIT 10;

-- 10. Verificar campanhas associadas às conexões
SELECT 
    'Campanhas por conexão' as diagnostico,
    cmc.id as connection_id,
    cmc.account_name,
    COUNT(mc.id) as total_campaigns,
    c.name as client_name
FROM client_meta_connections cmc
LEFT JOIN meta_campaigns mc ON mc.connection_id = cmc.id
JOIN clients c ON cmc.client_id = c.id
GROUP BY cmc.id, cmc.account_name, c.name
ORDER BY total_campaigns DESC;
