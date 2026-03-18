import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { UserAccessControlService, UserType } from '@/lib/services/user-access-control'

export const dynamic = 'force-dynamic'

/**
 * GET /api/super-admin/stats
 * Retorna estatísticas gerais do sistema (apenas para super admins)
 * Requirements: 7.1, 7.2, 7.3, 7.4
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

    // Buscar estatísticas do sistema
    const [
      { data: organizations },
      { data: superAdmins },
      { data: memberships },
      { data: activeSubscriptions },
      { data: allSubscriptions },
      { data: clients },
      { data: metaConnections },
      { data: googleConnections }
    ] = await Promise.all([
      // Total de organizações
      supabase
        .from('organizations')
        .select('id, is_active')
        .eq('is_active', true),
      
      // Total de super admins
      supabase
        .from('super_admins')
        .select('id')
        .eq('is_active', true),
      
      // Total de memberships (para contar usuários por tipo)
      supabase
        .from('memberships')
        .select('user_id, role'),
      
      // Assinaturas ativas
      supabase
        .from('subscriptions')
        .select(`
          id,
          status,
          current_period_end,
          subscription_plans (
            price_monthly
          )
        `)
        .eq('status', 'active'),
      
      // Todas as assinaturas
      supabase
        .from('subscriptions')
        .select('id, status'),
      
      // Total de clientes
      supabase
        .from('clients')
        .select('id')
        .eq('is_active', true),
      
      // Conexões Meta
      supabase
        .from('client_meta_connections')
        .select('id')
        .eq('is_active', true),
      
      // Conexões Google
      supabase
        .from('google_ads_connections')
        .select('id')
        .eq('is_active', true)
    ])

    // Calcular estatísticas de usuários por tipo
    const totalUsers = new Set(memberships?.map(m => m.user_id) || []).size
    const totalSuperAdmins = superAdmins?.length || 0
    const totalOrgAdmins = memberships?.filter(m => m.role === 'admin').length || 0
    const totalCommonUsers = totalUsers - totalOrgAdmins // Usuários que não são admins de org

    // Filtrar assinaturas ativas não expiradas
    const validActiveSubscriptions = activeSubscriptions?.filter(sub => 
      new Date(sub.current_period_end) > new Date()
    ) || []

    // Calcular receita mensal
    const monthlyRevenue = validActiveSubscriptions.reduce((sum, sub) => 
      sum + (sub.subscription_plans?.[0]?.price_monthly || 0), 0
    )

    const stats = {
      totalOrganizations: organizations?.length || 0,
      totalUsers,
      totalSuperAdmins,
      totalOrgAdmins,
      totalCommonUsers,
      totalActiveSubscriptions: validActiveSubscriptions.length,
      monthlyRevenue,
      totalClients: clients?.length || 0,
      totalConnections: (metaConnections?.length || 0) + (googleConnections?.length || 0),
      totalSubscriptions: allSubscriptions?.length || 0,
      churnRate: allSubscriptions?.length > 0 ? 
        ((allSubscriptions.filter(s => s.status === 'cancelled').length / allSubscriptions.length) * 100) : 0
    }

    return NextResponse.json({
      stats,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Erro na API de estatísticas:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}