import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { checkAdminAuth, createAdminAuthErrorResponse } from '@/lib/middleware/admin-auth-improved';

/**
 * GET /api/admin/subscription-management/organizations
 * Busca organizações com suas assinaturas para o gerenciamento manual
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação de admin
    const authResult = await checkAdminAuth();
    if (!authResult.success) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔧 Development mode: Continuing despite auth failure for testing');
      } else {
        return createAdminAuthErrorResponse(authResult);
      }
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    const supabase = createServiceClient();

    // Buscar organizações
    let orgQuery = supabase
      .from('organizations')
      .select('id, name, created_at')
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1);

    if (search) {
      orgQuery = orgQuery.ilike('name', `%${search}%`);
    }

    const { data: organizations, error: orgError } = await orgQuery;

    if (orgError) {
      throw orgError;
    }

    if (!organizations || organizations.length === 0) {
      return NextResponse.json({
        success: true,
        organizations: [],
        total: 0
      });
    }

    // Para cada organização, buscar sua assinatura separadamente
    const organizationsWithSubscriptions = await Promise.all(
      organizations.map(async (org) => {
        // Buscar assinatura ativa da organização
        const { data: subscription, error: subError } = await supabase
          .from('subscriptions')
          .select(`
            id,
            status,
            billing_cycle,
            current_period_start,
            current_period_end,
            plan_id,
            subscription_plans!inner (
              id,
              name,
              monthly_price,
              annual_price
            )
          `)
          .eq('organization_id', org.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        // Se não encontrou assinatura ativa, buscar a mais recente
        let finalSubscription = subscription;
        if (subError || !subscription) {
          const { data: latestSub } = await supabase
            .from('subscriptions')
            .select(`
              id,
              status,
              billing_cycle,
              current_period_start,
              current_period_end,
              plan_id,
              subscription_plans!inner (
                id,
                name,
                monthly_price,
                annual_price
              )
            `)
            .eq('organization_id', org.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          finalSubscription = latestSub;
        }

        return {
          ...org,
          is_active: true, // Assumir que todas as organizações são ativas
          subscription: finalSubscription || null
        };
      })
    );

    // Contar total de organizações (para paginação)
    let countQuery = supabase
      .from('organizations')
      .select('*', { count: 'exact', head: true });

    if (search) {
      countQuery = countQuery.ilike('name', `%${search}%`);
    }

    const { count: totalCount } = await countQuery;

    return NextResponse.json({
      success: true,
      organizations: organizationsWithSubscriptions,
      pagination: {
        limit,
        offset,
        total: totalCount || 0,
        hasMore: (organizationsWithSubscriptions.length === limit)
      }
    });

  } catch (error) {
    console.error('Erro ao buscar organizações para gerenciamento:', error);
    return NextResponse.json(
      { success: false, error: 'Falha ao buscar organizações' },
      { status: 500 }
    );
  }
}