import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { META_CONFIG } from '@/lib/meta/config'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ adsetId: string }> }
) {
  try {
    const supabase = await createClient()
    const { adsetId } = await params
    const { status } = await request.json()

    if (!adsetId || !status) {
      return NextResponse.json({
        error: 'adsetId e status são obrigatórios'
      }, { status: 400 })
    }

    // Validar status
    if (!['ACTIVE', 'PAUSED'].includes(status)) {
      return NextResponse.json({
        error: 'Status deve ser ACTIVE ou PAUSED'
      }, { status: 400 })
    }

    // Buscar o adset e sua conexão (pode ser external_id ou id interno)
    console.log('🔍 Buscando adset com ID:', adsetId)
    
    // Tentar primeiro por external_id
    let { data: adset, error: adsetError } = await supabase
      .from('meta_adsets')
      .select(`
        id,
        external_id,
        campaign_id,
        meta_campaigns!inner (
          connection_id,
          client_meta_connections!inner (
            id,
            client_id,
            access_token,
            is_active
          )
        )
      `)
      .eq('external_id', adsetId)
      .maybeSingle()

    // Se não encontrou, tentar por id interno
    if (!adset && !adsetError) {
      const result = await supabase
        .from('meta_adsets')
        .select(`
          id,
          external_id,
          campaign_id,
          meta_campaigns!inner (
            connection_id,
            client_meta_connections!inner (
              id,
              client_id,
              access_token,
              is_active
            )
          )
        `)
        .eq('id', adsetId)
        .maybeSingle()
      
      adset = result.data
      adsetError = result.error
    }

    if (adsetError || !adset) {
      console.error('❌ Erro ao buscar adset:', { adsetError, adsetId })
      return NextResponse.json({
        error: 'Conjunto de anúncios não encontrado'
      }, { status: 404 })
    }

    const campaign = adset.meta_campaigns as any
    const connection = campaign.client_meta_connections as any

    if (!connection.is_active) {
      return NextResponse.json({
        error: 'Conexão Meta Ads não está ativa'
      }, { status: 400 })
    }

    // Usar o external_id para chamar a Meta API
    const metaExternalId = adset.external_id
    const metaApiUrl = `${META_CONFIG.BASE_URL}/${META_CONFIG.API_VERSION}/${metaExternalId}`
    
    console.log('Atualizando status do adset na Meta API:', { metaExternalId, status })
    
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

    // Atualizar status localmente no banco de dados usando o id interno
    await supabase
      .from('meta_adsets')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', adset.id)

    return NextResponse.json({
      success: true,
      adsetId: adset.id,
      externalId: adset.external_id,
      newStatus: status,
      message: `Conjunto de anúncios ${status === 'ACTIVE' ? 'ativado' : 'pausado'} com sucesso!`
    })

  } catch (error) {
    console.error('Erro ao atualizar status do adset:', error)
    return NextResponse.json({
      error: 'Erro interno do servidor'
    }, { status: 500 })
  }
}
