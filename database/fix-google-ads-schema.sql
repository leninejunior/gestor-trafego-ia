-- Corrigir schema do Google Ads
-- Adicionar colunas que faltam e criar tabelas necessárias

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

-- Criar índice para busca rápida da chave ativa
CREATE INDEX IF NOT EXISTS idx_google_ads_encryption_keys_active 
ON google_ads_encryption_keys (is_active, expires_at) 
WHERE is_active = true;

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

-- Criar índice para consultas por usuário e data
CREATE INDEX IF NOT EXISTS idx_google_ads_audit_log_user_date 
ON google_ads_audit_log (user_id, created_at DESC);

-- 4. Inserir chave de criptografia inicial se não existir
INSERT INTO google_ads_encryption_keys (key_data, is_active)
SELECT 
  encode(gen_random_bytes(32), 'base64'),
  true
WHERE NOT EXISTS (
  SELECT 1 FROM google_ads_encryption_keys WHERE is_active = true
);

-- 5. Habilitar RLS nas novas tabelas
ALTER TABLE google_ads_encryption_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_audit_log ENABLE ROW LEVEL SECURITY;

-- 6. Criar políticas RLS básicas
CREATE POLICY "Allow service role access to encryption keys" 
ON google_ads_encryption_keys 
FOR ALL 
TO service_role 
USING (true);

CREATE POLICY "Allow service role access to audit log" 
ON google_ads_audit_log 
FOR ALL 
TO service_role 
USING (true);

-- 7. Comentários para documentação
COMMENT ON TABLE google_ads_encryption_keys IS 'Chaves de criptografia para tokens do Google Ads';
COMMENT ON TABLE google_ads_audit_log IS 'Log de auditoria para ações do Google Ads';
COMMENT ON COLUMN google_ads_connections.token_expires_at IS 'Data de expiração do token de acesso';
COMMENT ON COLUMN google_ads_connections.encrypted_refresh_token IS 'Refresh token criptografado';
COMMENT ON COLUMN google_ads_connections.encrypted_access_token IS 'Access token criptografado';