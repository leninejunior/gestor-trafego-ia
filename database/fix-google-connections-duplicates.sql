-- ============================================================================
-- CORREÇÃO: Conexões Google Ads Duplicadas e Inválidas
-- ============================================================================
-- Cliente: e3ab33da-79f9-45e9-a43f-6ce76ceb9751
-- Problemas:
-- 1. Conexão com customer_id = 'pending' (inválido)
-- 2. Conexões duplicadas com customer_id = 8938635478
-- ============================================================================

-- PASSO 1: Ver estado atual
SELECT 
  id,
  customer_id,
  status,
  created_at,
  CASE 
    WHEN customer_id = 'pending' THEN '❌ INVÁLIDO'
    WHEN customer_id IN (
      SELECT customer_id 
      FROM google_ads_connections 
      WHERE client_id = 'e3ab33da-79f9-45e9-a43f-6ce76ceb9751'
      GROUP BY customer_id 
      HAVING COUNT(*) > 1
    ) THEN '⚠️ DUPLICADO'
    ELSE '✅ OK'
  END as diagnostico
FROM google_ads_connections
WHERE client_id = 'e3ab33da-79f9-45e9-a43f-6ce76ceb9751'
ORDER BY created_at DESC;

-- ============================================================================
-- LIMPEZA RECOMENDADA
-- ============================================================================

-- OPÇÃO 1: Deletar conexão inválida (customer_id = 'pending')
DELETE FROM google_ads_connections
WHERE client_id = 'e3ab33da-79f9-45e9-a43f-6ce76ceb9751'
AND customer_id = 'pending';

-- OPÇÃO 2: Manter apenas a conexão mais recente de cada customer_id
-- (Remove duplicatas, mantém a mais nova)
DELETE FROM google_ads_connections
WHERE id IN (
  SELECT id
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY client_id, customer_id 
        ORDER BY created_at DESC
      ) as rn
    FROM google_ads_connections
    WHERE client_id = 'e3ab33da-79f9-45e9-a43f-6ce76ceb9751'
    AND customer_id != 'pending'  -- Já deletado na opção 1
  ) sub
  WHERE rn > 1
);

-- ============================================================================
-- VERIFICAÇÃO APÓS LIMPEZA
-- ============================================================================

-- Ver conexões restantes
SELECT 
  id,
  customer_id,
  status,
  created_at,
  '✅ LIMPO' as estado
FROM google_ads_connections
WHERE client_id = 'e3ab33da-79f9-45e9-a43f-6ce76ceb9751'
ORDER BY created_at DESC;

-- Contar conexões por cliente
SELECT 
  client_id,
  COUNT(*) as total_conexoes,
  COUNT(DISTINCT customer_id) as contas_unicas
FROM google_ads_connections
WHERE status = 'active'
GROUP BY client_id;

-- ============================================================================
-- RESULTADO ESPERADO
-- ============================================================================
-- Após executar a limpeza, você deve ter:
-- - 2 conexões únicas (customer_id: 8938635478 e 3186237743)
-- - Nenhuma conexão com customer_id = 'pending'
-- - Nenhuma duplicata
-- ============================================================================
