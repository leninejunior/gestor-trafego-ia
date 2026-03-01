/**
 * API Pública v1 - Campanhas
 * Endpoints para acessar dados de campanhas via API
 * Requirements: 5.3, 5.4 - Controle de acesso a campanhas por cliente
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiAuthService } from '../auth/route'
import { createAccessControl } from '@/lib/middleware/user-access-middleware'
import { UserAccessControlService } from '@/lib/services/user-access-control'

/**
 * GET /api/v1/campaigns
 * Lista campanhas da organização
 * Requirements: 5.3, 5.4 - Filtrar campanhas por acesso do usuário
 */
const getCampaigns = createAccessControl.readCampaigns(false, 'Acesso negado para visualizar campanhas')

export async function GET(request: NextRequest) {
  return getCampaigns(async (request: NextRequest, context: any) => {
    const auth = await apiAuthService.authenticateApiRequest(request, 'campaigns:read')
    
    if (!auth.success) {
      return NextResponse.json(
        { error: auth.error },
        { status: 401 }
      )
    }

    const { searchParams } = request.nextUrl
    
    // Parâmetros de query
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')
    const status = searchParams.get('status')
    const accountId = searchParams.get('account_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    try {
      const supabase = await createClient()
      
      // Para usuários comuns, filtrar apenas campanhas de clientes autorizados
      let query = supabase
        .from('meta_campaigns')
        .select(`
          id,
          name,
          status,
          objective,
          created_time,
          updated_time,
          start_time,
          stop_time,
          daily_budget,
          lifetime_budget,
          account_id,
          connection_id,
          client_meta_connections!inner(
            client_id,
            account_name
          )
        `)
        .range(offset, offset + limit - 1)
        .order('created_time', { ascending: false })

      // Se não for super admin, filtrar por clientes acessíveis
      if (context.userType !== 'super_admin') {
        const accessControl = new UserAccessControlService()
        const accessibleClients = await accessControl.getUserAccessibleClients(context.user.id)
        const clientIds = accessibleClients.map(c => c.id)

        if (clientIds.length === 0) {
          return NextResponse.json({
            data: [],
            pagination: {
              limit,
              offset,
              total: 0,
              has_more: false
            }
          })
        }

        query = query.in('client_meta_connections.client_id', clientIds)
      }

      // Filtros opcionais
      if (status) {
        query = query.eq('status', status.toUpperCase())
      }
      
      if (accountId) {
        query = query.eq('account_id', accountId)
      }
      
      if (startDate) {
        query = query.gte('created_time', startDate)
      }
      
      if (endDate) {
        query = query.lte('created_time', endDate)
      }

      const { data: campaigns, error, count } = await query

      if (error) {
        console.error('Error fetching campaigns:', error)
        return NextResponse.json(
          { error: 'Failed to fetch campaigns' },
          { status: 500 }
        )
      }

      // Buscar insights recentes para cada campanha
      const campaignIds = campaigns?.map(c => c.id) || []
      let insights = []
      
      if (campaignIds.length > 0) {
        const { data: insightsData } = await supabase
          .from('meta_campaign_insights')
          .select('campaign_id, impressions, clicks, spend, ctr, cpc, cpm')
          .in('campaign_id', campaignIds)
          .gte('date_start', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
          .order('date_start', { ascending: false })

        insights = insightsData || []
      }

      // Agregar insights por campanha
      const campaignsWithInsights = campaigns?.map(campaign => {
        const campaignInsights = insights.filter(i => i.campaign_id === campaign.id)
        
        const totalInsights = campaignInsights.reduce((acc, insight) => ({
          impressions: acc.impressions + (insight.impressions || 0),
          clicks: acc.clicks + (insight.clicks || 0),
          spend: acc.spend + (insight.spend || 0)
        }), { impressions: 0, clicks: 0, spend: 0 })

        return {
          ...campaign,
          insights: {
            impressions: totalInsights.impressions,
            clicks: totalInsights.clicks,
            spend: totalInsights.spend,
            ctr: totalInsights.clicks > 0 ? (totalInsights.clicks / totalInsights.impressions * 100) : 0,
            cpc: totalInsights.clicks > 0 ? (totalInsights.spend / totalInsights.clicks) : 0
          }
        }
      })

      return NextResponse.json({
        data: campaignsWithInsights,
        pagination: {
          limit,
          offset,
          total: count || 0,
          has_more: (count || 0) > offset + limit
        }
      })
    } catch (error) {
      console.error('Error in campaigns API:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })(request)
}

/**
 * POST /api/v1/campaigns
 * Cria uma nova campanha (requer integração Meta Ads)
 * Requirements: 6.2, 6.4 - Bloquear criação por usuários comuns
 */
const createCampaign = createAccessControl.writeCampaigns(false, 'Usuários comuns não podem criar campanhas')

export async function POST(request: NextRequest) {
  return createCampaign(async (request: NextRequest, context: any) => {
    const auth = await apiAuthService.authenticateApiRequest(request, 'campaigns:write')
    
    if (!auth.success) {
      return NextResponse.json(
        { error: auth.error },
        { status: 401 }
      )
    }

    try {
      const body = await request.json()
      const { name, objective, account_id, daily_budget, client_id } = body

      // Validação básica
      if (!name || !objective || !account_id || !client_id) {
        return NextResponse.json(
          { error: 'Missing required fields: name, objective, account_id, client_id' },
          { status: 400 }
        )
      }

      // Verificar se o usuário tem acesso ao cliente
      const supabase = await createClient()
      const hasAccess = await context.hasClientAccess(context.user.id, client_id)
      
      if (!hasAccess) {
        return NextResponse.json(
          { 
            error: 'Acesso negado: você não tem permissão para criar campanhas para este cliente',
            code: 'CLIENT_ACCESS_DENIED'
          },
          { status: 403 }
        )
      }

      // Validar limites de plano se não for super admin
      if (context.userType !== 'super_admin' && context.organizationId) {
        const validation = await context.validateActionAgainstLimits(
          context.organizationId,
          'create_campaign'
        )

        if (!validation.valid) {
          return NextResponse.json(
            {
              error: validation.reason || 'Limite de campanhas atingido',
              code: 'PLAN_LIMIT_EXCEEDED',
              currentUsage: validation.currentUsage,
              limit: validation.limit,
              upgradeRequired: true
            },
            { status: 402 }
          )
        }
      }

      return NextResponse.json({
        error: 'Campaign creation is not available without a real Meta Ads integration',
        code: 'NOT_IMPLEMENTED'
      }, { status: 501 })
    } catch (error) {
      console.error('Error creating campaign:', error)
      return NextResponse.json(
        { error: 'Failed to create campaign' },
        { status: 500 }
      )
    }
  })(request)
}
