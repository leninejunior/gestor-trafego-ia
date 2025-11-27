import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');
  const connectionId = searchParams.get('connectionId');
  
  console.log('🔍 [GOOGLE CAMPAIGNS API] Iniciando busca de campanhas...');
  console.log('📋 [GOOGLE CAMPAIGNS API] Parâmetros:', { clientId, connectionId });
  
  if (!clientId) {
    return NextResponse.json({ error: 'Client ID é obrigatório' }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    
    // Verificar autenticação
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ 
        campaigns: [],
        message: 'Usuário não autenticado'
      }, { status: 401 });
    }
    
    console.log('✅ [GOOGLE CAMPAIGNS API] Usuário autenticado:', user.email);

    // Verificar se há conexão ativa primeiro
    const { data: activeConnection } = await supabase
      .from('google_ads_connections')
      .select('id, customer_id, status')
      .eq('client_id', clientId)
      .eq('status', 'active')
      .maybeSingle();
    
    // Se não encontrar conexão ativa, tenta buscar qualquer conexão
    let connectionToUse = activeConnection;
    if (!activeConnection) {
      console.log('⚠️ [GOOGLE CAMPAIGNS API] Nenhuma conexão ativa encontrada, buscando qualquer conexão...');
      const { data: anyConnection } = await supabase
        .from('google_ads_connections')
        .select('id, customer_id, status')
        .eq('client_id', clientId)
        .maybeSingle();
      
      if (anyConnection) {
        console.log('✅ [GOOGLE CAMPAIGNS API] Conexão encontrada (não ativa):', anyConnection.id);
        connectionToUse = anyConnection;
      } else {
        console.log('⚠️ [GOOGLE CAMPAIGNS API] Nenhuma conexão encontrada');
        return NextResponse.json({
          campaigns: [],
          message: 'Nenhuma conexão Google Ads encontrada. Conecte sua conta.',
          needsReconnection: true
        });
      }
    }

    // Buscar campanhas sincronizadas do banco com métricas
    let query = supabase
      .from('google_ads_campaigns')
      .select(`
        *,
        connection:google_ads_connections(customer_id),
        metrics:google_ads_metrics(
          impressions,
          clicks,
          conversions,
          cost,
          ctr,
          cpc,
          cpa,
          roas,
          date
        )
      `)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    // Filtrar por conexão específica se fornecido
    if (connectionId) {
      query = query.eq('connection_id', connectionId);
    } else {
      // Se não especificou, usar a conexão encontrada (ativa ou não)
      query = query.eq('connection_id', connectionToUse.id);
    }

    const { data: campaigns, error: campaignsError } = await query;

    if (campaignsError) {
      console.error('❌ [GOOGLE CAMPAIGNS API] Erro ao buscar campanhas:', campaignsError);
      return NextResponse.json({
        error: 'Erro ao buscar campanhas',
        details: campaignsError.message
      }, { status: 500 });
    }

    console.log('✅ [GOOGLE CAMPAIGNS API] Campanhas encontradas:', campaigns?.length || 0);

    // Taxa de conversão USD para BRL (aproximada - pode ser dinâmica no futuro)
    const USD_TO_BRL_RATE = 5.8; // Taxa de conversão fixa para exemplo

    console.log('🔄 [CONVERSÃO] Iniciando conversão de USD para BRL com taxa:', USD_TO_BRL_RATE);

    // Mapear dados para o formato esperado pelo frontend com métricas
    const mappedCampaigns = (campaigns || []).map(campaign => {
      // Calcular métricas agregadas
      const metrics = campaign.metrics || [];
      const totalMetrics = metrics.reduce((acc: any, metric: any) => ({
        impressions: acc.impressions + (parseInt(metric.impressions) || 0),
        clicks: acc.clicks + (parseInt(metric.clicks) || 0),
        conversions: acc.conversions + (parseFloat(metric.conversions) || 0),
        cost: acc.cost + (parseFloat(metric.cost) || 0),
        ctr: acc.ctr + (parseFloat(metric.ctr) || 0),
        cpc: acc.cpc + (parseFloat(metric.cpc) || 0),
        cpa: acc.cpa + (parseFloat(metric.cpa) || 0),
        roas: acc.roas + (parseFloat(metric.roas) || 0)
      }), {
        impressions: 0,
        clicks: 0,
        conversions: 0,
        cost: 0,
        ctr: 0,
        cpc: 0,
        cpa: 0,
        roas: 0
      });

      console.log('💵 [CONVERSÃO] Valores originais (USD):', {
        cost: totalMetrics.cost,
        cpc: totalMetrics.clicks > 0 ? totalMetrics.cost / totalMetrics.clicks : 0,
        cpa: totalMetrics.conversions > 0 ? totalMetrics.cost / totalMetrics.conversions : 0
      });

      // Calcular médias e converter para BRL
      const avgMetrics = {
        impressions: totalMetrics.impressions,
        clicks: totalMetrics.clicks,
        conversions: totalMetrics.conversions,
        cost: totalMetrics.cost * USD_TO_BRL_RATE, // Converter USD para BRL
        ctr: metrics.length > 0 ? totalMetrics.ctr / metrics.length : 0,
        cpc: totalMetrics.clicks > 0 ? (totalMetrics.cost * USD_TO_BRL_RATE) / totalMetrics.clicks : 0, // Converter USD para BRL
        cpa: totalMetrics.conversions > 0 ? (totalMetrics.cost * USD_TO_BRL_RATE) / totalMetrics.conversions : 0, // Converter USD para BRL
        roas: totalMetrics.cost > 0 ? totalMetrics.conversions / totalMetrics.cost : 0
      };

      console.log('💰 [CONVERSÃO] Valores convertidos (BRL):', {
        cost: avgMetrics.cost,
        cpc: avgMetrics.cpc,
        cpa: avgMetrics.cpa
      });

      return {
        id: campaign.id,
        campaign_id: campaign.campaign_id,
        name: campaign.campaign_name, // Mapear campaign_name para name
        status: campaign.status,
        budget_amount_micros: campaign.budget_amount ? campaign.budget_amount * 1000000 : undefined, // Converter para micros
        created_at: campaign.created_at,
        updated_at: campaign.updated_at,
        connection: campaign.connection,
        metrics: avgMetrics,
        start_date: campaign.start_date,
        end_date: campaign.end_date
      };
    });

    return NextResponse.json({
      campaigns: mappedCampaigns,
      count: mappedCampaigns.length
    });

  } catch (error) {
    console.error('💥 [GOOGLE CAMPAIGNS API] Erro geral:', error);
    return NextResponse.json({ 
      error: 'Erro interno ao buscar campanhas',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
