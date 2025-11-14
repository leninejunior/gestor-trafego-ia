import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { META_CONFIG } from '@/lib/meta/config'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const supabase = await createClient()
    const { campaignId } = await params
    const { status, clientId, adAccountId } = await request.json()

    console.log('🔍 Recebido:', { campaignId, status, clientId, adAccountId })

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

    // Buscar conexão ativa do cliente (não precisa da campanha no banco!)
    let connection;
    
    if (clientId) {
      // Se temos clientId, buscar a conexão ativa
      const { data, error } = await supabase
        .from('client_meta_connections')
        .select('*')
        .eq('client_id', clientId)
        .eq('is_active', true)
        .maybeSingle()
      
      connection = data
      console.log('📊 Conexão por clientId:', { found: !!connection, error })
    }

    if (!connection && adAccountId) {
      // Se não encontrou por clientId, tentar por adAccountId
      const { data, error } = await supabase
        .from('client_meta_connections')
        .select('*')
        .eq('ad_account_id', adAccountId)
        .eq('is_active', true)
        .maybeSingle()
      
      connection = data
      console.log('📊 Conexão por adAccountId:', { found: !!connection, error })
    }

    if (!connection) {
      // Última tentativa: buscar qualquer conexão ativa
      const { data, error } = await supabase
        .from('client_meta_connections')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()
      
      connection = data
      console.log('📊 Conexão ativa qualquer:', { found: !!connection, error })
    }

    if (!connection) {
      return NextResponse.json({
        error: 'Nenhuma conexão Meta Ads ativa encontrada'
      }, { status: 404 })
    }

    // Chamar Meta API diretamente com o campaignId (que é o external_id)
    const metaApiUrl = `${META_CONFIG.BASE_URL}/${META_CONFIG.API_VERSION}/${campaignId}`
    
    console.log('🚀 Atualizando status na Meta API:', { campaignId, status })
    
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
      console.error('❌ Erro da Meta API:', data.error)
      return NextResponse.json({
        error: data.error?.message || 'Erro ao atualizar status na Meta API',
        details: data.error
      }, { status: 400 })
    }

    console.log('✅ Status atualizado com sucesso!')

    return NextResponse.json({
      success: true,
      campaignId,
      newStatus: status,
      message: `Campanha ${status === 'ACTIVE' ? 'ativada' : 'pausada'} com sucesso!`
    })

  } catch (error) {
    console.error('💥 Erro ao atualizar status da campanha:', error)
    return NextResponse.json({
      error: 'Erro interno do servidor'
    }, { status: 500 })
  }
}
