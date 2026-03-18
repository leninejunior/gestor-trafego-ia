/**
 * API Pública v1 - Campanha Individual
 * Endpoints para acessar dados de uma campanha específica
 * Requirements: 5.3, 5.4, 6.2, 6.4 - Controle de acesso por cliente
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiAuthService } from '@/lib/api/auth-service'
import { createAccessControl } from '@/lib/middleware/user-access-middleware'

/**
 * GET /api/v1/campaigns/[campaignId]
 * Busca dados detalhados de uma campanha
 * Requirements: 5.3, 5.4 - Verificar acesso ao cliente da campanha
 */
const getCampaign = createAccessControl.readCampaigns(false, 'Acesso negado para visualizar esta campanha')

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  return getCampaign(async (request: NextRequest, context: any) => {
    const auth = await apiAuthService.authenticateApiRequest(request, 'campaigns:read')
    
    if (!auth.success) {
      return NextResponse.json(
        { error: auth.error },
        { status: 401 }
      )
    }

    const { campaignId } = await params
    const { searchParams } = request.nextUrl
    
    // Parâmetros opcionais
    const includeInsights = searchParams.get('include_insights') === 'true'
    const insightsDays = parseInt(searchParams.get('insights_days') || '30')

    try {
      const supabase = await createClient()
      
      // Buscar campanha com informações do cliente
      const { data: campaign, error: campaignError } = await supabase
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
        .eq('id', campaignId)
        .single()

      if (campaignError || !campaign) {
        return NextResponse.json(
          { error: 'Campaign not found' },
          { status: 404 }
        )
      }

      // Verificar se o usuário tem acesso ao cliente desta campanha
      const clientId = campaign.client_meta_connections.client_id
      const hasAccess = await context.hasClientAccess(context.user.id, clientId)
      
      if (!hasAccess) {
        return NextResponse.json(
          { 
            error: 'Acesso negado: você não tem permissão para visualizar campanhas deste cliente',
            code: 'CLIENT_ACCESS_DENIED'
          },
          { status: 403 }
        )
      }

      let insights = null
      
      if (includeInsights) {
        const startDate = new Date(Date.now() - insightsDays * 24 * 60 * 60 * 1000)
          .toISOString().split('T')[0]
        
        const { data: insightsData } = await supabase
          .from('meta_campaign_insights')
          .select('*')
          .eq('campaign_id', campaignId)
          .gte('date_start', startDate)
          .order('date_start', { ascending: false })

        // Agregar insights
        if (insightsData && insightsData.length > 0) {
          const totalInsights = insightsData.reduce((acc, insight) => ({
            impressions: acc.impressions + (insight.impressions || 0),
            clicks: acc.clicks + (insight.clicks || 0),
            spend: acc.spend + (insight.spend || 0),
            reach: acc.reach + (insight.reach || 0)
          }), { impressions: 0, clicks: 0, spend: 0, reach: 0 })

          insights = {
            period: {
              start_date: startDate,
              end_date: new Date().toISOString().split('T')[0],
              days: insightsDays
            },
            totals: {
              ...totalInsights,
              ctr: totalInsights.impressions > 0 ? 
                (totalInsights.clicks / totalInsights.impressions * 100) : 0,
              cpc: totalInsights.clicks > 0 ? 
                (totalInsights.spend / totalInsights.clicks) : 0,
              cpm: totalInsights.impressions > 0 ? 
                (totalInsights.spend / totalInsights.impressions * 1000) : 0
            },
            daily: insightsData.map(insight => ({
              date: insight.date_start,
              impressions: insight.impressions,
              clicks: insight.clicks,
              spend: insight.spend,
              reach: insight.reach,
              ctr: insight.ctr,
              cpc: insight.cpc,
              cpm: insight.cpm
            }))
          }
        }
      }

      const response = {
        data: {
          ...campaign,
          insights
        }
      }

      return NextResponse.json(response)
    } catch (error) {
      console.error('Error fetching campaign:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })(request, { params })
}

/**
 * PUT /api/v1/campaigns/[campaignId]
 * Atualiza uma campanha (requer integração Meta Ads)
 * Requirements: 6.2, 6.4 - Bloquear modificação por usuários comuns
 */
const updateCampaign = createAccessControl.writeCampaigns(false, 'Usuários comuns não podem modificar campanhas')

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  return updateCampaign(async (request: NextRequest, context: any) => {
    const auth = await apiAuthService.authenticateApiRequest(request, 'campaigns:write')
    
    if (!auth.success) {
      return NextResponse.json(
        { error: auth.error },
        { status: 401 }
      )
    }

    const { campaignId } = await params

    try {
      const supabase = await createClient()
      
      // Verificar se a campanha existe e obter o cliente
      const { data: campaign, error: campaignError } = await supabase
        .from('meta_campaigns')
        .select(`
          id,
          client_meta_connections!inner(
            client_id
          )
        `)
        .eq('id', campaignId)
        .single()

      if (campaignError || !campaign) {
        return NextResponse.json(
          { error: 'Campaign not found' },
          { status: 404 }
        )
      }

      // Verificar se o usuário tem acesso ao cliente desta campanha
      const clientId = campaign.client_meta_connections.client_id
      const hasAccess = await context.hasClientAccess(context.user.id, clientId)
      
      if (!hasAccess) {
        return NextResponse.json(
          { 
            error: 'Acesso negado: você não tem permissão para modificar campanhas deste cliente',
            code: 'CLIENT_ACCESS_DENIED'
          },
          { status: 403 }
        )
      }

      await request.json().catch(() => ({}))

      return NextResponse.json({
        error: 'Campaign update is not available without a real Meta Ads integration',
        code: 'FEATURE_UNAVAILABLE'
      }, { status: 501 })
    } catch (error) {
      console.error('Error updating campaign:', error)
      return NextResponse.json(
        { error: 'Failed to update campaign' },
        { status: 500 }
      )
    }
  })(request, { params })
}

/**
 * DELETE /api/v1/campaigns/[campaignId]
 * Remove uma campanha (requer integração Meta Ads)
 * Requirements: 6.2, 6.4 - Bloquear exclusão por usuários comuns
 */
const deleteCampaign = createAccessControl.writeCampaigns(false, 'Usuários comuns não podem excluir campanhas')

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  return deleteCampaign(async (request: NextRequest, context: any) => {
    const auth = await apiAuthService.authenticateApiRequest(request, 'campaigns:delete')
    
    if (!auth.success) {
      return NextResponse.json(
        { error: auth.error },
        { status: 401 }
      )
    }

    const { campaignId } = await params

    try {
      const supabase = await createClient()
      
      // Verificar se a campanha existe e obter o cliente
      const { data: campaign, error: campaignError } = await supabase
        .from('meta_campaigns')
        .select(`
          id,
          client_meta_connections!inner(
            client_id
          )
        `)
        .eq('id', campaignId)
        .single()

      if (campaignError || !campaign) {
        return NextResponse.json(
          { error: 'Campaign not found' },
          { status: 404 }
        )
      }

      // Verificar se o usuário tem acesso ao cliente desta campanha
      const clientId = campaign.client_meta_connections.client_id
      const hasAccess = await context.hasClientAccess(context.user.id, clientId)
      
      if (!hasAccess) {
        return NextResponse.json(
          { 
            error: 'Acesso negado: você não tem permissão para excluir campanhas deste cliente',
            code: 'CLIENT_ACCESS_DENIED'
          },
          { status: 403 }
        )
      }

      return NextResponse.json({
        error: 'Campaign deletion is not available without a real Meta Ads integration',
        code: 'FEATURE_UNAVAILABLE'
      }, { status: 501 })
    } catch (error) {
      console.error('Error deleting campaign:', error)
      return NextResponse.json(
        { error: 'Failed to delete campaign' },
        { status: 500 }
      )
    }
  })(request, { params })
}
