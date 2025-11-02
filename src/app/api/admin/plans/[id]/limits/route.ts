import { NextRequest, NextResponse } from 'next/server';
import { planConfigurationService } from '@/lib/services/plan-configuration-service';
import { UpdatePlanLimitsSchema } from '@/lib/types/plan-limits';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/admin/plans/:id/limits
 * Obtém os limites de um plano específico
 * Requisitos 1.1, 11.1, 11.2
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    // Verificar se é admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem acessar esta rota.' },
        { status: 403 }
      );
    }

    const planId = params.id;

    // Buscar limites do plano
    const limits = await planConfigurationService.getPlanLimits(planId);

    if (!limits) {
      return NextResponse.json(
        { error: 'Limites não encontrados para este plano' },
        { status: 404 }
      );
    }

    return NextResponse.json(limits);
  } catch (error) {
    console.error('Erro ao buscar limites do plano:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar limites do plano' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/plans/:id/limits
 * Cria limites para um plano
 * Requisitos 1.1, 11.1, 11.2
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    // Verificar se é admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem acessar esta rota.' },
        { status: 403 }
      );
    }

    const planId = params.id;
    const body = await request.json();

    // Verificar se o plano existe
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('id')
      .eq('id', planId)
      .single();

    if (planError || !plan) {
      return NextResponse.json(
        { error: 'Plano não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se já existem limites para este plano
    const existingLimits = await planConfigurationService.getPlanLimits(planId);
    if (existingLimits) {
      return NextResponse.json(
        { error: 'Limites já existem para este plano. Use PUT para atualizar.' },
        { status: 409 }
      );
    }

    // Criar limites
    const limits = await planConfigurationService.createPlanLimits(planId, body);

    return NextResponse.json(limits, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar limites do plano:', error);
    
    if (error instanceof Error && error.message.includes('Validação falhou')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Erro ao criar limites do plano' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/plans/:id/limits
 * Atualiza os limites de um plano
 * Requisitos 1.2, 11.1, 11.2
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    // Verificar se é admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem acessar esta rota.' },
        { status: 403 }
      );
    }

    const planId = params.id;
    const body = await request.json();

    // Validar dados de entrada
    const parseResult = UpdatePlanLimitsSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { 
          error: 'Dados inválidos',
          details: parseResult.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        },
        { status: 400 }
      );
    }

    // Verificar se o plano existe
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('id')
      .eq('id', planId)
      .single();

    if (planError || !plan) {
      return NextResponse.json(
        { error: 'Plano não encontrado' },
        { status: 404 }
      );
    }

    // Atualizar limites (cria se não existir)
    const limits = await planConfigurationService.updatePlanLimits(planId, parseResult.data);

    return NextResponse.json(limits);
  } catch (error) {
    console.error('Erro ao atualizar limites do plano:', error);
    
    if (error instanceof Error && error.message.includes('Validação falhou')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Erro ao atualizar limites do plano' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/plans/:id/limits
 * Remove os limites de um plano (volta para valores padrão)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    // Verificar se é admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem acessar esta rota.' },
        { status: 403 }
      );
    }

    const planId = params.id;

    // Deletar limites
    const { error } = await supabase
      .from('plan_limits')
      .delete()
      .eq('plan_id', planId);

    if (error) {
      throw new Error(`Erro ao deletar limites: ${error.message}`);
    }

    return NextResponse.json({ message: 'Limites removidos com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar limites do plano:', error);
    return NextResponse.json(
      { error: 'Erro ao deletar limites do plano' },
      { status: 500 }
    );
  }
}
