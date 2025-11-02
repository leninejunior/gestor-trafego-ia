-- ============================================================================
-- Google Ads Encryption Keys Schema
-- 
-- Stores encryption keys for Google Ads token encryption with rotation support
-- Requirements: 1.1, 1.3
-- ============================================================================

-- Create encryption keys table
CREATE TABLE IF NOT EXISTS google_ads_encryption_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  version INTEGER NOT NULL UNIQUE,
  key_hash TEXT NOT NULL, -- Encrypted encryption key
  algorithm TEXT NOT NULL DEFAULT 'aes-256-gcm',
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_algorithm CHECK (algorithm IN ('aes-256-gcm', 'aes-256-cbc')),
  CONSTRAINT positive_version CHECK (version > 0)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_google_encryption_keys_version 
  ON google_ads_encryption_keys(version);

CREATE INDEX IF NOT EXISTS idx_google_encryption_keys_active 
  ON google_ads_encryption_keys(is_active) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_google_encryption_keys_created 
  ON google_ads_encryption_keys(created_at DESC);

-- Ensure only one active key at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_google_encryption_keys_single_active 
  ON google_ads_encryption_keys(is_active) 
  WHERE is_active = true;

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

-- Enable RLS on encryption keys table
ALTER TABLE google_ads_encryption_keys ENABLE ROW LEVEL SECURITY;

-- Only service role can access encryption keys (no user access)
CREATE POLICY "Service role only access to encryption keys"
  ON google_ads_encryption_keys
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- Audit Log for Key Operations
-- ============================================================================

-- Create audit log table for key operations
CREATE TABLE IF NOT EXISTS google_ads_key_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  operation TEXT NOT NULL, -- 'create', 'rotate', 'delete', 'access'
  key_version INTEGER,
  user_id UUID REFERENCES auth.users(id),
  client_id UUID, -- Optional: which client triggered the operation
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_operation CHECK (
    operation IN ('create', 'rotate', 'delete', 'access', 'decrypt', 'encrypt')
  )
);

-- Create indexes for audit log
CREATE INDEX IF NOT EXISTS idx_google_key_audit_operation 
  ON google_ads_key_audit_log(operation);

CREATE INDEX IF NOT EXISTS idx_google_key_audit_created 
  ON google_ads_key_audit_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_google_key_audit_user 
  ON google_ads_key_audit_log(user_id);

CREATE INDEX IF NOT EXISTS idx_google_key_audit_client 
  ON google_ads_key_audit_log(client_id);

CREATE INDEX IF NOT EXISTS idx_google_key_audit_key_version 
  ON google_ads_key_audit_log(key_version);

-- Enable RLS on audit log
ALTER TABLE google_ads_key_audit_log ENABLE ROW LEVEL SECURITY;

-- Admin users can view all audit logs
CREATE POLICY "Admin users can view key audit logs"
  ON google_ads_key_audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE user_id = auth.uid() 
      AND is_active = true
    )
  );

-- Service role can insert audit logs
CREATE POLICY "Service role can insert key audit logs"
  ON google_ads_key_audit_log
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- Functions for Key Management
-- ============================================================================

