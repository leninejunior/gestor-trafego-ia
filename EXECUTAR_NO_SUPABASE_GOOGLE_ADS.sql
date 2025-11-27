-- EXECUTAR NO SUPABASE - Correção do Schema Google Ads
-- Copie e cole este SQL no SQL Editor do Supabase

-- 1. Criar tabela google_ads_connections se não existir
CREATE TABLE IF NOT EXISTS google_ads_connections (
  id UUID PRIMARY ?/? DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  client_id UUID,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  token_expires_at TIMESTAMPTZ,
  encrypted_refresh_token TEXT,
  encrypted_access_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Criar tabela de chaves de criptografia
CREATE TABLE IF NOT EXISTS google_ads_encryption_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_data TEXT NOT NULL,
  algorithm VARCHAR(50) DEFAULT 'aes-256-gcm',
  version INTEGER DEFAULT 1,
  key_hash TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')
);

-- 3. Criar tabela de auditoria
CREATE TABLE IF NOT EXISTS google_ads_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES google_ads_connections(id) ON DELETE CASCADE,
  user_id UUID,
  operation TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  action TEXT, -- Legacy field
  details JSONB, -- Legacy field
  metadata JSONB,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  sensitive_data BOOLEAN DEFAULT false,
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

CREATE INDEX IF NOT EXISTS idx_google_audit_client 
ON google_ads_audit_log(client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_google_audit_connection 
ON google_ads_audit_log(connection_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_google_audit_operation 
ON google_ads_audit_log(operation, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_google_ads_connections_user 
ON google_ads_connections (user_id);

CREATE INDEX IF NOT EXISTS idx_google_ads_connections_client 
ON google_ads_connections (client_id);

-- 5. Inserir chave de criptografia inicial
INSERT INTO google_ads_encryption_keys (key_data, is_active)
SELECT 
  encode(gen_random_bytes(32), 'base64'),
  true
WHERE NOT EXISTS (
  SELECT 1 FROM google_ads_encryption_keys WHERE is_active = true
);

-- 6. Habilitar RLS
ALTER TABLE google_ads_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_encryption_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_audit_log ENABLE ROW LEVEL SECURITY;

-- 7. Criar políticas RLS
DROP POLICY IF EXISTS "Allow service role access to connections" ON google_ads_connections;
CREATE POLICY "Allow service role access to connections" 
ON google_ads_connections 
FOR ALL 
TO service_role 
USING (true);

DROP POLICY IF EXISTS "Allow service role access to encryption keys" ON google_ads_encryption_keys;
CREATE POLICY "Allow service role access to encryption keys" 
ON google_ads_encryption_keys 
FOR ALL 
TO service_role 
USING (true);

DROP POLICY IF EXISTS "Allow service role access to audit log" ON google_ads_audit_log;
DROP POLICY IF EXISTS "service_role_audit_log_access" ON google_ads_audit_log;
DROP POLICY IF EXISTS "authenticated_users_audit_log_access" ON google_ads_audit_log;

CREATE POLICY "service_role_audit_log_access"
ON google_ads_audit_log 
FOR ALL 
TO service_role 
USING (true);

CREATE POLICY "authenticated_users_audit_log_access"
ON google_ads_audit_log
FOR SELECT
TO authenticated
USING (
  client_id IN (
    SELECT c.id 
    FROM clients c
    JOIN memberships m ON m.organization_id = c.org_id
    WHERE m.user_id = auth.uid()
  )
  OR user_id = auth.uid()
);

-- 8. Comentários
COMMENT ON TABLE google_ads_connections IS 'Conexões OAuth do Google Ads';
COMMENT ON TABLE google_ads_encryption_keys IS 'Chaves de criptografia para tokens do Google Ads';
COMMENT ON TABLE google_ads_audit_log IS 'Log de auditoria para ações do Google Ads';

-- 9. Verificar se tudo foi criado
SELECT 'google_ads_connections' as table_name, 'exists' as status
FROM information_schema.tables 
WHERE table_name = 'google_ads_connections'

UNION ALL

SELECT 'google_ads_encryption_keys' as table_name, 'exists' as status
FROM information_schema.tables 
WHERE table_name = 'google_ads_encryption_keys'

UNION ALL

SELECT 'google_ads_audit_log' as table_name, 'exists' as status
FROM information_schema.tables 
WHERE table_name = 'google_ads_audit_log'

UNION ALL

SELECT 'encryption_key_count' as table_name, count(*)::text as status
FROM google_ads_encryption_keys 
WHERE is_active = true;