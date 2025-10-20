import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { formatters } from '@/lib/utils/date-formatter'

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

    console.log('🚀 [WEEKLY] Cliente ID:', clientId)
    console.log('🔍 [WEEKLY FILTERS] Status:', statusFilter, '| Objective:', objectiveFilter)

    // Se não selecionou cliente, retornar vazio
    if (clientId === 'all') {
      return NextResponse.json({
        weekly: [],
        total: 0,
        message: 'Selecione um cliente para visualizar dados semanais'
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
        weekly: [],
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

    console.log('📅 [WEEKLY DATE RANGE]:', timeRange)

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
          console.log(`🔍 [WEEKLY] Filtrado por status ${statusFilter}: ${filteredCampaigns.length} campanhas`)
        }
        
        if (objectiveFilter !== 'all') {
          filteredCampaigns = filteredCampaigns.filter((c: any) => c.objective === objectiveFilter)
          console.log(`🔍 [WEEKLY] Filtrado por objetivo ${objectiveFilter}: ${filteredCampaigns.length} campanhas`)
        }
        
        campaignIds = filteredCampaigns.map((c: any) => c.id)
        console.log(`📊 [WEEKLY] Buscando dados de ${campaignIds.length} campanhas filtradas`)
      }
      
      // Se não há campanhas após filtros, retornar vazio
      if (campaignIds.length === 0) {
        return NextResponse.json({
          weekly: [],
          total: 0,
          message: 'Nenhuma campanha encontrada com os filtros aplicados',
          filters: { client_id: clientId, status: statusFilter, objective: objectiveFilter, days: daysParam }
        })
      }
      
      // Buscar insights semanais do Meta Ads apenas das campanhas filtradas
      const metaApiUrl = `https://graph.facebook.com/v18.0/${connection.ad_account_id}/insights`
      const params = new URLSearchParams({
        access_token: connection.access_token,
        fields: 'spend,impressions,clicks,actions,reach',
        time_increment: '7', // Agrupar por semana
        time_range: JSON.stringify(timeRange),
        filtering: JSON.stringify([{ field: 'campaign.id', operator: 'IN', value: campaignIds }]),
        limit: '20'
      })

      console.log('📡 [WEEKLY] Chamando Meta API...')
      
      const response = await fetch(`${metaApiUrl}?${params}`)
      const metaData = await response.json()

      console.log('📊 [WEEKLY] Resposta da Meta API:', {
        status: response.status,
        hasData: !!metaData.data,
        count: metaData.data?.length || 0,
        hasError: !!metaData.error
      })

      if (metaData.error) {
        console.error('❌ [WEEKLY] Erro da Meta API:', metaData.error)
      }

      const weeklyInsights = metaData.data || []
      
      // Gerar dados semanais (fallback se não houver dados reais)
      const days = parseInt(daysParam === 'this_week' || daysParam === 'last_week' ? '7' : 
                           daysParam === 'this_month' || daysParam === 'last_month' ? '30' : daysParam)
      const weeksToShow = Math.min(Math.ceil(days / 7), 8)
      const weeklyData = []

      if (weeklyInsights.length > 0) {
        // Usar dados reais do Meta
        weeklyInsights.forEach((item: any) => {
          const actions = item.actions || []
          const conversions = actions.find((a: any) => a.action_type === 'purchase')?.value || 
                             actions.find((a: any) => a.action_type === 'lead')?.value || 0
          
          const spend = parseFloat(item.spend || '0')
          const roas = spend > 0 && conversions > 0 ? (conversions * 50) / spend : 0

          // Formatar datas corretamente
          let weekLabel = 'Semana'
          if (item.date_start && item.date_stop) {
            const startDate = new Date(item.date_start)
            const endDate = new Date(item.date_stop)
            weekLabel = `${formatters.week(startDate)} - ${formatters.week(endDate)}`
          }

          weeklyData.push({
            week: weekLabel,
            spend: Math.round(spend),
            impressions: parseInt(item.impressions || '0'),
            clicks: parseInt(item.clicks || '0'),
            conversions: parseInt(conversions),
            roas: Math.round(roas * 100) / 100
          })
        })
      } else {
        // Fallback para dados simulados
        for (let i = weeksToShow - 1; i >= 0; i--) {
          const weekStart = new Date()
          weekStart.setDate(weekStart.getDate() - (i * 7))
          
          const weekEnd = new Date(weekStart)
          weekEnd.setDate(weekEnd.getDate() + 6)

          // Usar formatador de datas
          const weekLabel = `${formatters.week(weekStart)} - ${formatters.week(weekEnd)}`

          const baseSpend = 1000 + (Math.random() * 1000)
          const baseImpressions = 15000 + (Math.random() * 10000)
          const baseClicks = Math.floor(baseImpressions * (0.01 + Math.random() * 0.02))
          const baseConversions = Math.floor(baseClicks * (0.02 + Math.random() * 0.03))
          const roas = baseSpend > 0 ? (baseConversions * 50) / baseSpend : 0

          weeklyData.push({
            week: weekLabel,
            spend: Math.round(baseSpend),
            impressions: Math.round(baseImpressions),
            clicks: baseClicks,
            conversions: baseConversions,
            roas: Math.round(roas * 100) / 100
          })
        }
      }

      console.log('✅ [WEEKLY] Retornando', weeklyData.length, 'dados semanais')

      return NextResponse.json({
        weekly: weeklyData,
        total: weeklyData.length,
        message: weeklyInsights.length > 0 ? 
          `✅ ${weeklyData.length} dados semanais carregados do Meta Ads!` : 
          'Usando dados simulados - nenhum dado semanal encontrado no Meta Ads',
        isRealData: weeklyInsights.length > 0,
        filters: { client_id: clientId, status: statusFilter, objective: objectiveFilter, days: daysParam }
      })

    } catch (metaError) {
      console.error('💥 [WEEKLY] Erro ao chamar Meta API:', metaError)
      
      // Fallback para dados simulados em caso de erro
      const weeklyData = [{
        week: 'Esta semana',
        spend: 1500,
        impressions: 20000,
        clicks: 300,
        conversions: 8,
        roas: 0.27
      }]
      
      return NextResponse.json({
        weekly: weeklyData,
        total: weeklyData.length,
        message: 'Erro ao buscar dados do Meta Ads - usando dados simulados',
        filters: { client_id: clientId, status: statusFilter, objective: objectiveFilter, days: daysParam }
      })
    }

  } catch (error) {
    console.error('Error fetching weekly data:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}