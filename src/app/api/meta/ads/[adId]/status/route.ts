import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { adId: string } }
) {
  try {
    const supabase = await createClient()
    const { adId } = params
    const { status } = await request.json()

    if (!status || !['ACTIVE', 'PAUSED'].includes(status)) {
      return NextResponse.json({
        error: 'Status inválido. Use ACTIVE ou PAUSED'
      }, { status: 400 })
    }

    // Buscar o anúncio e sua conexão
    const { data: ad, error: adError } = await supabase
      .from('meta_ads')
      .select(`
        id,
        external_id,
        adset_id,
        meta_adsets!inner (
          id,
          campaign_id,
          meta_campaigns!inner (
            id,
            connection_id,
            client_meta_connections!inner (
              id,
              client_id,
              access_token,
              is_active
            )
          )
        )
      `)
      .eq('external_id', adId)
      .single()

    if (adError || !ad) {
      return NextResponse.json({
        error: 'Anúncio não encontrado'
      }, { status: 404 })
    }

    const adset = ad.meta_adsets as any
    const campaign = adset.meta_campaigns as any
    const connection = campaign.client_meta_connections as any

    if (!connection.is_active) {
      return NextResponse.json({
        error: 'Conexão Meta Ads não está ativa'
      }, { status: 400 })
    }

    // Atualizar status na Meta API
    const metaApiUrl = `https://graph.facebook.com/v18.0/${adId}`
    const response = await fetch(metaApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status,
        access_token: connection.access_token
      })
    })

    const data = await response.json()

    if (!response.ok || data.error) {
      console.error('Erro da Meta API:', data.error)
      return NextResponse.json({
        error: data.error?.message || 'Erro ao atualizar status na Meta API',
        details: data.error
      }, { status: 400 })
    }

    // Atualizar no banco de dados local
    await supabase
      .from('meta_ads')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('external_id', adId)

    return NextResponse.json({
      success: true,
      message: `Anúncio ${status === 'ACTIVE' ? 'ativado' : 'pausado'} com sucesso`
    })

  } catch (error) {
    console.error('Erro ao atualizar status do anúncio:', error)
    return NextResponse.json({
      error: 'Erro interno do servidor'
    }, { status: 500 })
  }
}
