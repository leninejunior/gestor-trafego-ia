-- 12-campaign-squad-conversational-rag.sql
-- Evolucao para fluxo conversacional + contexto fixo (RAG) por cliente

CREATE SCHEMA IF NOT EXISTS campaign_squad;

ALTER TABLE campaign_squad.campaign_runs
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS idea_text TEXT,
  ADD COLUMN IF NOT EXISTS plan_draft JSONB,
  ADD COLUMN IF NOT EXISTS approved_plan JSONB,
  ADD COLUMN IF NOT EXISTS qa_loop_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS context_snapshot JSONB;

UPDATE campaign_squad.campaign_runs
SET mode = 'legacy'
WHERE mode IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'campaign_runs_status_check'
      AND conrelid = 'campaign_squad.campaign_runs'::regclass
  ) THEN
    ALTER TABLE campaign_squad.campaign_runs
      DROP CONSTRAINT campaign_runs_status_check;
  END IF;
END
$$;

ALTER TABLE campaign_squad.campaign_runs
  ADD CONSTRAINT campaign_runs_status_check CHECK (status IN (
    'briefing',
    'planning',
    'awaiting_plan_approval',
    'executing',
    'qa_review',
    'publishing',
    'completed',
    'failed',
    'needs_manual_intervention',
    'queued',
    'running',
    'awaiting_approval',
    'rejected'
  ));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'campaign_runs_mode_check'
      AND conrelid = 'campaign_squad.campaign_runs'::regclass
  ) THEN
    ALTER TABLE campaign_squad.campaign_runs
      ADD CONSTRAINT campaign_runs_mode_check CHECK (mode IN ('legacy', 'conversational'));
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS campaign_squad.run_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES campaign_squad.campaign_runs(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('system', 'assistant', 'user')),
  phase TEXT NOT NULL DEFAULT 'general',
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_run_messages_run_created
  ON campaign_squad.run_messages(run_id, created_at);

CREATE TABLE IF NOT EXISTS campaign_squad.client_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  company_overview TEXT NOT NULL DEFAULT '',
  products_services TEXT NOT NULL DEFAULT '',
  target_audience TEXT NOT NULL DEFAULT '',
  value_props TEXT NOT NULL DEFAULT '',
  brand_voice TEXT NOT NULL DEFAULT '',
  constraints TEXT NOT NULL DEFAULT '',
  offers TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_client_contexts_org_client
  ON campaign_squad.client_contexts(organization_id, client_id);

DROP TRIGGER IF EXISTS trg_client_contexts_updated_at ON campaign_squad.client_contexts;
CREATE TRIGGER trg_client_contexts_updated_at
BEFORE UPDATE ON campaign_squad.client_contexts
FOR EACH ROW EXECUTE FUNCTION campaign_squad.set_updated_at();
