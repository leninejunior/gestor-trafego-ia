-- =====================================================
-- Prevenção de Duplicatas - Google Ads Connections
-- =====================================================
-- 
-- Este script adiciona constraints e índices para prevenir
-- conexões duplicadas do Google Ads por cliente
--

-- 1. Criar índice único para prevenir duplicatas de customer_id ativo
-- Permite apenas UMA conexão ativa por customer_id por cliente
DROP INDEX IF EXISTS idx_unique_active_google_customer;
CREATE UNIQUE INDEX idx_unique_active_google_customer 
ON google_ads_connections(client_id, customer_id) 
WHERE status = 'active';

COMMENT ON INDEX idx_unique_active_google_customer IS 
'Previne múltiplas conexões ativas do mesmo customer_id para um cliente';

-- 2. Criar função para limpar conexões antigas antes de inserir nova
CREATE OR REPLACE FUNCTION cleanup_old_google_connections()
RETURNS TRIGGER AS $$
BEGIN
  -- Se estamos inserindo uma nova conexão ativa
  IF NEW.status = 'active' THEN
    -- Marcar conexões antigas do mesmo customer_id como revoked
    UPDATE google_ads_connections
    SET 
      status = 'revoked',
      updated_at = NOW()
    WHERE 
      client_id = NEW.client_id 
      AND customer_id = NEW.customer_id
      AND id != NEW.id
      AND status = 'active';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Criar trigger para executar a limpeza automaticamente
DROP TRIGGER IF EXISTS trigger_cleanup_google_connections ON google_ads_connections;
CREATE TRIGGER trigger_cleanup_google_connections
  BEFORE INSERT OR UPDATE ON google_ads_connections
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_old_google_connections();

COMMENT ON FUNCTION cleanup_old_google_connections() IS 
'Automaticamente revoga conexões antigas quando uma nova é criada';

-- 4. Criar função para remover conexões revogadas antigas (30+ dias)
CREATE OR REPLACE FUNCTION cleanup_revoked_google_connections()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Remover conexões revogadas há mais de 30 dias
  DELETE FROM google_ads_connections
  WHERE 
    status = 'revoked'
    AND updated_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_revoked_google_connections() IS 
'Remove conexões revogadas há mais de 30 dias (executar via cron)';

-- 5. Adicionar índice para melhorar performance de queries
CREATE INDEX IF NOT EXISTS idx_google_connections_status 
ON google_ads_connections(client_id, status);

CREATE INDEX IF NOT EXISTS idx_google_connections_updated 
ON google_ads_connections(updated_at) 
WHERE status = 'revoked';

-- 6. Grant permissions
GRANT EXECUTE ON FUNCTION cleanup_revoked_google_connections() TO authenticated;

-- =====================================================
-- Verificação
-- =====================================================

-- Verificar conexões duplicadas existentes
SELECT 
  client_id,
  customer_id,
  COUNT(*) as count,
  STRING_AGG(id::text, ', ') as connection_ids,
  STRING_AGG(status, ', ') as statuses
FROM google_ads_connections
WHERE status = 'active'
GROUP BY client_id, customer_id
HAVING COUNT(*) > 1;

-- Se houver duplicatas, o resultado acima mostrará
-- Execute o script de correção antes de aplicar as constraints
