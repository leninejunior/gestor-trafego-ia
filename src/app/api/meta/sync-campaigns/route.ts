import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { MetaAdsClient } from '@/lib/meta/client';
import {
  getClientAccess,
  listActiveConnectionsByClientId,
} from '@/lib/postgres/meta-connections-repository';
import { upsertMetaCampaign } from '@/lib/postgres/meta-sync-repository';

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

    const access = await getClientAccess(clientId, user.id);
    if (!access.clientExists) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
    }

    if (!access.hasAccess) {
      return NextResponse.json({ error: 'Sem permissão para este cliente' }, { status: 403 });
    }

    // Buscar conexões Meta ativas para este cliente
    const connections = await listActiveConnectionsByClientId(clientId);

    console.log('🔗 [SYNC CAMPAIGNS] Conexões encontradas:', connections.length);

    if (connections.length === 0) {
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
        const accountName = typeof connection.account_name === 'string'
          ? connection.account_name
          : 'Conta sem nome';
        const accessToken = typeof connection.access_token === 'string' ? connection.access_token : null;
        const adAccountId = typeof connection.ad_account_id === 'string' ? connection.ad_account_id : null;
        const connectionId = typeof connection.id === 'string' ? connection.id : null;

        if (!accessToken || !adAccountId || !connectionId) {
          syncResults.push({
            accountName,
            accountId: adAccountId ?? 'unknown',
            campaignsFound: 0,
            success: false,
            error: 'Conexão inválida ou incompleta',
          });
          continue;
        }

        console.log(`📡 [SYNC CAMPAIGNS] Sincronizando conta: ${accountName}`);
        
        const metaClient = new MetaAdsClient(accessToken);
        const campaigns = await metaClient.getCampaigns(adAccountId);
        
        console.log(`📊 [SYNC CAMPAIGNS] ${campaigns.length} campanhas encontradas na conta ${accountName}`);

        // Salvar cada campanha no banco
        for (const campaign of campaigns) {
          try {
            await upsertMetaCampaign(connectionId, campaign);
            totalCampaignsSynced++;
            console.log(`✅ [SYNC CAMPAIGNS] Campanha salva: ${campaign.name}`);
          } catch (saveError) {
            console.error(`❌ [SYNC CAMPAIGNS] Erro ao salvar campanha ${campaign.name}:`, saveError);
          }
        }

        syncResults.push({
          accountName,
          accountId: adAccountId,
          campaignsFound: campaigns.length,
          success: true
        });

      } catch (connectionError) {
        const accountName = typeof connection.account_name === 'string'
          ? connection.account_name
          : 'Conta sem nome';
        const adAccountId = typeof connection.ad_account_id === 'string'
          ? connection.ad_account_id
          : 'unknown';
        console.error(`❌ [SYNC CAMPAIGNS] Erro na conta ${accountName}:`, connectionError);
        syncResults.push({
          accountName,
          accountId: adAccountId,
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
