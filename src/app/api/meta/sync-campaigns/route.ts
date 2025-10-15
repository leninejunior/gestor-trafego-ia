import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { MetaAdsClient } from '@/lib/meta/client';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { clientId } = await request.json();
    
    console.log('🔄 [SYNC CAMPAIGNS] Iniciando sincronização para cliente:', clientId);

    if (!clientId) {
      return NextResponse.json({ error: 'Client ID é obrigatório' }, { status: 400 });
    }

    // Buscar conexões Meta ativas para este cliente
    const { data: connections, error: connectionsError } = await supabase
      .from('client_meta_connections')
      .select('*')
      .eq('client_id', clientId)
      .eq('is_active', true);

    console.log('🔗 [SYNC CAMPAIGNS] Conexões encontradas:', connections?.length || 0);

    if (connectionsError || !connections || connections.length === 0) {
      return NextResponse.json({ 
        error: 'Nenhuma conexão Meta ativa encontrada para este cliente',
        needsConnection: true 
      }, { status: 404 });
    }

    let totalCampaignsSynced = 0;
    const syncResults = [];

    // Para cada conexão, sincronizar campanhas
    for (const connection of connections) {
      try {
        console.log(`📡 [SYNC CAMPAIGNS] Sincronizando conta: ${connection.account_name}`);
        
        const metaClient = new MetaAdsClient(connection.access_token);
        const campaigns = await metaClient.getCampaigns(connection.ad_account_id);
        
        console.log(`📊 [SYNC CAMPAIGNS] ${campaigns.length} campanhas encontradas na conta ${connection.account_name}`);

        // Salvar cada campanha no banco
        for (const campaign of campaigns) {
          const { data: savedCampaign, error: saveError } = await supabase
            .from('meta_campaigns')
            .upsert({
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
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'connection_id,external_id'
            });

          if (saveError) {
            console.error(`❌ [SYNC CAMPAIGNS] Erro ao salvar campanha ${campaign.name}:`, saveError);
          } else {
            console.log(`✅ [SYNC CAMPAIGNS] Campanha salva: ${campaign.name}`);
            totalCampaignsSynced++;
          }
        }

        syncResults.push({
          accountName: connection.account_name,
          accountId: connection.ad_account_id,
          campaignsFound: campaigns.length,
          success: true
        });

      } catch (connectionError) {
        console.error(`❌ [SYNC CAMPAIGNS] Erro na conta ${connection.account_name}:`, connectionError);
        syncResults.push({
          accountName: connection.account_name,
          accountId: connection.ad_account_id,
          campaignsFound: 0,
          success: false,
          error: connectionError instanceof Error ? connectionError.message : 'Erro desconhecido'
        });
      }
    }

    console.log(`🎯 [SYNC CAMPAIGNS] Sincronização concluída: ${totalCampaignsSynced} campanhas`);

    return NextResponse.json({
      success: true,
      totalCampaignsSynced,
      connectionsProcessed: connections.length,
      results: syncResults,
      message: `${totalCampaignsSynced} campanhas sincronizadas com sucesso!`
    });

  } catch (error) {
    console.error('💥 [SYNC CAMPAIGNS] Erro geral:', error);
    return NextResponse.json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}