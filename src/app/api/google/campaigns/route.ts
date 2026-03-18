import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');
  const connectionId = searchParams.get('connectionId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  
  console.log('🔍 [GOOGLE CAMPAIGNS API] Iniciando busca de campanhas...');
  console.log('📋 [GOOGLE CAMPAIGNS API] Parâmetros:', { clientId, connectionId, startDate, endDate });
  
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

    // Buscar conexões ativas (pode haver mais de uma por cliente)
    const { data: activeConnections, error: activeConnectionsError } = await supabase
      .from('google_ads_connections')
      .select('id, customer_id, status')
      .eq('client_id', clientId)
      .eq('status', 'active')
      .order('updated_at', { ascending: false });

    if (activeConnectionsError) {
      console.error('❌ [GOOGLE CAMPAIGNS API] Erro ao buscar conexões ativas:', activeConnectionsError);
      return NextResponse.json({
        error: 'Erro ao validar conexões Google Ads',
        details: activeConnectionsError.message
      }, { status: 500 });
    }

    // Se não encontrar conexão ativa, tenta buscar qualquer conexão
    let connectionsToUse = activeConnections || [];
    if (connectionsToUse.length === 0) {
      console.log('⚠️ [GOOGLE CAMPAIGNS API] Nenhuma conexão ativa encontrada, buscando qualquer conexão...');
      const { data: anyConnections, error: anyConnectionsError } = await supabase
        .from('google_ads_connections')
        .select('id, customer_id, status')
        .eq('client_id', clientId)
        .order('updated_at', { ascending: false });

      if (anyConnectionsError) {
        console.error('❌ [GOOGLE CAMPAIGNS API] Erro ao buscar conexões fallback:', anyConnectionsError);
        return NextResponse.json({
          error: 'Erro ao validar conexões Google Ads',
          details: anyConnectionsError.message
        }, { status: 500 });
      }

      if (anyConnections && anyConnections.length > 0) {
        console.log('✅ [GOOGLE CAMPAIGNS API] Conexões fallback encontradas:', anyConnections.length);
        connectionsToUse = anyConnections;
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
      .eq('client_id', clientId);

    // Filtrar por conexão específica se fornecido
    if (connectionId) {
      query = query.eq('connection_id', connectionId);
    } else {
      // Sem connectionId explícito: buscar dados de todas as conexões disponíveis do cliente
      const connectionIds = connectionsToUse.map(conn => conn.id);
      query = query.in('connection_id', connectionIds);
    }

    query = query.order('created_at', { ascending: false });

    const { data: campaigns, error: campaignsError } = await query;

    if (campaignsError) {
      console.error('❌ [GOOGLE CAMPAIGNS API] Erro ao buscar campanhas:', campaignsError);
      return NextResponse.json({
        error: 'Erro ao buscar campanhas',
        details: campaignsError.message
      }, { status: 500 });
    }

    console.log('✅ [GOOGLE CAMPAIGNS API] Campanhas encontradas:', campaigns?.length || 0);

    // NOTA: Os valores já vêm na moeda configurada na conta Google Ads (geralmente BRL para contas brasileiras)
    // A API do Google Ads retorna valores em micros que são convertidos pelo client.ts
    // NÃO aplicamos conversão de câmbio aqui - os valores já estão na moeda correta

    // Mapear dados para o formato esperado pelo frontend com métricas
    const mappedCampaigns = (campaigns || []).map(campaign => {
      // Filtrar métricas por data se fornecido
      let metrics = campaign.metrics || [];
      if (startDate && endDate) {
        metrics = metrics.filter((metric: any) => {
          const metricDate = metric.date;
          return metricDate >= startDate && metricDate <= endDate;
        });
        console.log(`📅 [GOOGLE CAMPAIGNS API] Campanha ${campaign.campaign_name}: ${metrics.length} métricas após filtro de data`);
      }

      // Calcular métricas agregadas
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

      // Calcular médias (valores já estão na moeda da conta - BRL para contas brasileiras)
      const avgMetrics = {
        impressions: totalMetrics.impressions,
        clicks: totalMetrics.clicks,
        conversions: totalMetrics.conversions,
        cost: totalMetrics.cost, // Já está na moeda da conta (BRL)
        ctr: metrics.length > 0 ? totalMetrics.ctr / metrics.length : 0,
        cpc: totalMetrics.clicks > 0 ? totalMetrics.cost / totalMetrics.clicks : 0, // Já está na moeda da conta (BRL)
        cpa: totalMetrics.conversions > 0 ? totalMetrics.cost / totalMetrics.conversions : 0, // Já está na moeda da conta (BRL)
        roas: totalMetrics.cost > 0 ? totalMetrics.conversions / totalMetrics.cost : 0
      };

      console.log('💰 [GOOGLE CAMPAIGNS API] Métricas calculadas (moeda da conta):', {
        campaignName: campaign.campaign_name,
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
