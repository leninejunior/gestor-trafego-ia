-- 13-campaign-squad-execution-tasks.sql
ALTER TABLE campaign_squad.campaign_runs
  ADD COLUMN IF NOT EXISTS execution_tasks JSONB NOT NULL DEFAULT '[]'::jsonb;
