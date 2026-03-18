-- Correção de Duplicatas em Meta Connections
-- ATENÇÃO: Execute o diagnose-meta-duplicates.sql ANTES para entender o problema

-- PASSO 1: Backup das conexões atuais (opcional mas recomendado)
CREATE TABLE IF NOT EXISTS client_meta_connections_backup AS 
SELECT * FROM client_meta_connections;

-- PASSO 2: Remover duplicatas mantendo apenas a conexão mais recente e ativa
-- Para cada combinação de (client_id, ad_account_id), mantém apenas 1 registro

WITH ranked_connections AS (
  SELECT 
    id,
    client_id,
    ad_account_id,
    ROW_NUMBER() OVER (
      PARTITION BY client_id, ad_account_id 
      ORDER BY 
        is_active DESC,  -- Prioriza conexões ativas
        created_at DESC  -- Depois as mais recentes
    ) as rn
  FROM client_meta_connections
)
DELETE FROM client_meta_connections
WHERE id IN (
  SELECT id 
  FROM ranked_connections 
  WHERE rn > 1
);

-- PASSO 3: Verificar resultado
SELECT 
  client_id,
  ad_account_id,
  COUNT(*) as total
FROM client_meta_connections
GROUP BY client_id, ad_account_id
HAVING COUNT(*) > 1;

-- Se retornar 0 linhas, a duplicação foi corrigida!

-- PASSO 4: Adicionar constraint para prevenir duplicatas futuras
ALTER TABLE client_meta_connections
DROP CONSTRAINT IF EXISTS unique_client_ad_account;

ALTER TABLE client_meta_connections
ADD CONSTRAINT unique_client_ad_account 
UNIQUE (client_id, ad_account_id);

-- PASSO 5: Ver estatísticas finais
SELECT 
  'Total de conexões' as metric,
  COUNT(*) as value
FROM client_meta_connections
UNION ALL
SELECT 
  'Conexões ativas' as metric,
  COUNT(*) as value
FROM client_meta_connections
WHERE is_active = true
UNION ALL
SELECT 
  'Conexões únicas (client + account)' as metric,
  COUNT(DISTINCT (client_id, ad_account_id)) as value
FROM client_meta_connections;
