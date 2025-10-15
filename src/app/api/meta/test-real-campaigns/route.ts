import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { MetaAdsClient } from '@/lib/meta/client';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    console.log('🧪 [TEST REAL CAMPAIGNS] Testando campanhas reais para cliente:', clientId);

    if (!clientId) {
      return NextResponse.json({ error: 'Client ID é obrigatório' }, { status: 400 });
    }

    // Buscar conexões Meta ativas
    const { data: connections, error: connectionsError } = await supabase
      .from('client_meta_connections')
      .select('*')
      .eq('client_id', clientId)
      .eq('is_active', true);

    console.log('🔗 [TEST REAL CAMPAIGNS] Conexões encontradas:', connections?.length || 0);

    if (connectionsError || !connections || connections.length === 0) {
      return NextResponse.json({ 
        error: 'Nenhuma conexão Meta encontrada',
        connections: 0
      });
    }

    const results = [];

    // Testar cada conexão
    for (const connection of connections) {
      try {
        console.log(`📡 [TEST REAL CAMPAIGNS] Testando conta: ${connection.account_name} (${connection.ad_account_id})`);
        
        const metaClient = new MetaAdsClient(connection.access_token);
        
        // Tentar buscar campanhas do Meta
        const campaigns = await metaClient.getCampaigns(connection.ad_account_id);
        
        console.log(`📊 [TEST REAL CAMPAIGNS] ${campaigns.length} campanhas encontradas na conta ${connection.account_name}`);

        results.push({
          connectionId: connection.id,
          accountName: connection.account_name,
          accountId: connection.ad_account_id,
          campaignsFound: campaigns.length,
          campaigns: campaigns.map(campaign => ({
            id: campaign.id,
            name: campaign.name,
            status: campaign.status,
            objective: campaign.objective,
            created_time: campaign.created_time
          })),
          success: true
        });

      } catch (connectionError) {
        console.error(`❌ [TEST REAL CAMPAIGNS] Erro na conta ${connection.account_name}:`, connectionError);
        
        results.push({
          connectionId: connection.id,
          accountName: connection.account_name,
          accountId: connection.ad_account_id,
          campaignsFound: 0,
          campaigns: [],
          success: false,
          error: connectionError instanceof Error ? connectionError.message : 'Erro desconhecido'
        });
      }
    }

    const totalCampaigns = results.reduce((sum, result) => sum + result.campaignsFound, 0);

    console.log(`🎯 [TEST REAL CAMPAIGNS] Total de campanhas encontradas: ${totalCampaigns}`);

    return NextResponse.json({
      success: true,
      totalConnections: connections.length,
      totalCampaigns,
      results,
      message: `Teste concluído: ${totalCampaigns} campanhas encontradas em ${connections.length} conexões`
    });

  } catch (error) {
    console.error('💥 [TEST REAL CAMPAIGNS] Erro geral:', error);
    return NextResponse.json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}