-- Function to log key operations
CREATE OR REPLACE FUNCTION log_key_operation(
  p_operation TEXT,
  p_key_version INTEGER DEFAULT NULL,
  p_client_id UUID DEFAULT NULL,
  p_success BOOLEAN DEFAULT true,
  p_error_message TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  audit_id UUID;
BEGIN
  INSERT INTO google_ads_key_audit_log (
    operation,
    key_version,
    user_id,
    client_id,
    ip_address,
    success,
    error_message,
    metadata
  ) VALUES (
    p_operation,
    p_key_version,
    auth.uid(),
    p_client_id,
    inet_client_addr(),
    p_success,
    p_error_message,
    p_metadata
  ) RETURNING id INTO audit_id;
  
  RETURN audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get active encryption key version
CREATE OR REPLACE FUNCTION get_active_encryption_key_version()
RETURNS INTEGER AS $$
DECLARE
  key_version INTEGER;
BEGIN
  SELECT version INTO key_version
  FROM google_ads_encryption_keys
  WHERE is_active = true
  ORDER BY version DESC
  LIMIT 1;
  
  RETURN COALESCE(key_version, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if key rotation is needed
CREATE OR REPLACE FUNCTION is_key_rotation_needed(rotation_days INTEGER DEFAULT 90)
RETURNS BOOLEAN AS $$
DECLARE
  last_rotation TIMESTAMPTZ;
  needs_rotation BOOLEAN := false;
BEGIN
  SELECT created_at INTO last_rotation
  FROM google_ads_encryption_keys
  WHERE is_active = true
  ORDER BY version DESC
  LIMIT 1;
  
  IF last_rotation IS NULL THEN
    needs_rotation := true;
  ELSIF last_rotation < (NOW() - (rotation_days || ' days')::INTERVAL) THEN
    needs_rotation := true;
  END IF;
  
  RETURN needs_rotation;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Triggers for Audit Logging
-- ============================================================================

-- Trigger function to log key changes
CREATE OR REPLACE FUNCTION trigger_log_key_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_key_operation(
      'create',
      NEW.version,
      NULL,
      true,
      NULL,
      jsonb_build_object(
        'algorithm', NEW.algorithm,
        'is_active', NEW.is_active
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Log activation/deactivation
    IF OLD.is_active != NEW.is_active THEN
      PERFORM log_key_operation(
        CASE WHEN NEW.is_active THEN 'activate' ELSE 'deactivate' END,
        NEW.version,
        NULL,
        true,
        NULL,
        jsonb_build_object(
          'old_active', OLD.is_active,
          'new_active', NEW.is_active
        )
      );
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_key_operation(
      'delete',
      OLD.version,
      NULL,
      true,
      NULL,
      jsonb_build_object(
        'algorithm', OLD.algorithm,
        'was_active', OLD.is_active
      )
    );
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for key changes
DROP TRIGGER IF EXISTS trigger_google_ads_key_changes ON google_ads_encryption_keys;
CREATE TRIGGER trigger_google_ads_key_changes
  AFTER INSERT OR UPDATE OR DELETE ON google_ads_encryption_keys
  FOR EACH ROW EXECUTE FUNCTION trigger_log_key_changes();

-- ============================================================================
-- Initial Setup
-- ============================================================================

-- Create initial key version 1 (will be populated by the application)
-- This is just a placeholder - the actual key will be generated by the crypto service

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON google_ads_encryption_keys TO service_role;
GRANT SELECT, INSERT ON google_ads_key_audit_log TO service_role;
GRANT USAGE ON SCHEMA public TO service_role;

-- ============================================================================
-- Cleanup and Maintenance
-- ============================================================================

-- Function to cleanup old audit logs (keep last 6 months)
CREATE OR REPLACE FUNCTION cleanup_old_key_audit_logs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM google_ads_key_audit_log
  WHERE created_at < (NOW() - INTERVAL '6 months');
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

COMMENT ON TABLE google_ads_encryption_keys IS 
'Stores encryption keys for Google Ads token encryption with version support and rotation';

COMMENT ON COLUMN google_ads_encryption_keys.version IS 
'Key version number, incremented on each rotation';

COMMENT ON COLUMN google_ads_encryption_keys.key_hash IS 
'Encrypted encryption key using master key from environment';

COMMENT ON COLUMN google_ads_encryption_keys.is_active IS 
'Only one key can be active at a time for encryption';

COMMENT ON TABLE google_ads_key_audit_log IS 
'Audit log for all encryption key operations and access';

COMMENT ON FUNCTION log_key_operation IS 
'Logs encryption key operations for security audit trail';

COMMENT ON FUNCTION get_active_encryption_key_version IS 
'Returns the version number of the currently active encryption key';

COMMENT ON FUNCTION is_key_rotation_needed IS 
'Checks if key rotation is needed based on age of active key';

COMMENT ON FUNCTION cleanup_old_key_audit_logs IS 
'Removes audit logs older than 6 months to prevent table bloat';