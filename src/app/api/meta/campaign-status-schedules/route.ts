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

type CreateStatusScheduleBody = {
  campaignId?: string;
  clientId?: string;
  adAccountId?: string;
  targetStatus?: string;
  scheduledDate?: string;
  hour?: number;
  minute?: number;
  timeZone?: string;
  recurrenceType?: string;
  recurrenceInterval?: number;
};

function parseIntegerInRange(value: unknown, min: number, max: number): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return null;
  }
  return parsed;
}

function normalizeTargetStatus(value: unknown): 'ACTIVE' | 'PAUSED' | null {
  if (value === 'ACTIVE' || value === 'PAUSED') {
    return value;
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const campaignId = searchParams.get('campaignId');

    if (!clientId || !campaignId) {
      return NextResponse.json(
        { error: 'clientId e campaignId sao obrigatorios' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    }

    const accessControl = new UserAccessControlService();
    const hasAccess = await accessControl.hasClientAccess(user.id, clientId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Sem permissao para este cliente' }, { status: 403 });
    }

    const serviceSupabase = createServiceClient();
    const { data, error } = await serviceSupabase
      .from('meta_campaign_status_schedules')
      .select('*')
      .eq('client_id', clientId)
      .eq('campaign_id', campaignId)
      .order('next_run_at', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[Campaign Status Schedules][GET] Supabase error:', error);
      return NextResponse.json({ error: 'Falha ao carregar agendamentos' }, { status: 500 });
    }

    return NextResponse.json({ schedules: data ?? [] });
  } catch (error) {
    console.error('[Campaign Status Schedules][GET] Error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    }

    const body = (await request.json()) as CreateStatusScheduleBody;
    const campaignId = body.campaignId?.trim();
    const clientId = body.clientId?.trim();
    const adAccountId = body.adAccountId?.trim();
    const targetStatus = normalizeTargetStatus(body.targetStatus);
    const parsedDate = parseScheduleDate(body.scheduledDate);
    const hour = parseIntegerInRange(body.hour, 0, 23);
    const minute = parseIntegerInRange(body.minute ?? 0, 0, 59);
    const timeZone = (body.timeZone?.trim() || 'America/Sao_Paulo');
    const recurrenceType = normalizeRecurrenceType(body.recurrenceType);
    const recurrenceInterval = normalizeRecurrenceInterval(body.recurrenceInterval);

    if (!campaignId || !clientId || !adAccountId) {
      return NextResponse.json(
        { error: 'campaignId, clientId e adAccountId sao obrigatorios' },
        { status: 400 }
      );
    }

    if (!targetStatus) {
      return NextResponse.json({ error: 'targetStatus deve ser ACTIVE ou PAUSED' }, { status: 400 });
    }

    if (!parsedDate) {
      return NextResponse.json(
        { error: 'Data invalida. Use o formato DD/MM/AAAA' },
        { status: 400 }
      );
    }

    if (hour === null || minute === null) {
      return NextResponse.json({ error: 'Horario invalido' }, { status: 400 });
    }

    if (!isValidTimeZone(timeZone)) {
      return NextResponse.json({ error: 'Timezone invalida' }, { status: 400 });
    }

    const accessControl = new UserAccessControlService();
    const hasAccess = await accessControl.hasClientAccess(user.id, clientId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Sem permissao para este cliente' }, { status: 403 });
    }

    const scheduledDateIso = formatDatePartsToIso(parsedDate);
    const nextRunAt = computeNextScheduledRun({
      scheduledDate: scheduledDateIso,
      hour,
      minute,
      recurrenceType,
      recurrenceInterval,
      timeZone,
      fromDate: new Date()
    });

    if (!nextRunAt) {
      return NextResponse.json(
        { error: 'A data/hora informada ja passou. Informe um horario futuro ou ative recorrencia.' },
        { status: 400 }
      );
    }

    const serviceSupabase = createServiceClient();
    const { data, error } = await serviceSupabase
      .from('meta_campaign_status_schedules')
      .insert({
        campaign_id: campaignId,
        client_id: clientId,
        ad_account_id: adAccountId,
        target_status: targetStatus,
        scheduled_date: scheduledDateIso,
        hour,
        minute,
        timezone: timeZone,
        recurrence_type: recurrenceType,
        recurrence_interval: recurrenceInterval,
        next_run_at: nextRunAt.toISOString(),
        is_active: true,
        created_by: user.id
      })
      .select('*')
      .single();

    if (error) {
      console.error('[Campaign Status Schedules][POST] Supabase error:', error);

      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Ja existe um agendamento igual para este status na campanha' },
          { status: 409 }
        );
      }

      return NextResponse.json({ error: 'Falha ao criar agendamento' }, { status: 500 });
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Agendamento criado com sucesso',
        schedule: data
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[Campaign Status Schedules][POST] Error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
