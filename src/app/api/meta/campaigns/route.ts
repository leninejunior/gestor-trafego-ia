import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { MetaAdsClient } from '@/lib/meta/client';
import {
  getActiveConnectionByClientAndAdAccount,
  getClientAccess,
} from '@/lib/postgres/meta-connections-repository';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');
  const adAccountId = searchParams.get('adAccountId');
  const withInsights = searchParams.get('withInsights') !== 'false'; // Default true
  const since = searchParams.get('since');
  const until = searchParams.get('until');
  
  console.log('🔍 [CAMPAIGNS API] Iniciando busca de campanhas...');
  console.log('📋 [CAMPAIGNS API] Parâmetros recebidos:', { clientId, adAccountId, withInsights, since, until });
  
  if (!clientId || !adAccountId) {
    console.log('❌ [CAMPAIGNS API] Parâmetros obrigatórios ausentes');
    return NextResponse.json({ error: 'Client ID e Ad Account ID são obrigatórios' }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    console.log('✅ [CAMPAIGNS API] Cliente Supabase criado');
    
    // Verificar autenticação do usuário (modo permissivo para debug)
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.log('⚠️ [CAMPAIGNS API] Usuário não autenticado');
      return NextResponse.json({ 
        campaigns: [],
        isTestData: false,
        message: 'Usuário não autenticado. Faça login para acessar os dados reais.'
      });
    }
    
    console.log('✅ [CAMPAIGNS API] Usuário autenticado:', user.email);

    const access = await getClientAccess(clientId, user.id);
    if (!access.clientExists || !access.hasAccess) {
      console.log('⚠️ [CAMPAIGNS API] Conexão não encontrada');
      return NextResponse.json({ 
        campaigns: [],
        isTestData: false,
        message: 'Conexão com Meta não encontrada. Conecte sua conta do Meta Ads.'
      });
    }

    // Buscar conexão do Meta para este cliente
    console.log('🔍 [CAMPAIGNS API] Buscando conexão Meta...');
    const connection = await getActiveConnectionByClientAndAdAccount(clientId, adAccountId);
    console.log('📊 [CAMPAIGNS API] Resultado da busca de conexão:', { found: Boolean(connection) });

    const accessToken = typeof connection?.access_token === 'string' ? connection.access_token : null;
    if (!accessToken) {
      console.log('⚠️ [CAMPAIGNS API] Conexão não encontrada');
      return NextResponse.json({
        campaigns: [],
        isTestData: false,
        message: 'Conexão com Meta não encontrada. Conecte sua conta do Meta Ads.'
      });
    }

    console.log('✅ [CAMPAIGNS API] Conexão encontrada, buscando campanhas reais...');

    // Buscar campanhas usando o Meta Ads Client
    try {
      const metaClient = new MetaAdsClient(accessToken);
      console.log('🔗 [CAMPAIGNS API] Cliente Meta criado, fazendo requisição...');
      
      const campaigns = await metaClient.getCampaigns(adAccountId);
      console.log('✅ [CAMPAIGNS API] Campanhas reais obtidas:', campaigns?.length || 0);
      
      // Verificar se há campanhas
      if (!campaigns || campaigns.length === 0) {
        console.log('📭 [CAMPAIGNS API] Nenhuma campanha encontrada na conta');
        return NextResponse.json({ 
          campaigns: [],
          isTestData: false,
          message: 'Nenhuma campanha encontrada na conta Meta Ads. Verifique se a conta conectada tem campanhas ativas ou reconecte com uma conta diferente.'
        });
      }

      // Buscar insights para cada campanha se solicitado
      let campaignsWithInsights = campaigns;
      if (withInsights) {
        console.log('📊 [CAMPAIGNS API] Buscando insights das campanhas...');
        
        // Usar datas do filtro ou padrão de 30 dias
        const dateRange = since && until ? { since, until } : undefined;
        
        campaignsWithInsights = await Promise.all(
          campaigns.map(async (campaign: any) => {
            try {
              const insights = await metaClient.getCampaignInsights(campaign.id, dateRange);
              const insightData = insights?.[0] || {};
              return {
                ...campaign,
                insights: {
                  impressions: insightData.impressions || '0',
                  clicks: insightData.clicks || '0',
                  spend: insightData.spend || '0',
                  reach: insightData.reach || '0',
                  ctr: insightData.ctr || '0',
                  cpc: insightData.cpc || '0',
                  cpm: insightData.cpm || '0',
                  frequency: insightData.frequency || '0',
                  actions: insightData.actions || [],
                  cost_per_action_type: insightData.cost_per_action_type || []
                }
              };
            } catch (insightError) {
              console.log(`⚠️ [CAMPAIGNS API] Erro ao buscar insights da campanha ${campaign.id}:`, insightError);
              return {
                ...campaign,
                insights: null
              };
            }
          })
        );
        console.log('✅ [CAMPAIGNS API] Insights carregados');
      }

      return NextResponse.json({ campaigns: campaignsWithInsights, isTestData: false });
    } catch (metaError: any) {
      console.log('❌ [CAMPAIGNS API] Erro ao buscar campanhas reais:', metaError);
      
      // Verificar se é erro de token expirado
      const errorMessage = metaError.message || metaError.toString().toLowerCase();
      
      if (errorMessage && (
        errorMessage.includes('token') || 
        errorMessage.includes('session') ||
        errorMessage.includes('access') ||
        errorMessage.includes('authentication') ||
        errorMessage.includes('invalid') ||
        errorMessage.includes('expired') ||
        errorMessage.includes('400') ||
        errorMessage.includes('401') ||
        errorMessage.includes('403') ||
        errorMessage.includes('The session has been invalidated because the user changed their password or Facebook has changed the session for security reasons')
      )) {
        console.log('🔐 [CAMPAIGNS API] Erro possivelmente relacionado a token expirado');
        return NextResponse.json({ 
          campaigns: [],
          isTestData: false,
          requiresReconnection: true,
          errorType: 'TOKEN_EXPIRED',
          message: 'Sua conexão com o Meta Ads expirou. Por favor, reconecte sua conta para continuar acessando os dados.',
          detailedMessage: 'O token de acesso do Facebook expirou ou foi invalidado. Isso acontece normalmente por motivos de segurança. Clique em "Reconectar Conta" para restaurar o acesso.',
          action: 'RECONNECT',
          actionLabel: 'Reconectar Conta'
        });
      }
      
      console.log('❌ [CAMPAIGNS API] Erro genérico ao buscar campanhas reais');
      
      return NextResponse.json({ 
        campaigns: [],
        isTestData: false,
        message: 'Erro ao buscar campanhas reais. Tente novamente ou reconecte sua conta.',
        error: metaError.message
      });
    }

  } catch (error) {
    console.error('💥 [CAMPAIGNS API] Erro geral:', error);
    
    return NextResponse.json({ 
      campaigns: [],
      isTestData: false,
      message: 'Erro interno ao buscar campanhas. Tente novamente mais tarde.',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}
