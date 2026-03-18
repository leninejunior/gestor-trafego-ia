import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { UserAccessControlService } from '@/lib/services/user-access-control'

export const dynamic = 'force-dynamic'

/**
 * GET /api/super-admin/plan-usage
 * Retorna uso de planos por organização (apenas para super admins)
 * Requirements: 4.1, 4.2, 4.3, 4.5, 7.1
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

    // Buscar organizações com seus planos e uso atual
    const { data: organizations, error: orgsError } = await supabase
      .from('organizations')
      .select(`
        id,
        name,
        is_active,
        subscriptions (
          id,
          status,
          current_period_end,
          subscription_plans (
            id,
            name,
            max_users,
            max_clients,
            max_connections,
            max_campaigns
          )
        )
      `)
      .eq('is_active', true)
      .order('name')

    if (orgsError) {
      console.error('Erro ao buscar organizações:', orgsError)
      return NextResponse.json(
        { error: 'Erro interno do servidor' },
        { status: 500 }
      )
    }

    // Para cada organização, calcular uso atual
    const usages = await Promise.all(
      (organizations || []).map(async (org) => {
        // Encontrar assinatura ativa
        const activeSubscription = org.subscriptions?.find(sub => 
          sub.status === 'active' && 
          new Date(sub.current_period_end) > new Date()
        )

        const plan = activeSubscription?.subscription_plans?.[0]
        
        // Usar o serviço de controle de acesso para obter limites e uso atual
        const limits = await accessControl.getOrganizationLimits(org.id)

        return {
          organizationId: org.id,
          organizationName: org.name,
          maxUsers: plan?.max_users || limits.maxUsers,
          currentUsers: limits.currentUsage.users,
          maxClients: plan?.max_clients || limits.maxClients,
          currentClients: limits.currentUsage.clients,
          maxConnections: plan?.max_connections || limits.maxConnections,
          currentConnections: limits.currentUsage.connections,
          maxCampaigns: plan?.max_campaigns || limits.maxCampaigns,
          currentCampaigns: limits.currentUsage.campaigns,
          subscriptionStatus: activeSubscription?.status || 'inactive',
          planName: plan?.name || 'Sem plano',
          isOverLimit: {
            users: plan?.max_users ? limits.currentUsage.users > plan.max_users : false,
            clients: plan?.max_clients ? limits.currentUsage.clients > plan.max_clients : false,
            connections: plan?.max_connections ? limits.currentUsage.connections > plan.max_connections : false,
            campaigns: plan?.max_campaigns ? limits.currentUsage.campaigns > plan.max_campaigns : false
          }
        }
      })
    )

    // Ordenar por organizações que estão próximas ou acima do limite
    const sortedUsages = usages.sort((a, b) => {
      // Calcular "pressão" do limite (percentual de uso)
      const getPressure = (usage: typeof a) => {
        let totalPressure = 0
        let limitCount = 0

        if (usage.maxUsers !== null) {
          totalPressure += (usage.currentUsers / usage.maxUsers) * 100
          limitCount++
        }
        if (usage.maxClients !== null) {
          totalPressure += (usage.currentClients / usage.maxClients) * 100
          limitCount++
        }
        if (usage.maxConnections !== null) {
          totalPressure += (usage.currentConnections / usage.maxConnections) * 100
          limitCount++
        }
        if (usage.maxCampaigns !== null) {
          totalPressure += (usage.currentCampaigns / usage.maxCampaigns) * 100
          limitCount++
        }

        return limitCount > 0 ? totalPressure / limitCount : 0
      }

      return getPressure(b) - getPressure(a) // Maior pressão primeiro
    })

    return NextResponse.json({
      usages: sortedUsages,
      total: sortedUsages.length,
      summary: {
        totalOrganizations: sortedUsages.length,
        organizationsOverLimit: sortedUsages.filter(u => 
          Object.values(u.isOverLimit).some(Boolean)
        ).length,
        organizationsNearLimit: sortedUsages.filter(u => {
          const checkNearLimit = (current: number, max: number | null) => {
            if (max === null) return false
            return (current / max) >= 0.8 && (current / max) < 1.0
          }
          return checkNearLimit(u.currentUsers, u.maxUsers) ||
                 checkNearLimit(u.currentClients, u.maxClients) ||
                 checkNearLimit(u.currentConnections, u.maxConnections) ||
                 checkNearLimit(u.currentCampaigns, u.maxCampaigns)
        }).length
      }
    })

  } catch (error) {
    console.error('Erro na API de uso de planos:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}