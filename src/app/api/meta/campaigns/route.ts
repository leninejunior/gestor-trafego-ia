import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { MetaAdsClient } from '@/lib/meta/client';

// Dados de teste para campanhas
const testCampaigns = [
  {
    id: 'test_campaign_1',
    name: 'Campanha de Teste - Vendas Q4',
    status: 'ACTIVE',
    objective: 'CONVERSIONS',
    spend: '1250.50',
    impressions: '45000',
    clicks: '890',
    ctr: '1.98',
    cpc: '1.40',
    created_time: '2024-01-15T10:00:00Z'
  },
  {
    id: 'test_campaign_2',
    name: 'Campanha de Teste - Brand Awareness',
    status: 'ACTIVE',
    objective: 'BRAND_AWARENESS',
    spend: '850.75',
    impressions: '32000',
    clicks: '640',
    ctr: '2.00',
    cpc: '1.33',
    created_time: '2024-01-10T14:30:00Z'
  },
  {
    id: 'test_campaign_3',
    name: 'Campanha de Teste - Lead Generation',
    status: 'PAUSED',
    objective: 'LEAD_GENERATION',
    spend: '2100.25',
    impressions: '78000',
    clicks: '1560',
    ctr: '2.00',
    cpc: '1.35',
    created_time: '2024-01-05T09:15:00Z'
  }
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');
  const adAccountId = searchParams.get('adAccountId');
  
  console.log('🔍 [CAMPAIGNS API] Iniciando busca de campanhas...');
  console.log('📋 [CAMPAIGNS API] Parâmetros recebidos:', { clientId, adAccountId });
  
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
      console.log('⚠️ [CAMPAIGNS API] Usuário não autenticado, retornando dados de teste:', userError);
      return NextResponse.json({ 
        campaigns: testCampaigns,
        isTestData: true,
        message: 'Usuário não autenticado. Exibindo dados de teste.'
      });
    }
    
    console.log('✅ [CAMPAIGNS API] Usuário autenticado:', user.email);

    // Buscar conexão do Meta para este cliente
    console.log('🔍 [CAMPAIGNS API] Buscando conexão Meta...');
    const { data: connection, error: connectionError } = await supabase
      .from('client_meta_connections')
      .select('*')
      .eq('client_id', clientId)
      .eq('ad_account_id', adAccountId)
      .eq('is_active', true)
      .single();

    console.log('📊 [CAMPAIGNS API] Resultado da busca de conexão:', { connection, connectionError });

    if (connectionError || !connection) {
      console.log('⚠️ [CAMPAIGNS API] Conexão não encontrada, retornando dados de teste');
      console.log('🧪 [CAMPAIGNS API] Dados de teste:', testCampaigns);
      
      return NextResponse.json({ 
        campaigns: testCampaigns,
        isTestData: true,
        message: 'Conexão com Meta não encontrada. Exibindo dados de teste.'
      });
    }

    console.log('✅ [CAMPAIGNS API] Conexão encontrada, buscando campanhas reais...');

    // Buscar campanhas usando o Meta Ads Client
    try {
      const metaClient = new MetaAdsClient(connection.access_token);
      console.log('🔗 [CAMPAIGNS API] Cliente Meta criado, fazendo requisição...');
      
      const campaigns = await metaClient.getCampaigns(adAccountId);
      console.log('✅ [CAMPAIGNS API] Campanhas reais obtidas:', campaigns);

      return NextResponse.json({ campaigns, isTestData: false });
    } catch (metaError) {
      console.log('❌ [CAMPAIGNS API] Erro ao buscar campanhas reais:', metaError);
      console.log('🧪 [CAMPAIGNS API] Retornando dados de teste devido ao erro');
      
      return NextResponse.json({ 
        campaigns: testCampaigns,
        isTestData: true,
        message: 'Erro ao buscar campanhas reais. Exibindo dados de teste.',
        error: metaError
      });
    }

  } catch (error) {
    console.error('💥 [CAMPAIGNS API] Erro geral:', error);
    console.log('🧪 [CAMPAIGNS API] Retornando dados de teste devido ao erro geral');
    
    return NextResponse.json({ 
      campaigns: testCampaigns,
      isTestData: true,
      message: 'Erro interno. Exibindo dados de teste.',
      error: error
    });
  }
}