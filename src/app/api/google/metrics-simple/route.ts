/**
 * Google Ads Metrics API - Versão Simplificada
 * Corrige erros 400 nos parâmetros
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    console.log('[Google Metrics Simple] Starting request');

    const { searchParams } = new URL(request.url);
    
    // Parâmetros com valores padrão
    const clientId = searchParams.get('clientId');
    const startDate = searchParams.get('startDate') || searchParams.get('dateFrom');
    const endDate = searchParams.get('endDate') || searchParams.get('dateTo');
    const groupBy = searchParams.get('groupBy') || 'campaign';

    console.log('[Google Metrics Simple] Params:', { clientId, startDate, endDate, groupBy });

    // Verificar configuração do Google
    const isConfigured = !!(
      process.env.GOOGLE_CLIENT_ID && 
      process.env.GOOGLE_CLIENT_SECRET && 
      process.env.GOOGLE_DEVELOPER_TOKEN &&
      !process.env.GOOGLE_CLIENT_ID.includes('your_')
    );

    if (!isConfigured) {
      return NextResponse.json(
        { 
          error: 'Google Ads não configurado',
          message: 'Configure as variáveis de ambiente do Google Ads',
          configured: false
        },
        { status: 503 }
      );
    }

    // Se não há clientId, retornar dados vazios mas válidos
    if (!clientId) {
      console.log('[Google Metrics Simple] No clientId provided, returning empty data');
      return NextResponse.json({
        error: 'Nenhum cliente selecionado',
        message: 'Selecione um cliente para ver as métricas',
        summary: {
          totalImpressions: 0,
          totalClicks: 0,
          totalConversions: 0,
          totalCost: 0,
          averageCtr: 0,
          averageCpc: 0
        },
        campaigns: [],
        totalRecords: 0,
        hasConnection: false,
        configured: true,
        requiresClientSelection: true
      });
    }

    // Verificar se temos datas
    if (!startDate || !endDate) {
      return NextResponse.json({
        error: 'Parâmetros de data obrigatórios',
        message: 'dateFrom e dateTo são obrigatórios',
        required: {
          dateFrom: 'Data inicial (YYYY-MM-DD)', 
          dateTo: 'Data final (YYYY-MM-DD)'
        },
        received: {
          clientId: clientId,
          dateFrom: startDate || 'não fornecido',
          dateTo: endDate || 'não fornecido',
          groupBy: groupBy
        }
      }, { status: 400 });
    }

    // Validar formato das datas
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return NextResponse.json(
        { 
          error: 'Formato de data inválido',
          message: 'Use o formato YYYY-MM-DD para as datas',
          examples: {
            dateFrom: '2024-10-01',
            dateTo: '2024-10-31'
          }
        },
        { status: 400 }
      );
    }

    // Verificar se as datas fazem sentido
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start > end) {
      return NextResponse.json(
        { error: 'Data inicial deve ser anterior à data final' },
        { status: 400 }
      );
    }

    // Verificar se o período não é muito longo (máximo 1 ano)
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 365) {
      return NextResponse.json(
        { error: 'Período máximo permitido é de 1 ano' },
        { status: 400 }
      );
    }

    console.log('[Google Metrics Simple] Params validated, checking connection');

    // Verificar se existe conexão Google ATIVA para este cliente
    const supabase = await createClient();
    const { data: activeConnections, error: activeConnectionsError } = await supabase
      .from('google_ads_connections')
      .select('id')
      .eq('client_id', clientId)
      .eq('status', 'active')
      .not('access_token', 'like', 'mock_%')
      .limit(1);

    if (activeConnectionsError) {
      console.error('[Google Metrics Simple] Error checking active connections:', activeConnectionsError);
      return NextResponse.json(
        { error: 'Erro ao validar conexões Google Ads' },
        { status: 500 }
      );
    }

    if (!activeConnections || activeConnections.length === 0) {
      console.log('[Google Metrics Simple] No active connection found, looking for any connection');

      // Verificar se há qualquer conexão vinculada ao cliente
      const { data: anyConnections, error: anyConnectionsError } = await supabase
        .from('google_ads_connections')
        .select('id')
        .eq('client_id', clientId)
        .limit(1);

      if (anyConnectionsError) {
        console.error('[Google Metrics Simple] Error checking fallback connections:', anyConnectionsError);
        return NextResponse.json(
          { error: 'Erro ao validar conexões Google Ads' },
          { status: 500 }
        );
      }

      if (!anyConnections || anyConnections.length === 0) {
        return NextResponse.json({
          error: 'Conexão Google Ads não encontrada',
          message: 'Conecte sua conta Google Ads primeiro',
          clientId,
          dateRange: {
            from: startDate,
            to: endDate,
            days: daysDiff
          },
          inactiveConnections: 0,
          needsReconnection: true,
          hasConnection: false,
          configured: true
        });
      }
    }

    console.log('[Google Metrics Simple] Connection found, fetching metrics');

    // Buscar métricas reais do banco
    const { data: metrics, error: metricsError } = await supabase
      .from('google_ads_metrics')
      .select(`
        *,
        google_ads_campaigns!inner(
          id,
          campaign_id,
          campaign_name,
          status,
          client_id
        )
      `)
      .eq('google_ads_campaigns.client_id', clientId)
      .gte('date', startDate)
      .lte('date', endDate)
      .limit(1000);

    if (metricsError) {
      console.error('[Google Metrics Simple] Error fetching metrics:', metricsError);
      return NextResponse.json(
        { error: 'Erro ao buscar métricas do banco de dados' },
        { status: 500 }
      );
    }

    console.log('[Google Metrics Simple] Found', metrics?.length || 0, 'metrics records');

    // Se não há dados, retornar estrutura vazia mas válida
    if (!metrics || metrics.length === 0) {
      return NextResponse.json({
        clientId,
        dateRange: {
          from: startDate,
          to: endDate,
          days: daysDiff
        },
        summary: {
          totalImpressions: 0,
          totalClicks: 0,
          totalConversions: 0,
          totalCost: 0,
          averageCtr: 0,
          averageCpc: 0
        },
        campaigns: [],
        totalRecords: 0,
        hasConnection: true,
        configured: true,
        message: 'Nenhum dado encontrado para o período selecionado'
      });
    }

    // Processar métricas
    const summary = {
      totalImpressions: metrics.reduce((sum, m) => sum + (parseInt(m.impressions) || 0), 0),
      totalClicks: metrics.reduce((sum, m) => sum + (parseInt(m.clicks) || 0), 0),
      totalConversions: metrics.reduce((sum, m) => sum + (parseFloat(m.conversions) || 0), 0),
      totalCost: metrics.reduce((sum, m) => sum + (parseFloat(m.cost) || 0), 0)
    };

    summary.averageCtr = summary.totalImpressions > 0 
      ? parseFloat(((summary.totalClicks / summary.totalImpressions) * 100).toFixed(2))
      : 0;
    
    summary.averageCpc = summary.totalClicks > 0 
      ? parseFloat((summary.totalCost / summary.totalClicks).toFixed(2))
      : 0;

    // Agrupar por campanha se solicitado
    let campaigns = [];
    if (groupBy === 'campaign') {
      const campaignMap = new Map();
      
      metrics.forEach(metric => {
        const campaign = metric.google_ads_campaigns;
        const key = campaign.id;
        
        if (!campaignMap.has(key)) {
          campaignMap.set(key, {
            id: campaign.id,
            name: campaign.campaign_name,
            status: campaign.status,
            impressions: 0,
            clicks: 0,
            conversions: 0,
            cost: 0
          });
        }
        
        const camp = campaignMap.get(key);
        camp.impressions += parseInt(metric.impressions) || 0;
        camp.clicks += parseInt(metric.clicks) || 0;
        camp.conversions += parseFloat(metric.conversions) || 0;
        camp.cost += parseFloat(metric.cost) || 0;
      });
      
      campaigns = Array.from(campaignMap.values()).map(camp => ({
        ...camp,
        ctr: camp.impressions > 0 ? parseFloat(((camp.clicks / camp.impressions) * 100).toFixed(2)) : 0,
        cpc: camp.clicks > 0 ? parseFloat((camp.cost / camp.clicks).toFixed(2)) : 0,
        cost: parseFloat(camp.cost.toFixed(2))
      }));
    }

    return NextResponse.json({
      clientId,
      dateRange: {
        from: startDate,
        to: endDate,
        days: daysDiff
      },
      summary,
      campaigns,
      totalRecords: metrics.length,
      hasConnection: true,
      configured: true,
      groupBy
    });

  } catch (error) {
    console.error('[Google Metrics Simple] Error:', error);
    return NextResponse.json(
      { 
        error: 'Falha ao carregar métricas',
        details: error.message,
        configured: true
      },
      { status: 500 }
    );
  }
}
