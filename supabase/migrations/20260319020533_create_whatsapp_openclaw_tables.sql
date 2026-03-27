-- MVP OpenClaw + WhatsApp
-- Vinculo de grupo -> cliente e trilha de auditoria de comandos

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS whatsapp_group_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id TEXT NOT NULL UNIQUE,
  group_name TEXT,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  can_read BOOLEAN NOT NULL DEFAULT TRUE,
  can_manage_campaigns BOOLEAN NOT NULL DEFAULT FALSE,
  allowed_sender_ids TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_group_bindings_client_id
  ON whatsapp_group_bindings(client_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_group_bindings_is_active
  ON whatsapp_group_bindings(is_active);

CREATE TABLE IF NOT EXISTS whatsapp_command_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  group_id TEXT,
  sender_id TEXT,
  message_id TEXT,
  command_text TEXT,
  normalized_command TEXT,
  action TEXT NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  target_campaign_id TEXT,
  allowed BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL,
  response_message TEXT,
  error_message TEXT,
  raw_event JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_command_audit_logs_group_id
  ON whatsapp_command_audit_logs(group_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_command_audit_logs_received_at
  ON whatsapp_command_audit_logs(received_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_command_audit_logs_status
  ON whatsapp_command_audit_logs(status);

ALTER TABLE whatsapp_group_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_command_audit_logs ENABLE ROW LEVEL SECURITY;

-- Sem policies abertas por padrão.
-- Service role continua com acesso total (bypass RLS).
