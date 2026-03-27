import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { META_CONFIG } from '@/lib/meta/config';
import {
  computeNextScheduledRun,
  normalizeRecurrenceInterval,
  normalizeRecurrenceType
} from '@/lib/meta/campaign-budget-scheduler';

type BaseScheduleRow = {
  id: string;
  campaign_id: string;
  client_id: string;
  ad_account_id: string;
  scheduled_date: string | null;
  hour: number;
  minute: number;
  timezone: string;
  recurrence_type: string | null;
  recurrence_interval: number | null;
  next_run_at: string;
};

type BudgetScheduleRow = BaseScheduleRow & {
  daily_budget: number;
};

type StatusScheduleRow = BaseScheduleRow & {
  target_status: 'ACTIVE' | 'PAUSED';
};

type CronExecutionSummary = {
  total: number;
  success: number;
  failed: number;
  details: Array<Record<string, unknown>>;
};

async function resolveMetaConnection(
  clientId: string,
  adAccountId: string
) {
  const supabase = createServiceClient();
  const { data: connection, error: connectionError } = await supabase
    .from('client_meta_connections')
    .select('access_token')
    .eq('client_id', clientId)
    .eq('ad_account_id', adAccountId)
    .eq('is_active', true)
    .maybeSingle();

  if (connectionError || !connection?.access_token) {
    throw new Error('Conexao Meta ativa nao encontrada para o agendamento');
  }

  return connection;
}

function getScheduledDateFallback(schedule: BaseScheduleRow): string {
  if (schedule.scheduled_date) {
    return schedule.scheduled_date;
  }

  if (schedule.next_run_at) {
    return new Date(schedule.next_run_at).toISOString().slice(0, 10);
  }

  return new Date().toISOString().slice(0, 10);
}

function computeNextRunAfterExecution(schedule: BaseScheduleRow, now: Date): Date | null {
  return computeNextScheduledRun({
    scheduledDate: getScheduledDateFallback(schedule),
    hour: schedule.hour,
    minute: schedule.minute,
    recurrenceType: normalizeRecurrenceType(schedule.recurrence_type),
    recurrenceInterval: normalizeRecurrenceInterval(schedule.recurrence_interval),
    timeZone: schedule.timezone,
    fromDate: new Date(now.getTime() + 60 * 1000)
  });
}

