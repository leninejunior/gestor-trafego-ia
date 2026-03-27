-- Agendamentos semanais de alteracao de orcamento para campanhas Meta
CREATE TABLE IF NOT EXISTS public.meta_campaign_budget_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  ad_account_id TEXT NOT NULL,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  hour SMALLINT NOT NULL CHECK (hour >= 0 AND hour <= 23),
  minute SMALLINT NOT NULL DEFAULT 0 CHECK (minute >= 0 AND minute <= 59),
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  daily_budget NUMERIC(12, 2) NOT NULL CHECK (daily_budget > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  last_error TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(client_id, campaign_id, day_of_week, hour, minute, timezone)
);

CREATE INDEX IF NOT EXISTS idx_meta_campaign_budget_schedules_client
  ON public.meta_campaign_budget_schedules(client_id);

CREATE INDEX IF NOT EXISTS idx_meta_campaign_budget_schedules_campaign
  ON public.meta_campaign_budget_schedules(campaign_id);

CREATE INDEX IF NOT EXISTS idx_meta_campaign_budget_schedules_due
  ON public.meta_campaign_budget_schedules(is_active, next_run_at);

CREATE OR REPLACE FUNCTION public.set_meta_campaign_budget_schedules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_meta_campaign_budget_schedules_updated_at ON public.meta_campaign_budget_schedules;
CREATE TRIGGER update_meta_campaign_budget_schedules_updated_at
  BEFORE UPDATE ON public.meta_campaign_budget_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.set_meta_campaign_budget_schedules_updated_at();

ALTER TABLE public.meta_campaign_budget_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select own campaign budget schedules" ON public.meta_campaign_budget_schedules;
CREATE POLICY "Users can select own campaign budget schedules"
  ON public.meta_campaign_budget_schedules
  FOR SELECT
  USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can insert own campaign budget schedules" ON public.meta_campaign_budget_schedules;
CREATE POLICY "Users can insert own campaign budget schedules"
  ON public.meta_campaign_budget_schedules
  FOR INSERT
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can update own campaign budget schedules" ON public.meta_campaign_budget_schedules;
CREATE POLICY "Users can update own campaign budget schedules"
  ON public.meta_campaign_budget_schedules
  FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can delete own campaign budget schedules" ON public.meta_campaign_budget_schedules;
CREATE POLICY "Users can delete own campaign budget schedules"
  ON public.meta_campaign_budget_schedules
  FOR DELETE
  USING (created_by = auth.uid());

