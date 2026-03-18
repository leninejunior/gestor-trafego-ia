import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Obter parâmetros de query
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('client_id') || 'all'
    const statusFilter = searchParams.get('status') || 'all'
    const objectiveFilter = searchParams.get('objective') || 'all'

    console.log('🚀 [DEMOGRAPHICS] Cliente ID:', clientId)
    console.log('🔍 [DEMOGRAPHICS FILTERS] Status:', statusFilter, '| Objective:', objectiveFilter)

    // Se não selecionou cliente, retornar vazio
    if (clientId === 'all') {
      return NextResponse.json({
        demographics: [],
        total: 0,
        message: 'Selecione um cliente para visualizar dados demográficos'
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
        demographics: [],
        total: 0,
        message: 'Cliente não possui conexão ativa com Meta Ads'
      })
    }

    // Definir período baseado no parâmetro days (mesmo código das campanhas)
    const daysParam = searchParams.get('days') || 'this_month'
    let timeRange: { since: string; until: string }
    
    if (daysParam.startsWith('custom:')) {
      const [, startDate, endDate] = daysParam.split(':')
      timeRange = { since: startDate, until: endDate }
    } else {
      const endDate = new Date()
      const startDate = new Date()
      
      switch (daysParam) {
        case 'this_week':
          const startOfWeek = new Date(endDate)
          startOfWeek.setDate(endDate.getDate() - endDate.getDay() + 1)
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
          const days = parseInt(daysParam)
          startDate.setDate(endDate.getDate() - days)
          timeRange = {
            since: startDate.toISOString().split('T')[0],
            until: endDate.toISOString().split('T')[0]
          }
      }
    }

    console.log('📅 [DEMOGRAPHICS DATE RANGE]:', timeRange)

    try {
      // Primeiro, buscar campanhas para aplicar filtros
      const campaignsUrl = `https://graph.facebook.com/v18.0/${connection.ad_account_id}/campaigns`
      const campaignsParams = new URLSearchParams({
        access_token: connection.access_token,
        fields: 'id,name,status,objective',
        limit: '100'
      })
      
      const campaignsResponse = await fetch(`${campaignsUrl}?${campaignsParams}`)
      const campaignsData = await campaignsResponse.json()
      
      let campaignIds: string[] = []
      
      if (campaignsData.data && campaignsData.data.length > 0) {
        // Filtrar campanhas por status e objetivo
        let filteredCampaigns = campaignsData.data
        
        if (statusFilter !== 'all') {
          filteredCampaigns = filteredCampaigns.filter((c: any) => c.status === statusFilter)
          console.log(`🔍 [DEMOGRAPHICS] Filtrado por status ${statusFilter}: ${filteredCampaigns.length} campanhas`)
        }
        
        if (objectiveFilter !== 'all') {
          filteredCampaigns = filteredCampaigns.filter((c: any) => c.objective === objectiveFilter)
          console.log(`🔍 [DEMOGRAPHICS] Filtrado por objetivo ${objectiveFilter}: ${filteredCampaigns.length} campanhas`)
        }
        
        campaignIds = filteredCampaigns.map((c: any) => c.id)
        console.log(`📊 [DEMOGRAPHICS] Buscando dados de ${campaignIds.length} campanhas filtradas`)
      }
      
      // Se não há campanhas após filtros, retornar vazio
      if (campaignIds.length === 0) {
        return NextResponse.json({
          demographics: [],
          total: 0,
          message: 'Nenhuma campanha encontrada com os filtros aplicados',
          filters: { client_id: clientId, status: statusFilter, objective: objectiveFilter, days: daysParam }
        })
      }
      
      // Buscar insights demográficos do Meta Ads apenas das campanhas filtradas
      const metaApiUrl = `https://graph.facebook.com/v18.0/${connection.ad_account_id}/insights`
      const params = new URLSearchParams({
        access_token: connection.access_token,
        fields: 'spend,impressions,clicks,actions,reach',
        breakdowns: 'age,gender',
        time_range: JSON.stringify(timeRange),
        filtering: JSON.stringify([{ field: 'campaign.id', operator: 'IN', value: campaignIds }]),
        limit: '100'
      })

      console.log('📡 [DEMOGRAPHICS] Chamando Meta API...')
      
      const response = await fetch(`${metaApiUrl}?${params}`)
      const metaData = await response.json()

      console.log('📊 [DEMOGRAPHICS] Resposta da Meta API:', {
        status: response.status,
        hasData: !!metaData.data,
        count: metaData.data?.length || 0,
        hasError: !!metaData.error
      })

      if (metaData.error) {
        console.error('❌ [DEMOGRAPHICS] Erro da Meta API:', metaData.error)
        return NextResponse.json({
          demographics: [],
          total: 0,
          message: `Erro da Meta API: ${metaData.error.message}`,
          error: metaData.error,
          filters: { client_id: clientId, status: statusFilter, objective: objectiveFilter, days: daysParam }
        })
      }

      const demographicsData = metaData.data || []
      
      if (demographicsData.length === 0) {
        return NextResponse.json({
          demographics: [],
          total: 0,
          message: 'Nenhum dado demográfico encontrado no período selecionado',
          filters: { client_id: clientId, status: statusFilter, objective: objectiveFilter, days: daysParam }
        })
      }

      // Processar dados reais do Meta
      const processedDemographics = demographicsData.map((item: any) => {
        const actions = item.actions || []
        const conversions = actions.find((a: any) => a.action_type === 'purchase')?.value || 
                           actions.find((a: any) => a.action_type === 'lead')?.value || 0

        return {
          age_range: item.age || 'unknown',
          gender: item.gender || 'unknown',
          impressions: parseInt(item.impressions || '0'),
          clicks: parseInt(item.clicks || '0'),
          spend: parseFloat(item.spend || '0'),
          conversions: parseInt(conversions)
        }
      })

      console.log('✅ [DEMOGRAPHICS] Retornando', processedDemographics.length, 'dados demográficos reais')

      return NextResponse.json({
        demographics: processedDemographics,
        total: processedDemographics.length,
        message: `✅ ${processedDemographics.length} dados demográficos carregados do Meta Ads!`,
        isRealData: true,
        filters: { client_id: clientId, status: statusFilter, objective: objectiveFilter, days: daysParam }
      })

    } catch (metaError) {
      console.error('💥 [DEMOGRAPHICS] Erro ao chamar Meta API:', metaError)

      return NextResponse.json({
        demographics: [],
        total: 0,
        message: 'Erro ao buscar dados do Meta Ads',
        error: metaError instanceof Error ? metaError.message : 'Erro desconhecido',
        filters: { client_id: clientId, status: statusFilter, objective: objectiveFilter, days: daysParam }
      })
    }

  } catch (error) {
    console.error('Error fetching demographics:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
