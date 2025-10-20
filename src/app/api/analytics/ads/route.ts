import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateDateRange } from '@/lib/utils/date-formatter'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('client_id')
    const campaignId = searchParams.get('campaign_id')
    const adsetId = searchParams.get('adset_id')
    const dateRangeParam = searchParams.get('date_range') || 'this_month'
    const adIds = searchParams.get('ad_ids')?.split(',').filter(Boolean)

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

    if (!adsetId) {
      return NextResponse.json({
        error: 'adset_id é obrigatório'
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

    // Buscar anúncios do conjunto
    const metaApiUrl = `https://graph.facebook.com/v18.0/${adsetId}/ads`
    
    const params = new URLSearchParams({
      access_token: connection.access_token,
      fields: `id,name,status,creative{id,title,body,image_url,thumbnail_url,object_story_spec,effective_object_story_id},insights.time_range({'since':'${timeRange.since}','until':'${timeRange.until}'}){spend,impressions,clicks,actions,ctr,cpc,cpm,reach,frequency,cost_per_action_type}`,
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

    let ads = metaData.data || []

    // Filtrar por IDs específicos se fornecido
    if (adIds && adIds.length > 0) {
      ads = ads.filter((ad: any) => adIds.includes(ad.id))
    }

    // Processar dados
    const processedAds = ads.map((ad: any) => {
      const insights = ad.insights?.data?.[0] || {}
      const creative = ad.creative || {}
      
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
        id: ad.id,
        name: ad.name,
        status: ad.status,
        creative: {
          id: creative.id,
          title: creative.title,
          body: creative.body,
          image_url: creative.image_url,
          thumbnail_url: creative.thumbnail_url,
          effective_object_story_id: creative.effective_object_story_id
        },
        spend,
        impressions,
        clicks,
        conversions: parseInt(conversions),
        ctr,
        cpc,
        cpm,
        reach,
        frequency: parseFloat(insights.frequency || '0'),
        adset_id: adsetId,
        campaign_id: campaignId
      }
    })

    // Buscar informações da campanha e conjunto
    const [campaignResponse, adsetResponse] = await Promise.all([
      fetch(
        `https://graph.facebook.com/v18.0/${campaignId}?fields=name,objective&access_token=${connection.access_token}`
      ),
      fetch(
        `https://graph.facebook.com/v18.0/${adsetId}?fields=name&access_token=${connection.access_token}`
      )
    ])

    const campaignData = await campaignResponse.json()
    const adsetData = await adsetResponse.json()

    return NextResponse.json({
      ads: processedAds,
      total: processedAds.length,
      campaign: {
        id: campaignId,
        name: campaignData.name,
        objective: campaignData.objective
      },
      adset: {
        id: adsetId,
        name: adsetData.name
      },
      dateRange: timeRange
    })

  } catch (error) {
    console.error('Erro ao buscar anúncios:', error)
    return NextResponse.json({
      error: 'Erro interno do servidor'
    }, { status: 500 })
  }
}
