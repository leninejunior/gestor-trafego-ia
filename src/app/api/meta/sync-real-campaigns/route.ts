import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { clientId } = await request.json()
    
    console.log('🔄 [SYNC REAL] Iniciando sincronização de campanhas REAIS...')
    console.log('👤 [SYNC REAL] Usuário:', user.email)
    console.log('🏢 [SYNC REAL] Cliente ID:', clientId)

    if (!clientId) {
      return NextResponse.json({ error: 'Client ID é obrigatório' }, { status: 400 })
    }

    // Buscar conexões Meta ativas para este cliente
    const { data: connections, error: connectionsError } = await supabase
      .from('client_meta_connections')
      .select('*')
      .eq('client_id', clientId)
      .eq('is_active', true)

    console.log('🔗 [SYNC REAL] Conexões encontradas:', connections?.length || 0)

    if (connectionsError || !connections || connections.length === 0) {
      return NextResponse.json({ 
        error: 'Nenhuma conexão Meta ativa encontrada para este cliente',
        needsConnection: true 
      }, { status: 404 })
    }

    let totalCampaignsSynced = 0
    const syncResults = []

    // Para cada conexão, buscar campanhas reais da API do Meta
    for (const connection of connections) {
      try {
        console.log(`📡 [SYNC REAL] Sincronizando conta: ${connection.account_name}`)
        console.log(`🔑 [SYNC REAL] Ad Account ID: ${connection.ad_account_id}`)
        
        // Fazer chamada para a API do Meta Ads
        const metaApiUrl = `https://graph.facebook.com/v18.0/${connection.ad_account_id}/campaigns`
        const params = new URLSearchParams({
          access_token: connection.access_token,
          fields: 'id,name,status,objective,daily_budget,lifetime_budget,created_time,updated_time,start_time,stop_time,insights{spend,impressions,clicks,actions,ctr,cpc,reach,frequency}'
        })

        console.log(`🌐 [SYNC REAL] Chamando Meta API: ${metaApiUrl}`)
        
        const response = await fetch(`${metaApiUrl}?${params}`)
        const metaData = await response.json()

        console.log(`📊 [SYNC REAL] Resposta da Meta API:`, metaData)

        if (metaData.error) {
          console.error(`❌ [SYNC REAL] Erro da Meta API:`, metaData.error)
          syncResults.push({
            accountName: connection.account_name,
            accountId: connection.ad_account_id,
            campaignsFound: 0,
            success: false,
            error: metaData.error.message
          })
          continue
        }

        const campaigns = metaData.data || []
        console.log(`📊 [SYNC REAL] ${campaigns.length} campanhas encontradas na conta ${connection.account_name}`)

        // Salvar cada campanha real no banco
        for (const campaign of campaigns) {
          const insights = campaign.insights?.data?.[0] || {}
          
          const campaignData = {
            connection_id: connection.id,
            external_id: campaign.id,
            name: campaign.name,
            status: campaign.status,
            objective: campaign.objective,
            daily_budget: campaign.daily_budget,
            lifetime_budget: campaign.lifetime_budget,
            created_time: campaign.created_time,
            updated_time: campaign.updated_time,
            start_time: campaign.start_time,
            stop_time: campaign.stop_time,
            // Métricas de insights
            spend: insights.spend || '0',
            impressions: insights.impressions || '0',
            clicks: insights.clicks || '0',
            conversions: insights.actions?.find(a => a.action_type === 'purchase')?.value || '0',
            ctr: insights.ctr || '0',
            cpc: insights.cpc || '0',
            reach: insights.reach || '0',
            frequency: insights.frequency || '0',
            roas: insights.actions?.find(a => a.action_type === 'purchase')?.value 
              ? (parseFloat(insights.actions.find(a => a.action_type === 'purchase').value) * 50 / parseFloat(insights.spend || '1')).toString()
              : '0',
            updated_at: new Date().toISOString()
          }

          const { data: savedCampaign, error: saveError } = await supabase
            .from('meta_campaigns')
            .upsert(campaignData, {
              onConflict: 'connection_id,external_id'
            })

          if (saveError) {
            console.error(`❌ [SYNC REAL] Erro ao salvar campanha ${campaign.name}:`, saveError)
          } else {
            console.log(`✅ [SYNC REAL] Campanha REAL salva: ${campaign.name}`)
            totalCampaignsSynced++
          }
        }

        syncResults.push({
          accountName: connection.account_name,
          accountId: connection.ad_account_id,
          campaignsFound: campaigns.length,
          success: true
        })

      } catch (connectionError) {
        console.error(`❌ [SYNC REAL] Erro na conta ${connection.account_name}:`, connectionError)
        syncResults.push({
          accountName: connection.account_name,
          accountId: connection.ad_account_id,
          campaignsFound: 0,
          success: false,
          error: connectionError instanceof Error ? connectionError.message : 'Erro desconhecido'
        })
      }
    }

    console.log(`🎯 [SYNC REAL] Sincronização REAL concluída: ${totalCampaignsSynced} campanhas`)

    return NextResponse.json({
      success: true,
      totalCampaignsSynced,
      connectionsProcessed: connections.length,
      results: syncResults,
      message: `${totalCampaignsSynced} campanhas REAIS sincronizadas com sucesso!`
    })

  } catch (error) {
    console.error('💥 [SYNC REAL] Erro geral:', error)
    return NextResponse.json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}