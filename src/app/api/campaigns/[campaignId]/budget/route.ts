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
    const { daily_budget, lifetime_budget, clientId, adAccountId } = await request.json()

    if (!campaignId) {
      return NextResponse.json({
        error: 'campaignId é obrigatório'
      }, { status: 400 })
    }

    if (!daily_budget && !lifetime_budget) {
      return NextResponse.json({
        error: 'É necessário fornecer daily_budget ou lifetime_budget'
      }, { status: 400 })
    }

    // Buscar conexão ativa do cliente (não precisa da campanha no banco!)
    let connection;
    
    if (clientId) {
      const { data } = await supabase
        .from('client_meta_connections')
        .select('*')
        .eq('client_id', clientId)
        .eq('is_active', true)
        .maybeSingle()
      connection = data
    }

    if (!connection && adAccountId) {
      const { data } = await supabase
        .from('client_meta_connections')
        .select('*')
        .eq('ad_account_id', adAccountId)
        .eq('is_active', true)
        .maybeSingle()
      connection = data
    }

    if (!connection) {
      const { data } = await supabase
        .from('client_meta_connections')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()
      connection = data
    }

    if (!connection) {
      return NextResponse.json({
        error: 'Nenhuma conexão Meta Ads ativa encontrada'
      }, { status: 404 })
    }

    // Preparar dados para atualização
    const updateData: any = {
      access_token: connection.access_token
    }

    if (daily_budget) {
      // Meta API espera valores em centavos
      updateData.daily_budget = Math.round(parseFloat(daily_budget) * 100)
    }

    if (lifetime_budget) {
      updateData.lifetime_budget = Math.round(parseFloat(lifetime_budget) * 100)
    }

    // Chamar Meta API diretamente com o campaignId (que é o external_id)
    const metaApiUrl = `${META_CONFIG.BASE_URL}/${META_CONFIG.API_VERSION}/${campaignId}`
    
    console.log('🚀 Atualizando orçamento na Meta API:', { campaignId, updateData })
    
    const response = await fetch(metaApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData)
    })

    const data = await response.json()

    if (!response.ok || data.error) {
      console.error('❌ Erro da Meta API:', data.error)
      return NextResponse.json({
        error: data.error?.message || 'Erro ao atualizar orçamento na Meta API',
        details: data.error
      }, { status: 400 })
    }

    console.log('✅ Orçamento atualizado com sucesso!')

    return NextResponse.json({
      success: true,
      campaignId,
      daily_budget: daily_budget ? updateData.daily_budget : null,
      lifetime_budget: lifetime_budget ? updateData.lifetime_budget : null,
      message: 'Orçamento atualizado com sucesso!'
    })

  } catch (error) {
    console.error('Erro ao atualizar orçamento da campanha:', error)
    return NextResponse.json({
      error: 'Erro interno do servidor'
    }, { status: 500 })
  }
}
