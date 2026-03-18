import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const createViewSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  description: z.string().optional(),
  view_config: z.object({
    columns: z.array(z.object({
      key: z.string(),
      label: z.string(),
      type: z.enum(['metric', 'dimension', 'custom_metric']),
      visible: z.boolean(),
      width: z.number().optional(),
      format: z.string().optional(),
      custom_metric_id: z.string().optional(),
    })),
    filters: z.array(z.object({
      key: z.string(),
      operator: z.enum(['equals', 'not_equals', 'greater_than', 'less_than', 'contains', 'between']),
      value: z.any(),
      values: z.array(z.any()).optional(),
    })).optional(),
    sorting: z.array(z.object({
      key: z.string(),
      direction: z.enum(['asc', 'desc']),
    })).optional(),
    grouping: z.array(z.string()).optional(),
    chart_type: z.enum(['table', 'line', 'bar', 'pie']).optional(),
  }),
  is_default: z.boolean().default(false),
  is_shared: z.boolean().default(false),
});

const updateViewSchema = createViewSchema.partial();

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const shared = searchParams.get('shared');
    const defaultOnly = searchParams.get('default');

    let query = supabase
      .from('custom_dashboard_views')
      .select('*')
      .or(`user_id.eq.${user.id},is_shared.eq.true`)
      .order('created_at', { ascending: false });

    if (shared === 'true') {
      query = query.eq('is_shared', true);
    }

    if (defaultOnly === 'true') {
      query = query.eq('is_default', true);
    }

    const { data: views, error } = await query;

    if (error) {
      console.error('Erro ao buscar visualizações:', error);
      return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }

    return NextResponse.json({ views });
  } catch (error) {
    console.error('Erro na API de visualizações:', error);
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
    const validatedData = createViewSchema.parse(body);

    // Se está definindo como padrão, remover padrão das outras visualizações
    if (validatedData.is_default) {
      await supabase
        .from('custom_dashboard_views')
        .update({ is_default: false })
        .eq('user_id', user.id);
    }

    // Verificar se já existe uma visualização com o mesmo nome
    const { data: existingView } = await supabase
      .from('custom_dashboard_views')
      .select('id')
      .eq('user_id', user.id)
      .eq('name', validatedData.name)
      .single();

    if (existingView) {
      return NextResponse.json(
        { error: 'Já existe uma visualização com este nome' },
        { status: 400 }
      );
    }

    // Buscar organização do usuário
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    const { data: view, error } = await supabase
      .from('custom_dashboard_views')
      .insert({
        ...validatedData,
        user_id: user.id,
        organization_id: membership?.organization_id || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar visualização:', error);
      return NextResponse.json({ error: 'Erro ao criar visualização' }, { status: 500 });
    }

    return NextResponse.json({ view }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Erro na API de criação de visualização:', error);
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
      return NextResponse.json({ error: 'ID da visualização é obrigatório' }, { status: 400 });
    }

    const validatedData = updateViewSchema.parse(updateData);

    // Verificar se a visualização pertence ao usuário
    const { data: existingView, error: fetchError } = await supabase
      .from('custom_dashboard_views')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !existingView) {
      return NextResponse.json({ error: 'Visualização não encontrada' }, { status: 404 });
    }

    // Se está definindo como padrão, remover padrão das outras visualizações
    if (validatedData.is_default) {
      await supabase
        .from('custom_dashboard_views')
        .update({ is_default: false })
        .eq('user_id', user.id)
        .neq('id', id);
    }

    const { data: view, error } = await supabase
      .from('custom_dashboard_views')
      .update({
        ...validatedData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar visualização:', error);
      return NextResponse.json({ error: 'Erro ao atualizar visualização' }, { status: 500 });
    }

    return NextResponse.json({ view });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Erro na API de atualização de visualização:', error);
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
      return NextResponse.json({ error: 'ID da visualização é obrigatório' }, { status: 400 });
    }

    // Verificar se a visualização pertence ao usuário
    const { data: existingView, error: fetchError } = await supabase
      .from('custom_dashboard_views')
      .select('id, is_default')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !existingView) {
      return NextResponse.json({ error: 'Visualização não encontrada' }, { status: 404 });
    }

    // Não permitir deletar a visualização padrão se for a única
    if (existingView.is_default) {
      const { data: otherViews } = await supabase
        .from('custom_dashboard_views')
        .select('id')
        .eq('user_id', user.id)
        .neq('id', id);

      if (otherViews && otherViews.length > 0) {
        // Definir outra visualização como padrão
        await supabase
          .from('custom_dashboard_views')
          .update({ is_default: true })
          .eq('id', otherViews[0].id);
      }
    }

    const { error } = await supabase
      .from('custom_dashboard_views')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Erro ao deletar visualização:', error);
      return NextResponse.json({ error: 'Erro ao deletar visualização' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Visualização deletada com sucesso' });
  } catch (error) {
    console.error('Erro na API de deleção de visualização:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}


