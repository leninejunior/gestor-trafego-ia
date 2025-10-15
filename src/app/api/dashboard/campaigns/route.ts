import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Obter parâmetros
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('client_id') || 'all'

    console.log('🚀 [CAMPAIGNS REAL] Cliente ID:', clientId)

    // Se não selecionou cliente, retornar vazio
    if (clientId === 'all') {
      return NextResponse.json({
        campaigns: [],
        total: 0,
        message: 'Selecione um cliente para visualizar as campanhas'
      })
    }

    // Buscar dados do cliente
    const { data: clientData } = await supabase
      .from('clients')
      .select('id, name')
      .eq('id', clientId)
      .single()

    if (!clientData) {
      return NextResponse.json({ 
        campaigns: [],
        total: 0,
        message: 'Cliente não encontrado'
      })
    }

    // Buscar conexão Meta ATIVA para este cliente
    const { data: connection } = await supabase
      .from('client_meta_connections')
      .select('*')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .single()

    if (!connection) {
      return NextResponse.json({
        campaigns: [],
        total: 0,
        message: 'Cliente não possui conexão ativa com Meta Ads',
        needsConnection: true
      })
    }

    console.log('🔗 [CAMPAIGNS REAL] Conexão encontrada:', connection.account_name)
    console.log('🔑 [CAMPAIGNS REAL] Ad Account ID:', connection.ad_account_id)

    // Buscar campanhas REAIS da API do Meta
    try {
      const metaApiUrl = `https://graph.facebook.com/v18.0/${connection.ad_account_id}/campaigns`
      const params = new URLSearchParams({
        access_token: connection.access_token,
        fields: 'id,name,status,objective,daily_budget,lifetime_budget,created_time,updated_time,start_time,stop_time,insights{spend,impressions,clicks,actions,ctr,cpc,reach,frequency}',
        limit: '50'
      })

      console.log('📡 [CAMPAIGNS REAL] Chamando Meta API...')
      
      const response = await fetch(`${metaApiUrl}?${params}`)
      const metaData = await response.json()

      console.log('📊 [CAMPAIGNS REAL] Resposta da Meta API:', {
        status: response.status,
        hasData: !!metaData.data,
        campaignsCount: metaData.data?.length || 0,
        hasError: !!metaData.error
      })

      if (metaData.error) {
        console.error('❌ [CAMPAIGNS REAL] Erro da Meta API:', metaData.error)
        return NextResponse.json({
          campaigns: [],
          total: 0,
          message: `Erro da Meta API: ${metaData.error.message}`,
          error: metaData.error
        })
      }

      const metaCampaigns = metaData.data || []
      console.log('✅ [CAMPAIGNS REAL] Campanhas encontradas:', metaCampaigns.length)

      if (metaCampaigns.length === 0) {
        return NextResponse.json({
          campaigns: [],
          total: 0,
          message: 'Nenhuma campanha encontrada na conta Meta Ads',
          accountName: connection.account_name
        })
      }

      // Processar campanhas reais
      const campaigns = metaCampaigns.map((campaign: any) => {
        const insights = campaign.insights?.data?.[0] || {}
        
        return {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          spend: parseFloat(insights.spend || '0'),
          impressions: parseInt(insights.impressions || '0'),
          clicks: parseInt(insights.clicks || '0'),
          conversions: insights.actions?.find((a: any) => a.action_type === 'purchase')?.value || 0,
          ctr: parseFloat(insights.ctr || '0'),
          cpc: parseFloat(insights.cpc || '0'),
          roas: insights.actions?.find((a: any) => a.action_type === 'purchase')?.value 
            ? (parseFloat(insights.actions.find((a: any) => a.action_type === 'purchase').value) * 50 / parseFloat(insights.spend || '1'))
            : 0,
          reach: parseInt(insights.reach || '0'),
          frequency: parseFloat(insights.frequency || '0'),
          account_name: connection.account_name,
          objective: campaign.objective,
          created_time: campaign.created_time,
          client_name: clientData.name
        }
      })

      console.log('🎯 [CAMPAIGNS REAL] Retornando', campaigns.length, 'campanhas REAIS para', clientData.name)

      return NextResponse.json({
        campaigns,
        total: campaigns.length,
        clientName: clientData.name,
        accountName: connection.account_name,
        message: `✅ ${campaigns.length} campanhas REAIS carregadas do Meta Ads!`,
        isRealData: true
      })

    } catch (metaError) {
      console.error('💥 [CAMPAIGNS REAL] Erro ao chamar Meta API:', metaError)
      return NextResponse.json({
        campaigns: [],
        total: 0,
        message: 'Erro ao buscar campanhas do Meta Ads',
        error: metaError instanceof Error ? metaError.message : 'Erro desconhecido'
      })
    }

  } catch (error) {
    console.error('❌ [CAMPAIGNS REAL] Erro geral:', error)
    return NextResponse.json({
      campaigns: [],
      total: 0,
      message: 'Erro interno do servidor'
    }, { status: 500 })
  }
}