async function processBudgetSchedules(now: Date): Promise<CronExecutionSummary> {
  const supabase = createServiceClient();
  const nowIso = now.toISOString();

  const { data: dueSchedules, error: dueSchedulesError } = await supabase
    .from('meta_campaign_budget_schedules')
    .select('*')
    .eq('is_active', true)
    .lte('next_run_at', nowIso)
    .order('next_run_at', { ascending: true })
    .limit(200);

  if (dueSchedulesError) {
    throw new Error(`Erro ao consultar agendamentos de orcamento vencidos: ${dueSchedulesError.message}`);
  }

  if (!dueSchedules || dueSchedules.length === 0) {
    return {
      total: 0,
      success: 0,
      failed: 0,
      details: []
    };
  }

  let successCount = 0;
  let failureCount = 0;
  const details: Array<Record<string, unknown>> = [];

  for (const schedule of dueSchedules as BudgetScheduleRow[]) {
    let success = false;
    let errorMessage: string | null = null;

    try {
      const connection = await resolveMetaConnection(schedule.client_id, schedule.ad_account_id);
      const updateData = {
        access_token: connection.access_token,
        daily_budget: Math.round(Number(schedule.daily_budget) * 100)
      };

      const response = await fetch(
        `${META_CONFIG.BASE_URL}/${META_CONFIG.API_VERSION}/${schedule.campaign_id}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData)
        }
      );

      const metaResult = await response.json();
      if (!response.ok || metaResult?.error) {
        throw new Error(metaResult?.error?.message || 'Erro ao atualizar orcamento na Meta API');
      }

      success = true;
      successCount += 1;
    } catch (error) {
      failureCount += 1;
      errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    }

    const recurrenceType = normalizeRecurrenceType(schedule.recurrence_type);
    const calculatedNextRun = computeNextRunAfterExecution(schedule, now);
    const retryRun = !success && recurrenceType === 'none'
      ? new Date(now.getTime() + (10 * 60 * 1000))
      : null;
    const finalNextRun = calculatedNextRun ?? retryRun;

    const updatePayload: Record<string, unknown> = {
      next_run_at: finalNextRun ? finalNextRun.toISOString() : null,
      is_active: Boolean(finalNextRun),
      last_error: errorMessage
    };

    if (success) {
      updatePayload.last_run_at = nowIso;
    }

    const { error: updateError } = await supabase
      .from('meta_campaign_budget_schedules')
      .update(updatePayload)
      .eq('id', schedule.id);

    if (updateError) {
      console.error('[Meta Budget Schedule Cron] Erro ao atualizar estado do agendamento:', {
        scheduleId: schedule.id,
        error: updateError
      });
    }

    details.push({
      type: 'budget',
      scheduleId: schedule.id,
      campaignId: schedule.campaign_id,
      success,
      error: errorMessage,
      nextRunAt: finalNextRun?.toISOString() ?? null
    });
  }

  return {
    total: dueSchedules.length,
    success: successCount,
    failed: failureCount,
    details
  };
}

async function processStatusSchedules(now: Date): Promise<CronExecutionSummary> {
  const supabase = createServiceClient();
  const nowIso = now.toISOString();

  const { data: dueSchedules, error: dueSchedulesError } = await supabase
    .from('meta_campaign_status_schedules')
    .select('*')
    .eq('is_active', true)
    .lte('next_run_at', nowIso)
    .order('next_run_at', { ascending: true })
    .limit(200);

  if (dueSchedulesError) {
    throw new Error(`Erro ao consultar agendamentos de status vencidos: ${dueSchedulesError.message}`);
  }

  if (!dueSchedules || dueSchedules.length === 0) {
    return {
      total: 0,
      success: 0,
      failed: 0,
      details: []
    };
  }

  let successCount = 0;
  let failureCount = 0;
  const details: Array<Record<string, unknown>> = [];

  for (const schedule of dueSchedules as StatusScheduleRow[]) {
    let success = false;
    let errorMessage: string | null = null;

    try {
      const connection = await resolveMetaConnection(schedule.client_id, schedule.ad_account_id);
      const updateData = {
        access_token: connection.access_token,
        status: schedule.target_status
      };

      const response = await fetch(
        `${META_CONFIG.BASE_URL}/${META_CONFIG.API_VERSION}/${schedule.campaign_id}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData)
        }
      );

      const metaResult = await response.json();
      if (!response.ok || metaResult?.error) {
        throw new Error(metaResult?.error?.message || 'Erro ao atualizar status na Meta API');
      }

      success = true;
      successCount += 1;
    } catch (error) {
      failureCount += 1;
      errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    }

    const recurrenceType = normalizeRecurrenceType(schedule.recurrence_type);
    const calculatedNextRun = computeNextRunAfterExecution(schedule, now);
    const retryRun = !success && recurrenceType === 'none'
      ? new Date(now.getTime() + (10 * 60 * 1000))
      : null;
    const finalNextRun = calculatedNextRun ?? retryRun;

    const updatePayload: Record<string, unknown> = {
      next_run_at: finalNextRun ? finalNextRun.toISOString() : null,
      is_active: Boolean(finalNextRun),
      last_error: errorMessage
    };

    if (success) {
      updatePayload.last_run_at = nowIso;
    }

    const { error: updateError } = await supabase
      .from('meta_campaign_status_schedules')
      .update(updatePayload)
      .eq('id', schedule.id);

    if (updateError) {
      console.error('[Meta Status Schedule Cron] Erro ao atualizar estado do agendamento:', {
        scheduleId: schedule.id,
        error: updateError
      });
    }

    details.push({
      type: 'status',
      scheduleId: schedule.id,
      campaignId: schedule.campaign_id,
      targetStatus: schedule.target_status,
      success,
      error: errorMessage,
      nextRunAt: finalNextRun?.toISOString() ?? null
    });
  }

  return {
    total: dueSchedules.length,
    success: successCount,
    failed: failureCount,
    details
  };
}

async function processSchedules() {
  const now = new Date();
  const budget = await processBudgetSchedules(now);
  const status = await processStatusSchedules(now);

  return {
    totals: {
      total: budget.total + status.total,
      success: budget.success + status.success,
      failed: budget.failed + status.failed
    },
    budget,
    status
  };
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await processSchedules();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      result
    });
  } catch (error) {
    console.error('[Meta Budget Schedule Cron] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
