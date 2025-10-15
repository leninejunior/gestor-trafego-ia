-- Verificar estrutura das tabelas principais
-- Execute este script para verificar se as tabelas existem e têm a estrutura correta

-- 1. Verificar se as tabelas existem
SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('clients', 'client_meta_connections', 'meta_campaigns', 'users', 'organizations')
ORDER BY tablename;

-- 2. Verificar estrutura da tabela clients
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'clients'
ORDER BY ordinal_position;

-- 3. Verificar estrutura da tabela client_meta_connections
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'client_meta_connections'
ORDER BY ordinal_position;

-- 4. Verificar estrutura da tabela meta_campaigns
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'meta_campaigns'
ORDER BY ordinal_position;

-- 5. Contar registros em cada tabela
SELECT 
    'clients' as table_name,
    COUNT(*) as record_count
FROM clients
UNION ALL
SELECT 
    'client_meta_connections' as table_name,
    COUNT(*) as record_count
FROM client_meta_connections
UNION ALL
SELECT 
    'meta_campaigns' as table_name,
    COUNT(*) as record_count
FROM meta_campaigns
UNION ALL
SELECT 
    'users' as table_name,
    COUNT(*) as record_count
FROM users;

-- 6. Verificar políticas RLS (Row Level Security)
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('clients', 'client_meta_connections', 'meta_campaigns')
ORDER BY tablename;