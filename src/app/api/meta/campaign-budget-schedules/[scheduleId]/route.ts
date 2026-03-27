import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { UserAccessControlService } from '@/lib/services/user-access-control';
import {
  computeNextScheduledRun,
  formatDatePartsToIso,
  isValidTimeZone,
  normalizeRecurrenceInterval,
  normalizeRecurrenceType,
  parseScheduleDate
} from '@/lib/meta/campaign-budget-scheduler';

type UpdateBody = {
  isActive?: boolean;
  dailyBudget?: number | string;
  scheduledDate?: string;
  hour?: number;
  minute?: number;
  timeZone?: string;
  recurrenceType?: string;
  recurrenceInterval?: number;
};

function parsePositiveBudget(value: number | string | undefined): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function parseIntegerInRange(value: unknown, min: number, max: number): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return null;
  }
  return parsed;
}

async function getAuthorizedContext(scheduleId: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { error: NextResponse.json({ error: 'Nao autorizado' }, { status: 401 }) };
  }

  const serviceSupabase = createServiceClient();
  const { data: schedule, error: scheduleError } = await serviceSupabase
    .from('meta_campaign_budget_schedules')
    .select('*')
    .eq('id', scheduleId)
    .single();

  if (scheduleError || !schedule) {
    return { error: NextResponse.json({ error: 'Agendamento nao encontrado' }, { status: 404 }) };
  }

  const accessControl = new UserAccessControlService();
  const hasAccess = await accessControl.hasClientAccess(user.id, schedule.client_id);
  if (!hasAccess) {
    return { error: NextResponse.json({ error: 'Sem permissao para este cliente' }, { status: 403 }) };
  }

  return {
    schedule,
    serviceSupabase
  };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ scheduleId: string }> }
) {
  try {
    const { scheduleId } = await params;
    if (!scheduleId) {
      return NextResponse.json({ error: 'scheduleId e obrigatorio' }, { status: 400 });
    }

    const context = await getAuthorizedContext(scheduleId);
    if ('error' in context) {
      return context.error;
    }

    const body = (await request.json()) as UpdateBody;
    const updates: Record<string, unknown> = {};

    const parsedDailyBudget = body.dailyBudget !== undefined
      ? parsePositiveBudget(body.dailyBudget)
      : null;

    if (body.dailyBudget !== undefined) {
      if (parsedDailyBudget === null) {
        return NextResponse.json(
          { error: 'dailyBudget precisa ser maior que zero' },
          { status: 400 }
        );
      }
      updates.daily_budget = parsedDailyBudget;
    }

    if (body.isActive !== undefined) {
      if (typeof body.isActive !== 'boolean') {
        return NextResponse.json({ error: 'isActive invalido' }, { status: 400 });
      }
      updates.is_active = body.isActive;
    }

    const hour = body.hour !== undefined ? parseIntegerInRange(body.hour, 0, 23) : null;
    const minute = body.minute !== undefined ? parseIntegerInRange(body.minute, 0, 59) : null;
    const parsedDate = body.scheduledDate !== undefined ? parseScheduleDate(body.scheduledDate) : null;

    if (body.scheduledDate !== undefined && parsedDate === null) {
      return NextResponse.json({ error: 'Data invalida. Use o formato DD/MM/AAAA' }, { status: 400 });
    }
    if (body.hour !== undefined && hour === null) {
      return NextResponse.json({ error: 'hour invalido' }, { status: 400 });
    }
    if (body.minute !== undefined && minute === null) {
      return NextResponse.json({ error: 'minute invalido' }, { status: 400 });
    }

    if (parsedDate !== null) {
      const scheduledDateIso = formatDatePartsToIso(parsedDate);
      updates.scheduled_date = scheduledDateIso;
      updates.day_of_week = new Date(`${scheduledDateIso}T00:00:00`).getDay();
    }
    if (hour !== null) updates.hour = hour;
    if (minute !== null) updates.minute = minute;

    if (body.timeZone !== undefined) {
      const timeZone = body.timeZone.trim();
      if (!timeZone || !isValidTimeZone(timeZone)) {
        return NextResponse.json({ error: 'Timezone invalida' }, { status: 400 });
      }
      updates.timezone = timeZone;
    }

    if (body.recurrenceType !== undefined) {
      updates.recurrence_type = normalizeRecurrenceType(body.recurrenceType);
    }

    if (body.recurrenceInterval !== undefined) {
      updates.recurrence_interval = normalizeRecurrenceInterval(body.recurrenceInterval);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nenhuma alteracao valida enviada' }, { status: 400 });
    }

    const effectiveScheduledDate = String(
      updates.scheduled_date ??
      context.schedule.scheduled_date ??
      (
        context.schedule.next_run_at
          ? new Date(context.schedule.next_run_at).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10)
      )
    );
    const effectiveHour = Number(updates.hour ?? context.schedule.hour);
    const effectiveMinute = Number(updates.minute ?? context.schedule.minute);
    const effectiveTimeZone = String(updates.timezone ?? context.schedule.timezone);
    const effectiveRecurrenceType = normalizeRecurrenceType(
      updates.recurrence_type ?? context.schedule.recurrence_type
    );
    const effectiveRecurrenceInterval = normalizeRecurrenceInterval(
      updates.recurrence_interval ?? context.schedule.recurrence_interval
    );
    const effectiveIsActive = Boolean(updates.is_active ?? context.schedule.is_active);

    const shouldRecalculateNextRun =
      updates.scheduled_date !== undefined ||
      updates.hour !== undefined ||
      updates.minute !== undefined ||
      updates.timezone !== undefined ||
      updates.recurrence_type !== undefined ||
      updates.recurrence_interval !== undefined ||
      updates.is_active !== undefined;

    if (shouldRecalculateNextRun && effectiveIsActive) {
      const nextRunAt = computeNextScheduledRun({
        scheduledDate: effectiveScheduledDate,
        hour: effectiveHour,
        minute: effectiveMinute,
        recurrenceType: effectiveRecurrenceType,
        recurrenceInterval: effectiveRecurrenceInterval,
        timeZone: effectiveTimeZone,
        fromDate: new Date()
      });

      if (!nextRunAt) {
        return NextResponse.json(
          { error: 'A data/hora informada ja passou. Informe um horario futuro ou ative recorrencia.' },
          { status: 400 }
        );
      }

      updates.next_run_at = nextRunAt.toISOString();
    }

    if (updates.is_active === false) {
      updates.next_run_at = null;
    }

    if (updates.is_active === true && !updates.next_run_at) {
      const nextRunAt = computeNextScheduledRun({
        scheduledDate: effectiveScheduledDate,
        hour: effectiveHour,
        minute: effectiveMinute,
        recurrenceType: effectiveRecurrenceType,
        recurrenceInterval: effectiveRecurrenceInterval,
        timeZone: effectiveTimeZone,
        fromDate: new Date()
      });

      if (!nextRunAt) {
        return NextResponse.json(
          { error: 'A data/hora informada ja passou. Informe um horario futuro ou ative recorrencia.' },
          { status: 400 }
        );
      }

      updates.next_run_at = nextRunAt.toISOString();
    }

    const { data, error } = await context.serviceSupabase
      .from('meta_campaign_budget_schedules')
      .update(updates)
      .eq('id', scheduleId)
      .select('*')
      .single();

    if (error || !data) {
      console.error('[Campaign Budget Schedules][PATCH] Supabase error:', error);

      if (error?.code === '23505') {
        return NextResponse.json(
          { error: 'Ja existe um agendamento para este dia/horario nesta campanha' },
          { status: 409 }
        );
      }

      return NextResponse.json({ error: 'Falha ao atualizar agendamento' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Agendamento atualizado com sucesso',
      schedule: data
    });
  } catch (error) {
    console.error('[Campaign Budget Schedules][PATCH] Error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ scheduleId: string }> }
) {
  try {
    const { scheduleId } = await params;
    if (!scheduleId) {
      return NextResponse.json({ error: 'scheduleId e obrigatorio' }, { status: 400 });
    }

    const context = await getAuthorizedContext(scheduleId);
    if ('error' in context) {
      return context.error;
    }

    const { error } = await context.serviceSupabase
      .from('meta_campaign_budget_schedules')
      .delete()
      .eq('id', scheduleId);

    if (error) {
      console.error('[Campaign Budget Schedules][DELETE] Supabase error:', error);
      return NextResponse.json({ error: 'Falha ao remover agendamento' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Agendamento removido com sucesso'
    });
  } catch (error) {
    console.error('[Campaign Budget Schedules][DELETE] Error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
