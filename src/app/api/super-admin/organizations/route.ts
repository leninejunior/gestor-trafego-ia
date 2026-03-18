import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { UserAccessControlService } from '@/lib/services/user-access-control'

export const dynamic = 'force-dynamic'

/**
 * GET /api/super-admin/organizations
 * Lista todas as organizações do sistema (apenas para super admins)
 * Requirements: 7.1, 7.2
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    // Verificar se é super admin
    const accessControl = new UserAccessControlService()
    const isSuperAdmin = await accessControl.isSuperAdmin(user.id)
    
    if (!isSuperAdmin) {
      return NextResponse.json(
        { error: 'Acesso negado: apenas super admins podem acessar esta funcionalidade' },
        { status: 403 }
      )
    }

    // Buscar todas as organizações com estatísticas
    const { data: organizations, error: orgsError } = await supabase
      .from('organizations')
      .select(`
        id,
        name,
        is_active,
        created_at,
        memberships (
          id,
          user_id,
          role
        ),
        clients (
          id,
          is_active
        ),
        subscriptions (
          id,
          status,
          current_period_end,
          subscription_plans (
            name,
            price_monthly
          )
        )
      `)
      .order('created_at', { ascending: false })

    if (orgsError) {
      console.error('Erro ao buscar organizações:', orgsError)
      return NextResponse.json(
        { error: 'Erro interno do servidor' },
        { status: 500 }
      )
    }

    // Processar dados das organizações
    const processedOrganizations = organizations?.map(org => {
      const activeSubscription = org.subscriptions?.find(sub => 
        sub.status === 'active' && 
        new Date(sub.current_period_end) > new Date()
      )

      return {
        id: org.id,
        name: org.name,
        isActive: org.is_active,
        createdAt: new Date(org.created_at),
        memberCount: org.memberships?.length || 0,
        clientCount: org.clients?.filter(c => c.is_active).length || 0,
        subscriptionStatus: activeSubscription?.status || 'inactive',
        planName: activeSubscription?.subscription_plans?.[0]?.name || 'Sem plano',
        monthlyRevenue: activeSubscription?.subscription_plans?.[0]?.price_monthly || 0
      }
    }) || []

    return NextResponse.json({
      organizations: processedOrganizations,
      total: processedOrganizations.length
    })

  } catch (error) {
    console.error('Erro na API de organizações:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}