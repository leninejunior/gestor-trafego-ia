-- 11-create-campaign-squad-schema.sql
-- Schema do microserviço Campaign Squad

CREATE SCHEMA IF NOT EXISTS campaign_squad;

CREATE TABLE IF NOT EXISTS campaign_squad.campaign_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  cadence TEXT NOT NULL CHECK (cadence IN ('monthly', 'weekly')),
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  day_of_month INTEGER,
  hour INTEGER NOT NULL DEFAULT 9,
  minute INTEGER NOT NULL DEFAULT 0,
  next_run_at TIMESTAMPTZ,
  payload_template JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_squad.campaign_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES campaign_squad.campaign_schedules(id) ON DELETE SET NULL,
  campaign_name TEXT NOT NULL,
  objective TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'queued',
    'running',
    'awaiting_approval',
    'publishing',
    'completed',
    'rejected',
    'failed'
  )),
  stage TEXT NOT NULL,
  allow_auto_refine BOOLEAN NOT NULL DEFAULT TRUE,
  refinement_count INTEGER NOT NULL DEFAULT 0,
  llm_config_snapshot JSONB,
  blueprint JSONB,
  creative_batch JSONB,
  publish_result JSONB,
  timeline JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_squad.campaign_blueprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES campaign_squad.campaign_runs(id) ON DELETE CASCADE,
  strategy_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_squad.creative_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES campaign_squad.campaign_runs(id) ON DELETE CASCADE,
  iteration INTEGER NOT NULL DEFAULT 1,
  summary JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_squad.creative_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES campaign_squad.creative_batches(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL,
  title TEXT NOT NULL,
  storage_url TEXT,
  content_text TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_squad.approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES campaign_squad.campaign_runs(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES campaign_squad.creative_batches(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  decided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  feedback TEXT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_squad.approval_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id UUID NOT NULL REFERENCES campaign_squad.approval_requests(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  feedback_type TEXT NOT NULL DEFAULT 'general',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_squad.publish_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES campaign_squad.campaign_runs(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('meta', 'google')),
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed')) DEFAULT 'queued',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  payload JSONB,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_squad.publish_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publish_job_id UUID NOT NULL REFERENCES campaign_squad.publish_jobs(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,
  success BOOLEAN NOT NULL,
  request_payload JSONB,
  response_payload JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_squad.dead_letter_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES campaign_squad.campaign_runs(id) ON DELETE SET NULL,
  job_name TEXT NOT NULL,
  payload JSONB,
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'reprocessed', 'ignored')) DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_squad.squad_llm_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_role TEXT NOT NULL DEFAULT 'default',
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  token_reference TEXT NOT NULL,
  temperature NUMERIC(3,2) DEFAULT 0.30,
  max_tokens INTEGER DEFAULT 4000,
  fallback_model TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_squad.squad_llm_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  alias TEXT NOT NULL,
  secret_ciphertext TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, provider, alias)
);

CREATE TABLE IF NOT EXISTS campaign_squad.whatsapp_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES campaign_squad.campaign_runs(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  message_preview TEXT,
  sent BOOLEAN NOT NULL DEFAULT FALSE,
  provider_response JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_schedules_org_client ON campaign_squad.campaign_schedules(organization_id, client_id);
CREATE INDEX IF NOT EXISTS idx_campaign_runs_org_client ON campaign_squad.campaign_runs(organization_id, client_id);
CREATE INDEX IF NOT EXISTS idx_campaign_runs_status ON campaign_squad.campaign_runs(status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_run ON campaign_squad.approval_requests(run_id);
CREATE INDEX IF NOT EXISTS idx_publish_jobs_run ON campaign_squad.publish_jobs(run_id);
CREATE INDEX IF NOT EXISTS idx_publish_jobs_status ON campaign_squad.publish_jobs(status);
CREATE INDEX IF NOT EXISTS idx_dead_letter_jobs_status ON campaign_squad.dead_letter_jobs(status);
CREATE INDEX IF NOT EXISTS idx_llm_configs_org_active ON campaign_squad.squad_llm_configs(organization_id, is_active);

CREATE OR REPLACE FUNCTION campaign_squad.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_campaign_schedules_updated_at ON campaign_squad.campaign_schedules;
CREATE TRIGGER trg_campaign_schedules_updated_at
BEFORE UPDATE ON campaign_squad.campaign_schedules
FOR EACH ROW EXECUTE FUNCTION campaign_squad.set_updated_at();

DROP TRIGGER IF EXISTS trg_campaign_runs_updated_at ON campaign_squad.campaign_runs;
CREATE TRIGGER trg_campaign_runs_updated_at
BEFORE UPDATE ON campaign_squad.campaign_runs
FOR EACH ROW EXECUTE FUNCTION campaign_squad.set_updated_at();

DROP TRIGGER IF EXISTS trg_approval_requests_updated_at ON campaign_squad.approval_requests;
CREATE TRIGGER trg_approval_requests_updated_at
BEFORE UPDATE ON campaign_squad.approval_requests
FOR EACH ROW EXECUTE FUNCTION campaign_squad.set_updated_at();

DROP TRIGGER IF EXISTS trg_publish_jobs_updated_at ON campaign_squad.publish_jobs;
CREATE TRIGGER trg_publish_jobs_updated_at
BEFORE UPDATE ON campaign_squad.publish_jobs
FOR EACH ROW EXECUTE FUNCTION campaign_squad.set_updated_at();

DROP TRIGGER IF EXISTS trg_dead_letter_jobs_updated_at ON campaign_squad.dead_letter_jobs;
CREATE TRIGGER trg_dead_letter_jobs_updated_at
BEFORE UPDATE ON campaign_squad.dead_letter_jobs
FOR EACH ROW EXECUTE FUNCTION campaign_squad.set_updated_at();

DROP TRIGGER IF EXISTS trg_llm_configs_updated_at ON campaign_squad.squad_llm_configs;
CREATE TRIGGER trg_llm_configs_updated_at
BEFORE UPDATE ON campaign_squad.squad_llm_configs
FOR EACH ROW EXECUTE FUNCTION campaign_squad.set_updated_at();

DROP TRIGGER IF EXISTS trg_llm_credentials_updated_at ON campaign_squad.squad_llm_credentials;
CREATE TRIGGER trg_llm_credentials_updated_at
BEFORE UPDATE ON campaign_squad.squad_llm_credentials
FOR EACH ROW EXECUTE FUNCTION campaign_squad.set_updated_at();

ALTER TABLE campaign_squad.campaign_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_squad.campaign_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_squad.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_squad.squad_llm_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_squad.squad_llm_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS campaign_squad_schedule_org_members ON campaign_squad.campaign_schedules;
CREATE POLICY campaign_squad_schedule_org_members ON campaign_squad.campaign_schedules
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS campaign_squad_runs_org_members ON campaign_squad.campaign_runs;
CREATE POLICY campaign_squad_runs_org_members ON campaign_squad.campaign_runs
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS campaign_squad_approval_org_members ON campaign_squad.approval_requests;
CREATE POLICY campaign_squad_approval_org_members ON campaign_squad.approval_requests
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS campaign_squad_llm_configs_org_admins ON campaign_squad.squad_llm_configs;
CREATE POLICY campaign_squad_llm_configs_org_admins ON campaign_squad.squad_llm_configs
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS campaign_squad_llm_credentials_org_admins ON campaign_squad.squad_llm_credentials;
CREATE POLICY campaign_squad_llm_credentials_org_admins ON campaign_squad.squad_llm_credentials
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

