/**
 * API Pública v1 - Campanha Individual
 * Endpoints para acessar dados de uma campanha específica
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiAuthService } from '../../auth/route'

/**
 * GET /api/v1/campaigns/[campaignId]
 * Busca dados detalhados de uma campanha
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const auth = await apiAuthService.authenticateApiRequest(request, 'campaigns:read')
  
  if (!auth.success) {
    return NextResponse.json(
      { error: auth.error },
      { status: 401 }
    )
  }

  const { organizationId } = auth.data!
  const { campaignId } = params
  const { searchParams } = request.nextUrl
  
  // Parâmetros opcionais
  const includeInsights = searchParams.get('include_insights') === 'true'
  const insightsDays = parseInt(searchParams.get('insights_days') || '30')

  try {
    const supabase = createClient()
    
    // Buscar campanha
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
        meta_accounts!inner(
          id,
          name,
          currency,
          timezone_name
        )
      `)
      .eq('id', campaignId)
      .eq('organization_id', organizationId)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    let insights = null
    
    if (includeInsights) {
      const startDate = new Date(Date.now() - insightsDays * 24 * 60 * 60 * 1000)
        .toISOString().split('T')[0]
      
      const { data: insightsData } = await supabase
        .from('meta_insights')
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
}

/**
 * PUT /api/v1/campaigns/[campaignId]
 * Atualiza uma campanha (placeholder)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const auth = await apiAuthService.authenticateApiRequest(request, 'campaigns:write')
  
  if (!auth.success) {
    return NextResponse.json(
      { error: auth.error },
      { status: 401 }
    )
  }

  const { campaignId } = params

  try {
    const body = await request.json()
    const { name, status, daily_budget } = body

    // Aqui você implementaria a atualização via Meta Ads API
    // Por enquanto, retornamos um placeholder
    
    return NextResponse.json({
      message: 'Campaign update not implemented yet',
      data: {
        id: campaignId,
        name,
        status,
        daily_budget,
        updated_at: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('Error updating campaign:', error)
    return NextResponse.json(
      { error: 'Failed to update campaign' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/v1/campaigns/[campaignId]
 * Remove uma campanha (placeholder)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const auth = await apiAuthService.authenticateApiRequest(request, 'campaigns:delete')
  
  if (!auth.success) {
    return NextResponse.json(
      { error: auth.error },
      { status: 401 }
    )
  }

  const { campaignId } = params

  try {
    // Aqui você implementaria a remoção via Meta Ads API
    // Por enquanto, retornamos um placeholder
    
    return NextResponse.json({
      message: 'Campaign deletion not implemented yet',
      data: {
        id: campaignId,
        deleted_at: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('Error deleting campaign:', error)
    return NextResponse.json(
      { error: 'Failed to delete campaign' },
      { status: 500 }
    )
  }
}