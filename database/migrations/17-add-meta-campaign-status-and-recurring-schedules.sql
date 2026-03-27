-- Evolui agendamento de orcamento para data/hora com recorrencia opcional
ALTER TABLE public.meta_campaign_budget_schedules
  ADD COLUMN IF NOT EXISTS scheduled_date DATE;

UPDATE public.meta_campaign_budget_schedules
SET scheduled_date = COALESCE(
  (next_run_at AT TIME ZONE COALESCE(NULLIF(timezone, ''), 'UTC'))::date,
  CURRENT_DATE
)
WHERE scheduled_date IS NULL;

ALTER TABLE public.meta_campaign_budget_schedules
  ALTER COLUMN scheduled_date SET NOT NULL;

ALTER TABLE public.meta_campaign_budget_schedules
  ADD COLUMN IF NOT EXISTS recurrence_type TEXT NOT NULL DEFAULT 'weekly';

ALTER TABLE public.meta_campaign_budget_schedules
  ADD COLUMN IF NOT EXISTS recurrence_interval SMALLINT NOT NULL DEFAULT 1;

ALTER TABLE public.meta_campaign_budget_schedules
  DROP CONSTRAINT IF EXISTS meta_campaign_budget_schedules_recurrence_type_check;

ALTER TABLE public.meta_campaign_budget_schedules
  ADD CONSTRAINT meta_campaign_budget_schedules_recurrence_type_check
  CHECK (recurrence_type IN ('none', 'daily', 'weekly', 'monthly'));

ALTER TABLE public.meta_campaign_budget_schedules
  DROP CONSTRAINT IF EXISTS meta_campaign_budget_schedules_recurrence_interval_check;

ALTER TABLE public.meta_campaign_budget_schedules
  ADD CONSTRAINT meta_campaign_budget_schedules_recurrence_interval_check
  CHECK (recurrence_interval >= 1 AND recurrence_interval <= 365);

DO $$
DECLARE old_unique_constraint_name TEXT;
BEGIN
  SELECT con.conname
  INTO old_unique_constraint_name
  FROM pg_constraint con
  INNER JOIN pg_class rel ON rel.oid = con.conrelid
  INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'meta_campaign_budget_schedules'
    AND con.contype = 'u'
    AND pg_get_constraintdef(con.oid) ILIKE '%day_of_week%'
    AND pg_get_constraintdef(con.oid) ILIKE '%hour%'
    AND pg_get_constraintdef(con.oid) ILIKE '%minute%'
    AND pg_get_constraintdef(con.oid) ILIKE '%timezone%'
  LIMIT 1;

  IF old_unique_constraint_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.meta_campaign_budget_schedules DROP CONSTRAINT %I',
      old_unique_constraint_name
    );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_meta_campaign_budget_schedules_unique_datetime
  ON public.meta_campaign_budget_schedules(
    client_id,
    campaign_id,
    scheduled_date,
    hour,
    minute,
    timezone
  );

-- Liga/desliga de campanha por data/hora com recorrencia opcional
CREATE TABLE IF NOT EXISTS public.meta_campaign_status_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  ad_account_id TEXT NOT NULL,
  target_status TEXT NOT NULL CHECK (target_status IN ('ACTIVE', 'PAUSED')),
  scheduled_date DATE NOT NULL,
  hour SMALLINT NOT NULL CHECK (hour >= 0 AND hour <= 23),
  minute SMALLINT NOT NULL DEFAULT 0 CHECK (minute >= 0 AND minute <= 59),
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  recurrence_type TEXT NOT NULL DEFAULT 'none' CHECK (recurrence_type IN ('none', 'daily', 'weekly', 'monthly')),
  recurrence_interval SMALLINT NOT NULL DEFAULT 1 CHECK (recurrence_interval >= 1 AND recurrence_interval <= 365),
  is_active BOOLEAN NOT NULL DEFAULT true,
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  last_error TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_meta_campaign_status_schedules_unique_datetime
  ON public.meta_campaign_status_schedules(
    client_id,
    campaign_id,
    target_status,
    scheduled_date,
    hour,
    minute,
    timezone
  );

CREATE INDEX IF NOT EXISTS idx_meta_campaign_status_schedules_client
  ON public.meta_campaign_status_schedules(client_id);

CREATE INDEX IF NOT EXISTS idx_meta_campaign_status_schedules_campaign
  ON public.meta_campaign_status_schedules(campaign_id);

CREATE INDEX IF NOT EXISTS idx_meta_campaign_status_schedules_due
  ON public.meta_campaign_status_schedules(is_active, next_run_at);

CREATE OR REPLACE FUNCTION public.set_meta_campaign_status_schedules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_meta_campaign_status_schedules_updated_at
  ON public.meta_campaign_status_schedules;
CREATE TRIGGER update_meta_campaign_status_schedules_updated_at
  BEFORE UPDATE ON public.meta_campaign_status_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.set_meta_campaign_status_schedules_updated_at();

ALTER TABLE public.meta_campaign_status_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select own campaign status schedules"
  ON public.meta_campaign_status_schedules;
CREATE POLICY "Users can select own campaign status schedules"
  ON public.meta_campaign_status_schedules
  FOR SELECT
  USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can insert own campaign status schedules"
  ON public.meta_campaign_status_schedules;
CREATE POLICY "Users can insert own campaign status schedules"
  ON public.meta_campaign_status_schedules
  FOR INSERT
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can update own campaign status schedules"
  ON public.meta_campaign_status_schedules;
CREATE POLICY "Users can update own campaign status schedules"
  ON public.meta_campaign_status_schedules
  FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can delete own campaign status schedules"
  ON public.meta_campaign_status_schedules;
CREATE POLICY "Users can delete own campaign status schedules"
  ON public.meta_campaign_status_schedules
  FOR DELETE
  USING (created_by = auth.uid());
