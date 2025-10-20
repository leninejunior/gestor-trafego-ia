import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateDateRange } from '@/lib/utils/date-formatter'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('client_id')
    const campaignId = searchParams.get('campaign_id')
    const dateRangeParam = searchParams.get('date_range') || 'this_month'
    const adsetIds = searchParams.get('adset_ids')?.split(',').filter(Boolean)

    if (!clientId) {
      return NextResponse.json({
        error: 'client_id é obrigatório'
      }, { status: 400 })
    }

    if (!campaignId) {
      return NextResponse.json({
        error: 'campaign_id é obrigatório'
      }, { status: 400 })
    }

    // Buscar conexão Meta ativa
    const { data: connection } = await supabase
      .from('client_meta_connections')
      .select('*')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .single()

    if (!connection) {
      return NextResponse.json({
        error: 'Cliente não possui conexão ativa com Meta Ads'
      }, { status: 404 })
    }

    // Calcular range de datas
    let timeRange: { since: string; until: string }
    
    if (dateRangeParam.startsWith('custom:')) {
      const [, startDate, endDate] = dateRangeParam.split(':')
      timeRange = { since: startDate, until: endDate }
    } else {
      timeRange = calculateDateRange(dateRangeParam)
    }

    // Buscar conjuntos de anúncios da campanha
    const metaApiUrl = `https://graph.facebook.com/v18.0/${campaignId}/adsets`
    
    const params = new URLSearchParams({
      access_token: connection.access_token,
      fields: `id,name,status,daily_budget,lifetime_budget,optimization_goal,billing_event,targeting,insights.time_range({'since':'${timeRange.since}','until':'${timeRange.until}'}){spend,impressions,clicks,actions,ctr,cpc,cpm,reach,frequency,cost_per_action_type}`,
      limit: '100'
    })

    const response = await fetch(`${metaApiUrl}?${params}`)
    const metaData = await response.json()

    if (metaData.error) {
      console.error('Erro da Meta API:', metaData.error)
      return NextResponse.json({
        error: `Erro da Meta API: ${metaData.error.message}`
      }, { status: 400 })
    }

    let adsets = metaData.data || []

    // Filtrar por IDs específicos se fornecido
    if (adsetIds && adsetIds.length > 0) {
      adsets = adsets.filter((adset: any) => adsetIds.includes(adset.id))
    }

    // Processar dados
    const processedAdsets = adsets.map((adset: any) => {
      const insights = adset.insights?.data?.[0] || {}
      
      const actions = insights.actions || []
      const purchases = actions.find((a: any) => a.action_type === 'purchase')?.value || 0
      const leads = actions.find((a: any) => a.action_type === 'lead')?.value || 0
      const conversions = purchases || leads || 0
      
      const spend = parseFloat(insights.spend || '0')
      const impressions = parseInt(insights.impressions || '0')
      const clicks = parseInt(insights.clicks || '0')
      const reach = parseInt(insights.reach || '0')
      
      const ctr = insights.ctr ? parseFloat(insights.ctr) : (impressions > 0 ? (clicks / impressions) * 100 : 0)
      const cpc = insights.cpc ? parseFloat(insights.cpc) : (clicks > 0 ? spend / clicks : 0)
      const cpm = insights.cpm ? parseFloat(insights.cpm) : (impressions > 0 ? (spend / impressions) * 1000 : 0)
      
      return {
        id: adset.id,
        name: adset.name,
        status: adset.status,
        daily_budget: adset.daily_budget,
        lifetime_budget: adset.lifetime_budget,
        optimization_goal: adset.optimization_goal,
        billing_event: adset.billing_event,
        spend,
        impressions,
        clicks,
        conversions: parseInt(conversions),
        ctr,
        cpc,
        cpm,
        reach,
        frequency: parseFloat(insights.frequency || '0'),
        campaign_id: campaignId
      }
    })

    // Buscar informações da campanha
    const campaignResponse = await fetch(
      `https://graph.facebook.com/v18.0/${campaignId}?fields=name,objective&access_token=${connection.access_token}`
    )
    const campaignData = await campaignResponse.json()

    return NextResponse.json({
      adsets: processedAdsets,
      total: processedAdsets.length,
      campaign: {
        id: campaignId,
        name: campaignData.name,
        objective: campaignData.objective
      },
      dateRange: timeRange
    })

  } catch (error) {
    console.error('Erro ao buscar conjuntos de anúncios:', error)
    return NextResponse.json({
      error: 'Erro interno do servidor'
    }, { status: 500 })
  }
}
