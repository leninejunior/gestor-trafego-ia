import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const updateAlertSchema = z.object({
  id: z.string().uuid(),
  is_read: z.boolean().optional(),
  is_resolved: z.boolean().optional(),
  resolved_at: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const severity = searchParams.get('severity');
    const status = searchParams.get('status');
    const campaignId = searchParams.get('campaign_id');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('performance_alerts')
      .select(`
        *,
        metric_objectives!inner(
          id,
          metric_name,
          metric_type,
          campaign_objective,
          custom_metrics(id, name, display_symbol)
        )
      `)
      .eq('user_id', user.id)
      .order('triggered_at', { ascending: false })
      .limit(limit);

    if (severity && severity !== 'all') {
      query = query.eq('severity', severity);
    }

    if (status) {
      switch (status) {
        case 'unread':
          query = query.eq('is_read', false);
          break;
        case 'unresolved':
          query = query.eq('is_resolved', false);
          break;
        case 'resolved':
          query = query.eq('is_resolved', true);
          break;
      }
    }

    if (campaignId) {
      query = query.eq('campaign_id', campaignId);
    }

    const { data: alerts, error } = await query;

    if (error) {
      console.error('Erro ao buscar alertas:', error);
      return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }

    return NextResponse.json({ alerts });
  } catch (error) {
    console.error('Erro na API de alertas:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...updateData } = updateAlertSchema.parse(body);

    // Verificar se o alerta pertence ao usuário
    const { data: existingAlert, error: fetchError } = await supabase
      .from('performance_alerts')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !existingAlert) {
      return NextResponse.json({ error: 'Alerta não encontrado' }, { status: 404 });
    }

    const { data: alert, error } = await supabase
      .from('performance_alerts')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar alerta:', error);
      return NextResponse.json({ error: 'Erro ao atualizar alerta' }, { status: 500 });
    }

    return NextResponse.json({ alert });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Erro na API de atualização de alerta:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// Função para criar alertas automáticos (chamada internamente)
export async function createAlert(
  userId: string,
  organizationId: string | null,
  metricObjectiveId: string,
  campaignId: string | null,
  alertType: 'above_max' | 'below_min' | 'target_reached',
  currentValue: number,
  thresholdValue: number,
  message: string
) {
  const supabase = await createClient();

  // Determinar severidade baseada no desvio
  const deviation = Math.abs(currentValue - thresholdValue) / thresholdValue;
  let severity: 'low' | 'medium' | 'high' | 'critical';

  if (deviation > 0.5) {
    severity = 'critical';
  } else if (deviation > 0.3) {
    severity = 'high';
  } else if (deviation > 0.1) {
    severity = 'medium';
  } else {
    severity = 'low';
  }

  const { data: alert, error } = await supabase
    .from('performance_alerts')
    .insert({
      user_id: userId,
      organization_id: organizationId,
      metric_objective_id: metricObjectiveId,
      campaign_id: campaignId,
      alert_type: alertType,
      current_value: currentValue,
      threshold_value: thresholdValue,
      severity,
      message,
      is_read: false,
      is_resolved: false,
    })
    .select()
    .single();

  if (error) {
    console.error('Erro ao criar alerta automático:', error);
    return null;
  }

  return alert;
}

// Função para verificar métricas e criar alertas
export async function checkMetricsAndCreateAlerts(
  userId: string,
  campaignData: Record<string, any>
) {
  const supabase = await createClient();

  try {
    // Buscar objetivos ativos do usuário
    const { data: objectives, error: objectivesError } = await supabase
      .from('metric_objectives')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (objectivesError || !objectives) {
      console.error('Erro ao buscar objetivos:', objectivesError);
      return;
    }

    // Buscar organização do usuário
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .single();

    const organizationId = membership?.organization_id || null;

    for (const objective of objectives) {
      const metricValue = campaignData[objective.metric_name];
      
      if (metricValue === undefined || metricValue === null) {
        continue;
      }

      let alertCreated = false;

      // Verificar se está abaixo do mínimo
      if (objective.min_value !== null && metricValue < objective.min_value) {
        await createAlert(
          userId,
          organizationId,
          objective.id,
          campaignData.campaign_id || null,
          'below_min',
          metricValue,
          objective.min_value,
          `${objective.metric_name} está abaixo do valor mínimo (${metricValue} < ${objective.min_value})`
        );
        alertCreated = true;
      }

      // Verificar se está acima do máximo
      if (objective.max_value !== null && metricValue > objective.max_value) {
        await createAlert(
          userId,
          organizationId,
          objective.id,
          campaignData.campaign_id || null,
          'above_max',
          metricValue,
          objective.max_value,
          `${objective.metric_name} está acima do valor máximo (${metricValue} > ${objective.max_value})`
        );
        alertCreated = true;
      }

      // Verificar se atingiu a meta (apenas se não criou outros alertas)
      if (!alertCreated && objective.target_value !== null) {
        const targetTolerance = objective.target_value * 0.05; // 5% de tolerância
        if (Math.abs(metricValue - objective.target_value) <= targetTolerance) {
          await createAlert(
            userId,
            organizationId,
            objective.id,
            campaignData.campaign_id || null,
            'target_reached',
            metricValue,
            objective.target_value,
            `${objective.metric_name} atingiu a meta definida (${metricValue} ≈ ${objective.target_value})`
          );
        }
      }
    }
  } catch (error) {
    console.error('Erro ao verificar métricas e criar alertas:', error);
  }
}