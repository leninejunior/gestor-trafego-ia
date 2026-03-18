import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const createObjectiveSchema = z.object({
  metric_name: z.string().min(1, 'Nome da métrica é obrigatório'),
  metric_type: z.enum(['standard', 'custom']),
  custom_metric_id: z.string().uuid().optional(),
  min_value: z.number().optional(),
  max_value: z.number().optional(),
  target_value: z.number().optional(),
  campaign_objective: z.string().optional(),
  is_active: z.boolean().default(true),
});

const updateObjectiveSchema = createObjectiveSchema.partial();

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const metricType = searchParams.get('metric_type');
    const active = searchParams.get('active');
    const campaignObjective = searchParams.get('campaign_objective');

    let query = supabase
      .from('metric_objectives')
      .select(`
        *,
        custom_metrics(id, name, display_symbol, is_percentage)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (metricType) {
      query = query.eq('metric_type', metricType);
    }

    if (active !== null) {
      query = query.eq('is_active', active === 'true');
    }

    if (campaignObjective) {
      query = query.eq('campaign_objective', campaignObjective);
    }

    const { data: objectives, error } = await query;

    if (error) {
      console.error('Erro ao buscar objetivos:', error);
      return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }

    return NextResponse.json({ objectives });
  } catch (error) {
    console.error('Erro na API de objetivos:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createObjectiveSchema.parse(body);

    // Validar se a métrica personalizada existe (se aplicável)
    if (validatedData.metric_type === 'custom' && validatedData.custom_metric_id) {
      const { data: customMetric, error: metricError } = await supabase
        .from('custom_metrics')
        .select('id')
        .eq('id', validatedData.custom_metric_id)
        .eq('user_id', user.id)
        .single();

      if (metricError || !customMetric) {
        return NextResponse.json(
          { error: 'Métrica personalizada não encontrada' },
          { status: 400 }
        );
      }
    }

    // Verificar se já existe um objetivo para esta métrica e objetivo de campanha
    const { data: existingObjective } = await supabase
      .from('metric_objectives')
      .select('id')
      .eq('user_id', user.id)
      .eq('metric_name', validatedData.metric_name)
      .eq('metric_type', validatedData.metric_type)
      .eq('campaign_objective', validatedData.campaign_objective || '')
      .single();

    if (existingObjective) {
      return NextResponse.json(
        { error: 'Já existe um objetivo para esta métrica e objetivo de campanha' },
        { status: 400 }
      );
    }

    // Buscar organização do usuário
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    const { data: objective, error } = await supabase
      .from('metric_objectives')
      .insert({
        ...validatedData,
        user_id: user.id,
        organization_id: membership?.organization_id || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar objetivo:', error);
      return NextResponse.json({ error: 'Erro ao criar objetivo' }, { status: 500 });
    }

    return NextResponse.json({ objective }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Erro na API de criação de objetivo:', error);
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
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID do objetivo é obrigatório' }, { status: 400 });
    }

    const validatedData = updateObjectiveSchema.parse(updateData);

    // Verificar se o objetivo pertence ao usuário
    const { data: existingObjective, error: fetchError } = await supabase
      .from('metric_objectives')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !existingObjective) {
      return NextResponse.json({ error: 'Objetivo não encontrado' }, { status: 404 });
    }

    const { data: objective, error } = await supabase
      .from('metric_objectives')
      .update({
        ...validatedData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar objetivo:', error);
      return NextResponse.json({ error: 'Erro ao atualizar objetivo' }, { status: 500 });
    }

    return NextResponse.json({ objective });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Erro na API de atualização de objetivo:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID do objetivo é obrigatório' }, { status: 400 });
    }

    // Verificar se o objetivo pertence ao usuário
    const { data: existingObjective, error: fetchError } = await supabase
      .from('metric_objectives')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !existingObjective) {
      return NextResponse.json({ error: 'Objetivo não encontrado' }, { status: 404 });
    }

    // Soft delete - marcar como inativo
    const { error } = await supabase
      .from('metric_objectives')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Erro ao deletar objetivo:', error);
      return NextResponse.json({ error: 'Erro ao deletar objetivo' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Objetivo deletado com sucesso' });
  } catch (error) {
    console.error('Erro na API de deleção de objetivo:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
