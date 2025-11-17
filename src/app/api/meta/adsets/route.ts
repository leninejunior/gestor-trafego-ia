import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams
    const campaignId = searchParams.get('campaignId')
    const clientId = searchParams.get('clientId')
    const adAccountId = searchParams.get('adAccountId')

    if (!campaignId) {
      return NextResponse.json({
        error: 'campaignId é obrigatório'
      }, { status: 400 })
    }

    // Se clientId e adAccountId forem fornecidos, buscar conexão diretamente
    let connection: any = null;
    
    if (clientId && adAccountId) {
      const { data: conn, error: connError } = await supabase
        .from('client_meta_connections')
        .select('*')
        .eq('client_id', clientId)
        .eq('ad_account_id', adAccountId)
        .eq('is_active', true)
        .single()

      if (!connError && conn) {
        connection = conn
      }
    }

    // Se não encontrou conexão pelos parâmetros, tentar buscar pela campanha no banco
    if (!connection) {
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
          error: 'Campanha não encontrada e conexão não especificada'
        }, { status: 404 })
      }

      connection = campaign.client_meta_connections
    }

    if (!connection || !connection.is_active) {
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

    // Sincronizar com banco de dados local (comentado por enquanto - requer campanha salva)
    // TODO: Implementar sincronização quando tivermos sistema de sync completo

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
