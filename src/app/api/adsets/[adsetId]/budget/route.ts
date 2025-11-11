import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { adsetId: string } }
) {
  try {
    const supabase = await createClient()
    const { adsetId } = params
    const { daily_budget, lifetime_budget } = await request.json()

    if (!adsetId) {
      return NextResponse.json({
        error: 'adsetId é obrigatório'
      }, { status: 400 })
    }

    if (!daily_budget && !lifetime_budget) {
      return NextResponse.json({
        error: 'É necessário fornecer daily_budget ou lifetime_budget'
      }, { status: 400 })
    }

    // Buscar o adset e sua conexão
    const { data: adset, error: adsetError } = await supabase
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
      .single()

    if (adsetError || !adset) {
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

    // Atualizar orçamento na Meta API
    const metaApiUrl = `https://graph.facebook.com/v18.0/${adsetId}`
    
    const response = await fetch(metaApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData)
    })

    const data = await response.json()

    if (!response.ok || data.error) {
      console.error('Erro da Meta API:', data.error)
      return NextResponse.json({
        error: data.error?.message || 'Erro ao atualizar orçamento na Meta API',
        details: data.error
      }, { status: 400 })
    }

    // Atualizar orçamento localmente no banco de dados
    const dbUpdate: any = { updated_at: new Date().toISOString() }
    if (daily_budget) dbUpdate.daily_budget = updateData.daily_budget.toString()
    if (lifetime_budget) dbUpdate.lifetime_budget = updateData.lifetime_budget.toString()

    await supabase
      .from('meta_adsets')
      .update(dbUpdate)
      .eq('external_id', adsetId)

    return NextResponse.json({
      success: true,
      adsetId,
      daily_budget: daily_budget ? updateData.daily_budget : null,
      lifetime_budget: lifetime_budget ? updateData.lifetime_budget : null,
      message: 'Orçamento do conjunto de anúncios atualizado com sucesso!'
    })

  } catch (error) {
    console.error('Erro ao atualizar orçamento do adset:', error)
    return NextResponse.json({
      error: 'Erro interno do servidor'
    }, { status: 500 })
  }
}
