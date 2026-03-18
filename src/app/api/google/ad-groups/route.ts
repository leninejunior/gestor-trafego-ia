import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getGoogleAdsClient } from '@/lib/google/client';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');
  const campaignId = searchParams.get('campaignId'); // ID externo da campanha no Google Ads
  const connectionId = searchParams.get('connectionId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  
  console.log('🔍 [GOOGLE AD GROUPS API] Iniciando busca de ad groups...');
  console.log('📋 [GOOGLE AD GROUPS API] Parâmetros:', { clientId, campaignId, connectionId, startDate, endDate });
  
  if (!clientId || !campaignId) {
    return NextResponse.json({ 
      error: 'Client ID e Campaign ID são obrigatórios' 
    }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    
    // Verificar autenticação
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ 
        adGroups: [],
        message: 'Usuário não autenticado'
      }, { status: 401 });
    }

    // Buscar conexão ativa
    let query = supabase
      .from('google_ads_connections')
      .select('*')
      .eq('client_id', clientId)
      .eq('status', 'active');
    
    if (connectionId) {
      query = query.eq('id', connectionId);
    }
    
    const { data: connection, error: connError } = await query.maybeSingle();

    if (connError || !connection) {
      console.log('⚠️ [GOOGLE AD GROUPS API] Nenhuma conexão ativa encontrada');
      return NextResponse.json({
        adGroups: [],
        message: 'Nenhuma conexão Google Ads ativa encontrada'
      });
    }

    // Buscar campanha interna pelo campaign_id externo
    const { data: campaign } = await supabase
      .from('google_ads_campaigns')
      .select('id, campaign_id')
      .eq('connection_id', connection.id)
      .eq('campaign_id', campaignId)
      .maybeSingle();

    if (!campaign) {
      return NextResponse.json({
        adGroups: [],
        message: 'Campanha não encontrada'
      });
    }

    // Buscar ad groups diretamente da API do Google Ads
    const googleClient = getGoogleAdsClient({
      accessToken: connection.access_token,
      refreshToken: connection.refresh_token,
      developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
      customerId: connection.customer_id,
      connectionId: connection.id,
    });

    // Construir query GAQL para ad groups
    const dateFilter = startDate && endDate
      ? `AND segments.date BETWEEN '${startDate}' AND '${endDate}'`
      : '';

    const gaqlQuery = `
      SELECT
        ad_group.id,
        ad_group.name,
        ad_group.status,
        ad_group.type,
        ad_group.cpc_bid_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.conversions,
        metrics.cost_micros,
        metrics.ctr,
        metrics.average_cpc,
        metrics.cost_per_conversion
      FROM ad_group
      WHERE campaign.id = ${campaignId}
        AND ad_group.status != 'REMOVED'
        ${dateFilter}
      ORDER BY ad_group.id
    `;

    console.log('🔍 [GOOGLE AD GROUPS API] Executando query GAQL...');
    
    const response = await googleClient.executeQuery(gaqlQuery);
    
    if (!response.results || response.results.length === 0) {
      console.log('⚠️ [GOOGLE AD GROUPS API] Nenhum ad group encontrado');
      return NextResponse.json({
        adGroups: [],
        count: 0
      });
    }

    // Mapear resultados
    const adGroups = response.results.map((result: any) => {
      const adGroup = result.adGroup;
      const metrics = result.metrics || {};
      
      const costMicros = parseInt(metrics.costMicros || '0');
      const clicks = parseInt(metrics.clicks || '0');
      const conversions = parseFloat(metrics.conversions || '0');
      const cost = costMicros / 1000000;
      
      return {
        id: adGroup.id,
        ad_group_id: adGroup.id,
        name: adGroup.name,
        status: adGroup.status,
        type: adGroup.type,
        cpc_bid_micros: adGroup.cpcBidMicros,
        metrics: {
          impressions: parseInt(metrics.impressions || '0'),
          clicks,
          conversions,
          cost,
          ctr: parseFloat(metrics.ctr || '0') * 100,
          cpc: clicks > 0 ? cost / clicks : 0,
          cpa: conversions > 0 ? cost / conversions : 0,
        }
      };
    });

    console.log(`✅ [GOOGLE AD GROUPS API] ${adGroups.length} ad groups encontrados`);

    // Salvar/atualizar ad groups no banco (opcional, para cache)
    for (const adGroup of adGroups) {
      await supabase
        .from('google_ads_ad_groups')
        .upsert({
          client_id: clientId,
          connection_id: connection.id,
          campaign_id: campaign.id,
          ad_group_id: adGroup.ad_group_id,
          ad_group_name: adGroup.name,
          status: adGroup.status,
          type: adGroup.type,
          cpc_bid_micros: adGroup.cpc_bid_micros,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'connection_id,ad_group_id'
        });
    }

    return NextResponse.json({
      adGroups,
      count: adGroups.length
    });

  } catch (error) {
    console.error('💥 [GOOGLE AD GROUPS API] Erro:', error);
    return NextResponse.json({ 
      error: 'Erro ao buscar ad groups',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
