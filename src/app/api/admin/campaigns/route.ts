/**
 * API para Dashboard de Campanhas - Admin
 * Endpoint principal para dados de campanhas com filtros avançados
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verificar se é super admin
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!userRole || userRole.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = request.nextUrl
    
    // Parâmetros de filtro
    const status = searchParams.get('status') || 'all'
    const objective = searchParams.get('objective') || 'all'
    const days = parseInt(searchParams.get('days') || '30')
    const sortBy = searchParams.get('sort') || 'spend'
    const sortOrder = searchParams.get('order') || 'desc'

    // Data de início baseada no período
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Query base para campanhas
    let campaignsQuery = supabase
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
        organization_id,
        meta_accounts!inner(
          id,
          name,
          currency
        )
      `)

    // Aplicar filtros
    if (status !== 'all') {
      campaignsQuery = campaignsQuery.eq('status', status)
    }

    if (objective !== 'all') {
      campaignsQuery = campaignsQuery.eq('objective', objective)
    }

    // Buscar campanhas
    const { data: campaigns, error: campaignsError } = await campaignsQuery

    if (campaignsError) {
      console.error('Error fetching campaigns:', campaignsError)
      return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 })
    }

    if (!campaigns || campaigns.length === 0) {
      return NextResponse.json({ campaigns: [] })
    }

    // Buscar insights para as campanhas
    const campaignIds = campaigns.map(c => c.id)
    
    const { data: insights, error: insightsError } = await supabase
      .from('meta_insights')
      .select('*')
      .in('campaign_id', campaignIds)
      .gte('date_start', startDate.toISOString().split('T')[0])

    if (insightsError) {
      console.error('Error fetching insights:', insightsError)
    }

    // Agregar insights por campanha
    const campaignsWithMetrics = campaigns.map(campaign => {
      const campaignInsights = insights?.filter(i => i.campaign_id === campaign.id) || []
      
      const totals = campaignInsights.reduce((acc, insight) => ({
        impressions: acc.impressions + (insight.impressions || 0),
        clicks: acc.clicks + (insight.clicks || 0),
        spend: acc.spend + (insight.spend || 0),
        reach: acc.reach + (insight.reach || 0),
        conversions: acc.conversions + (insight.conversions || 0)
      }), { impressions: 0, clicks: 0, spend: 0, reach: 0, conversions: 0 })

      // Calcular métricas derivadas
      const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions * 100) : 0
      const cpc = totals.clicks > 0 ? (totals.spend / totals.clicks) : 0
      const frequency = totals.reach > 0 ? (totals.impressions / totals.reach) : 0
      const roas = totals.spend > 0 ? (totals.conversions * 50 / totals.spend) : 0 // Assumindo valor médio de conversão

      return {
        ...campaign,
        account_name: campaign.meta_accounts.name,
        spend: totals.spend,
        impressions: totals.impressions,
        clicks: totals.clicks,
        conversions: totals.conversions,
        reach: totals.reach,
        ctr,
        cpc,
        frequency,
        roas
      }
    })

    // Ordenar resultados
    const sortedCampaigns = campaignsWithMetrics.sort((a, b) => {
      const aValue = a[sortBy as keyof typeof a] as number
      const bValue = b[sortBy as keyof typeof b] as number
      
      if (sortOrder === 'desc') {
        return bValue - aValue
      } else {
        return aValue - bValue
      }
    })

    return NextResponse.json({
      campaigns: sortedCampaigns,
      total: sortedCampaigns.length,
      filters: {
        status,
        objective,
        days,
        sortBy,
        sortOrder
      }
    })

  } catch (error) {
    console.error('Error in campaigns API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}