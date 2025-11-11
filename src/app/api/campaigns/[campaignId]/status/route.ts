import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  try {
    const supabase = await createClient()
    const { campaignId } = params
    const { status } = await request.json()

    if (!campaignId || !status) {
      return NextResponse.json({
        error: 'campaignId e status são obrigatórios'
      }, { status: 400 })
    }

    // Validar status
    if (!['ACTIVE', 'PAUSED'].includes(status)) {
      return NextResponse.json({
        error: 'Status deve ser ACTIVE ou PAUSED'
      }, { status: 400 })
    }

    // Buscar a campanha e sua conexão através do external_id (campaignId do Meta)
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

    // Atualizar status na Meta API
    const metaApiUrl = `https://graph.facebook.com/v18.0/${campaignId}`
    
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

    console.log('Meta API Response Status:', response.status)

    const data = await response.json()

    if (!response.ok || data.error) {
      console.error('Erro da Meta API:', data.error)
      return NextResponse.json({
        error: data.error?.message || 'Erro ao atualizar status na Meta API',
        details: data.error
      }, { status: 400 })
    }

    // Atualizar status localmente no banco de dados
    await supabase
      .from('meta_campaigns')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('external_id', campaignId)

    return NextResponse.json({
      success: true,
      campaignId,
      newStatus: status,
      message: `Campanha ${status === 'ACTIVE' ? 'ativada' : 'pausada'} com sucesso!`
    })

  } catch (error) {
    console.error('Erro ao atualizar status da campanha:', error)
    return NextResponse.json({
      error: 'Erro interno do servidor'
    }, { status: 500 })
  }
}
