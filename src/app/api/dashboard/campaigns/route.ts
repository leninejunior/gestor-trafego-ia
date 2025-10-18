import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Obter parâmetros
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('client_id') || 'all'
    const statusFilter = searchParams.get('status') || 'all'
    const objectiveFilter = searchParams.get('objective') || 'all'
    const sortBy = searchParams.get('sort') || 'spend'
    const sortOrder = searchParams.get('order') || 'desc'

    console.log('🚀 [CAMPAIGNS REAL] Cliente ID:', clientId)
    console.log('🔍 [FILTERS] Status:', statusFilter, '| Objective:', objectiveFilter, '| Sort:', sortBy, sortOrder)

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
      
      // Definir período baseado no parâmetro days
      const daysParam = searchParams.get('days') || '365'
      let timeRange: { since: string; until: string }
      
      if (daysParam.startsWith('custom:')) {
        // Range customizado: custom:2025-01-01:2025-12-31
        const [, startDate, endDate] = daysParam.split(':')
        timeRange = {
          since: startDate,
          until: endDate
        }
      } else {
        // Range baseado em dias
        const endDate = new Date()
        const startDate = new Date()
        
        switch (daysParam) {
          case 'this_week':
            const startOfWeek = new Date(endDate)
            startOfWeek.setDate(endDate.getDate() - endDate.getDay() + 1) // Segunda-feira
            timeRange = {
              since: startOfWeek.toISOString().split('T')[0],
              until: endDate.toISOString().split('T')[0]
            }
            break
          case 'last_week':
            const lastWeekEnd = new Date(endDate)
            lastWeekEnd.setDate(endDate.getDate() - endDate.getDay())
            const lastWeekStart = new Date(lastWeekEnd)
            lastWeekStart.setDate(lastWeekEnd.getDate() - 6)
            timeRange = {
              since: lastWeekStart.toISOString().split('T')[0],
              until: lastWeekEnd.toISOString().split('T')[0]
            }
            break
          case 'this_month':
            const startOfMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1)
            timeRange = {
              since: startOfMonth.toISOString().split('T')[0],
              until: endDate.toISOString().split('T')[0]
            }
            break
          case 'last_month':
            const lastMonthStart = new Date(endDate.getFullYear(), endDate.getMonth() - 1, 1)
            const lastMonthEnd = new Date(endDate.getFullYear(), endDate.getMonth(), 0)
            timeRange = {
              since: lastMonthStart.toISOString().split('T')[0],
              until: lastMonthEnd.toISOString().split('T')[0]
            }
            break
          default:
            // Número de dias
            const days = parseInt(daysParam)
            startDate.setDate(endDate.getDate() - days)
            timeRange = {
              since: startDate.toISOString().split('T')[0],
              until: endDate.toISOString().split('T')[0]
            }
        }
      }
      
      console.log('📅 [DATE RANGE]:', timeRange)
      
      const params = new URLSearchParams({
        access_token: connection.access_token,
        fields: `id,name,status,objective,daily_budget,lifetime_budget,created_time,updated_time,start_time,stop_time,insights.time_range({'since':'${timeRange.since}','until':'${timeRange.until}'}){spend,impressions,clicks,actions,ctr,cpc,reach,frequency,cost_per_action_type}`,
        limit: '50'
      })

      console.log('📡 [CAMPAIGNS REAL] Chamando Meta API...')
      
      const response = await fetch(`${metaApiUrl}?${params}`)
      const metaData = await response.json()

      console.log('📊 [CAMPAIGNS REAL] Resposta da Meta API:', {
        status: response.status,
        hasData: !!metaData.data,
        campaignsCount: metaData.data?.length || 0,
        hasError: !!metaData.error,
        timeRange,
        url: `${metaApiUrl}?${params}`
      })
      
      // Se não trouxe insights, tentar com lifetime
      if (metaData.data && metaData.data.length > 0) {
        const firstCampaign = metaData.data[0]
        console.log('🔍 [SAMPLE CAMPAIGN]:', JSON.stringify(firstCampaign, null, 2))
        
        // Se não tem insights, tentar buscar com lifetime
        if (!firstCampaign.insights || !firstCampaign.insights.data || firstCampaign.insights.data.length === 0) {
          console.log('⚠️ [NO INSIGHTS] Tentando buscar com lifetime...')
          
          const lifetimeParams = new URLSearchParams({
            access_token: connection.access_token,
            fields: `id,name,status,objective,daily_budget,lifetime_budget,created_time,updated_time,start_time,stop_time,insights.date_preset(lifetime){spend,impressions,clicks,actions,ctr,cpc,reach,frequency,cost_per_action_type}`,
            limit: '50'
          })
          
          const lifetimeResponse = await fetch(`${metaApiUrl}?${lifetimeParams}`)
          const lifetimeData = await lifetimeResponse.json()
          
          if (lifetimeData.data) {
            console.log('✅ [LIFETIME DATA] Dados encontrados com lifetime')
            metaData.data = lifetimeData.data
          }
        }
      }

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

      // Processar e filtrar campanhas reais
      let campaigns = metaCampaigns.map((campaign: any) => {
        const insights = campaign.insights?.data?.[0] || {}
        
        // Extrair conversões de diferentes tipos de ação
        const actions = insights.actions || []
        const purchases = actions.find((a: any) => a.action_type === 'purchase')?.value || 0
        const leads = actions.find((a: any) => a.action_type === 'lead')?.value || 0
        const conversions = purchases || leads || actions.find((a: any) => a.action_type === 'offsite_conversion')?.value || 0
        
        // Calcular métricas
        const spend = parseFloat(insights.spend || '0')
        const impressions = parseInt(insights.impressions || '0')
        const clicks = parseInt(insights.clicks || '0')
        const reach = parseInt(insights.reach || '0')
        
        // CTR e CPC calculados se não vieram da API
        const ctr = insights.ctr ? parseFloat(insights.ctr) : (impressions > 0 ? (clicks / impressions) * 100 : 0)
        const cpc = insights.cpc ? parseFloat(insights.cpc) : (clicks > 0 ? spend / clicks : 0)
        
        // ROAS baseado em conversões (assumindo valor médio de R$ 50 por conversão)
        const roas = spend > 0 && conversions > 0 ? (conversions * 50) / spend : 0
        
        console.log(`📊 [CAMPAIGN] ${campaign.name}:`, {
          spend,
          impressions,
          clicks,
          conversions,
          ctr: ctr.toFixed(2),
          cpc: cpc.toFixed(2),
          roas: roas.toFixed(2)
        })
        
        return {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          spend,
          impressions,
          clicks,
          conversions: parseInt(conversions),
          ctr,
          cpc,
          roas,
          reach,
          frequency: parseFloat(insights.frequency || '0'),
          account_name: connection.account_name,
          objective: campaign.objective,
          created_time: campaign.created_time,
          client_name: clientData.name
        }
      })

      // Aplicar filtros
      if (statusFilter !== 'all') {
        campaigns = campaigns.filter((c: any) => c.status === statusFilter)
        console.log(`🔍 [FILTER] Filtrado por status ${statusFilter}: ${campaigns.length} campanhas`)
      }

      if (objectiveFilter !== 'all') {
        campaigns = campaigns.filter((c: any) => c.objective === objectiveFilter)
        console.log(`🔍 [FILTER] Filtrado por objetivo ${objectiveFilter}: ${campaigns.length} campanhas`)
      }

      // Aplicar ordenação
      campaigns.sort((a: any, b: any) => {
        const aValue = a[sortBy] || 0
        const bValue = b[sortBy] || 0
        return sortOrder === 'desc' ? bValue - aValue : aValue - bValue
      })

      console.log('🎯 [CAMPAIGNS REAL] Retornando', campaigns.length, 'campanhas REAIS para', clientData.name)

      return NextResponse.json({
        campaigns,
        total: campaigns.length,
        clientName: clientData.name,
        accountName: connection.account_name,
        message: `✅ ${campaigns.length} campanhas REAIS carregadas do Meta Ads!`,
        filters: {
          status: statusFilter,
          objective: objectiveFilter,
          sortBy,
          sortOrder
        },
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