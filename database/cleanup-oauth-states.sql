-- Limpar estados OAuth antigos ou inválidos
-- Execute este script para resolver problemas de autenticação Google

-- 1. Deletar todos os estados OAuth expirados
DELETE FROM oauth_states
WHERE expires_at < NOW();

-- 2. Deletar estados OAuth sem user_id (dados antigos/corrompidos)
DELETE FROM oauth_states
WHERE user_id IS NULL;

-- 3. Deletar estados OAuth muito antigos (mais de 1 hora)
DELETE FROM oauth_states
WHERE created_at < NOW() - INTERVAL '1 hour';

-- 4. Verificar estados restantes
SELECT 
  id,
  state,
  client_id,
  user_id,
  provider,
  expires_at,
  created_at,
  CASE 
    WHEN expires_at < NOW() THEN 'EXPIRADO'
    WHEN user_id IS NULL THEN 'SEM USER_ID'
    ELSE 'OK'
  END as status
FROM oauth_states
ORDER BY created_at DESC;
