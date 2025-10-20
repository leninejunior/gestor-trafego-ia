import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  try {
    const supabase = await createClient()
    const { campaignId } = params
    const { status, clientId } = await request.json()

    if (!campaignId || !status || !clientId) {
      return NextResponse.json({
        error: 'campaignId, status e clientId são obrigatórios'
      }, { status: 400 })
    }

    // Validar status
    if (!['ACTIVE', 'PAUSED'].includes(status)) {
      return NextResponse.json({
        error: 'Status deve ser ACTIVE ou PAUSED'
      }, { status: 400 })
    }

    // Buscar conexão Meta ativa do cliente
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

    const data = await response.json()

    if (!response.ok || data.error) {
      console.error('Erro da Meta API:', data.error)
      return NextResponse.json({
        error: data.error?.message || 'Erro ao atualizar status na Meta API'
      }, { status: 400 })
    }

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
