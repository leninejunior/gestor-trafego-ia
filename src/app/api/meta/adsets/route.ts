import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams
    const campaignId = searchParams.get('campaignId')

    if (!campaignId) {
      return NextResponse.json({
        error: 'campaignId é obrigatório'
      }, { status: 400 })
    }

    // Buscar a campanha e sua conexão
    const { data: campaign, error: campaignError } = await supabase
      .from('meta_campaigns')
      .select(`
        id,
        external_id,
        connection_id,
        client_meta_connections!inner (
          id,
          client_id,
          access_token,
          is_active
        )
      `)
      .eq('external_id', campaignId)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({
        error: 'Campanha não encontrada'
      }, { status: 404 })
    }

    const connection = campaign.client_meta_connections as any

    if (!connection.is_active) {
      return NextResponse.json({
        error: 'Conexão Meta Ads não está ativa'
      }, { status: 400 })
    }

    // Buscar adsets da Meta API
    const metaApiUrl = `https://graph.facebook.com/v18.0/${campaignId}/adsets`
    const params = new URLSearchParams({
      access_token: connection.access_token,
      fields: 'id,name,status,daily_budget,lifetime_budget,optimization_goal,billing_event,created_time,updated_time'
    })

    const response = await fetch(`${metaApiUrl}?${params}`)
    const data = await response.json()

    if (!response.ok || data.error) {
      console.error('Erro da Meta API:', data.error)
      return NextResponse.json({
        error: data.error?.message || 'Erro ao buscar conjuntos de anúncios na Meta API',
        details: data.error
      }, { status: 400 })
    }

    // Sincronizar com banco de dados local
    if (data.data && data.data.length > 0) {
      for (const adset of data.data) {
        await supabase
          .from('meta_adsets')
          .upsert({
            external_id: adset.id,
            campaign_id: campaign.id,
            name: adset.name,
            status: adset.status,
            daily_budget: adset.daily_budget,
            lifetime_budget: adset.lifetime_budget,
            optimization_goal: adset.optimization_goal,
            billing_event: adset.billing_event,
            created_time: adset.created_time,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'external_id'
          })
      }
    }

    return NextResponse.json({
      success: true,
      adsets: data.data || [],
      count: data.data?.length || 0
    })

  } catch (error) {
    console.error('Erro ao buscar adsets:', error)
    return NextResponse.json({
      error: 'Erro interno do servidor'
    }, { status: 500 })
  }
}
