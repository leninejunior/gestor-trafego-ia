/**
 * API Pública v1 - Campanhas
 * Endpoints para acessar dados de campanhas via API
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiAuthService } from '../auth/route'

/**
 * GET /api/v1/campaigns
 * Lista campanhas da organização
 */
export async function GET(request: NextRequest) {
  const auth = await apiAuthService.authenticateApiRequest(request, 'campaigns:read')
  
  if (!auth.success) {
    return NextResponse.json(
      { error: auth.error },
      { status: 401 }
    )
  }

  const { organizationId } = auth.data!
  const { searchParams } = request.nextUrl
  
  // Parâmetros de query
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
  const offset = parseInt(searchParams.get('offset') || '0')
  const status = searchParams.get('status')
  const accountId = searchParams.get('account_id')
  const startDate = searchParams.get('start_date')
  const endDate = searchParams.get('end_date')

  try {
    const supabase = createClient()
    
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
        meta_accounts!inner(
          id,
          name,
          currency
        )
      `)
      .eq('organization_id', organizationId)
      .range(offset, offset + limit - 1)
      .order('created_time', { ascending: false })

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
        .from('meta_insights')
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
}

/**
 * POST /api/v1/campaigns
 * Cria uma nova campanha (placeholder - requer integração com Meta API)
 */
export async function POST(request: NextRequest) {
  const auth = await apiAuthService.authenticateApiRequest(request, 'campaigns:write')
  
  if (!auth.success) {
    return NextResponse.json(
      { error: auth.error },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()
    const { name, objective, account_id, daily_budget } = body

    // Validação básica
    if (!name || !objective || !account_id) {
      return NextResponse.json(
        { error: 'Missing required fields: name, objective, account_id' },
        { status: 400 }
      )
    }

    // Aqui você implementaria a criação via Meta Ads API
    // Por enquanto, retornamos um placeholder
    
    return NextResponse.json({
      message: 'Campaign creation not implemented yet',
      data: {
        id: 'placeholder_' + Date.now(),
        name,
        objective,
        account_id,
        daily_budget,
        status: 'PAUSED'
      }
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating campaign:', error)
    return NextResponse.json(
      { error: 'Failed to create campaign' },
      { status: 500 }
    )
  }
}