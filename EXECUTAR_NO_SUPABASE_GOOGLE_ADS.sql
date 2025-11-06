-- EXECUTAR NO SUPABASE - Correção do Schema Google Ads
-- Copie e cole este SQL no SQL Editor do Supabase

-- 1. Adicionar colunas que faltam na tabela google_ads_connections
DO $$ 
BEGIN 
  -- Adicionar token_expires_at se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'google_ads_connections' 
    AND column_name = 'token_expires_at'
  ) THEN
    ALTER TABLE google_ads_connections 
    ADD COLUMN token_expires_at TIMESTAMPTZ;
  END IF;

  -- Adicionar encrypted_refresh_token se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'google_ads_connections' 
    AND column_name = 'encrypted_refresh_token'
  ) THEN
    ALTER TABLE google_ads_connections 
    ADD COLUMN encrypted_refresh_token TEXT;
  END IF;

  -- Adicionar encrypted_access_token se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'google_ads_connections' 
    AND column_name = 'encrypted_access_token'
  ) THEN
    ALTER TABLE google_ads_connections 
    ADD COLUMN encrypted_access_token TEXT;
  END IF;
END $$;

-- 2. Criar tabela de chaves de criptografia
CREATE TABLE IF NOT EXISTS google_ads_encryption_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_data TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')
);

-- 3. Criar tabela de auditoria
CREATE TABLE IF NOT EXISTS google_ads_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT NOT NULL,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Criar índices
CREATE INDEX IF NOT EXISTS idx_google_ads_encryption_keys_active 
ON google_ads_encryption_keys (is_active, expires_at) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_google_ads_audit_log_user_date 
ON google_ads_audit_log (user_id, created_at DESC);

-- 5. Inserir chave de criptografia inicial
INSERT INTO google_ads_encryption_keys (key_data, is_active)
SELECT 
  encode(gen_random_bytes(32), 'base64'),
  true
WHERE NOT EXISTS (
  SELECT 1 FROM google_ads_encryption_keys WHERE is_active = true
);

-- 6. Habilitar RLS
ALTER TABLE google_ads_encryption_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_audit_log ENABLE ROW LEVEL SECURITY;

-- 7. Criar políticas RLS
DROP POLICY IF EXISTS "Allow service role access to encryption keys" ON google_ads_encryption_keys;
CREATE POLICY "Allow service role access to encryption keys" 
ON google_ads_encryption_keys 
FOR ALL 
TO service_role 
USING (true);

DROP POLICY IF EXISTS "Allow service role access to audit log" ON google_ads_audit_log;
CREATE POLICY "Allow service role access to audit log" 
ON google_ads_audit_log 
FOR ALL 
TO service_role 
USING (true);

-- 8. Comentários
COMMENT ON TABLE google_ads_encryption_keys IS 'Chaves de criptografia para tokens do Google Ads';
COMMENT ON TABLE google_ads_audit_log IS 'Log de auditoria para ações do Google Ads';

-- 9. Verificar se tudo foi criado
SELECT 'google_ads_connections columns' as check_type, column_name 
FROM information_schema.columns 
WHERE table_name = 'google_ads_connections' 
AND column_name IN ('token_expires_at', 'encrypted_refresh_token', 'encrypted_access_token')

UNION ALL

SELECT 'encryption_keys table' as check_type, 'exists' as column_name
FROM information_schema.tables 
WHERE table_name = 'google_ads_encryption_keys'

UNION ALL

SELECT 'audit_log table' as check_type, 'exists' as column_name
FROM information_schema.tables 
WHERE table_name = 'google_ads_audit_log'

UNION ALL

SELECT 'encryption_key_count' as check_type, count(*)::text as column_name
FROM google_ads_encryption_keys 
WHERE is_active = true;