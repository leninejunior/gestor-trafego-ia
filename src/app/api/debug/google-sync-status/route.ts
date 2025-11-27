/**
 * Debug route to check Google Ads sync status
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json({ error: 'clientId é obrigatório' }, { status: 400 });
    }

    const supabase = await createClient();

    // 1. Verificar se o cliente existe
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name, org_id')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json({
        error: 'Cliente não encontrado',
        clientId,
        details: clientError
      }, { status: 404 });
    }

    // 2. Verificar conexões Google Ads
    const { data: connections, error: connectionsError } = await supabase
      .from('google_ads_connections')
      .select('*')
      .eq('client_id', clientId);

    // 3. Verificar campanhas sincronizadas
    const { data: campaigns, error: campaignsError } = await supabase
      .from('google_campaigns')
      .select('*')
      .eq('client_id', clientId);

    // 4. Verificar logs de sincronização
    const { data: syncLogs, error: syncLogsError } = await supabase
      .from('google_ads_sync_logs')
      .select(`
        *,
        google_ads_connections!inner(client_id)
      `)
      .eq('google_ads_connections.client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(5);

    // 5. Verificar métricas
    let metricsCount = 0;
    if (campaigns && campaigns.length > 0) {
      const campaignIds = campaigns.map(c => c.id);
      const { count } = await supabase
        .from('google_ads_metrics')
        .select('*', { count: 'exact', head: true })
        .in('campaign_id', campaignIds);
      
      metricsCount = count || 0;
    }

    return NextResponse.json({
      success: true,
      client: {
        id: client.id,
        name: client.name,
        org_id: client.org_id
      },
      connections: {
        total: connections?.length || 0,
        active: connections?.filter(c => c.status === 'active').length || 0,
        data: connections || [],
        error: connectionsError
      },
      campaigns: {
        total: campaigns?.length || 0,
        data: campaigns || [],
        error: campaignsError
      },
      metrics: {
        total: metricsCount
      },
      syncLogs: {
        total: syncLogs?.length || 0,
        recent: syncLogs || [],
        error: syncLogsError
      },
      diagnosis: {
        hasConnection: (connections?.length || 0) > 0,
        hasActiveCampaigns: (campaigns?.length || 0) > 0,
        hasMetrics: metricsCount > 0,
        lastSyncStatus: syncLogs?.[0]?.status || 'never_synced',
        lastSyncError: syncLogs?.[0]?.error_message || null
      }
    });

  } catch (error) {
    console.error('[Debug Google Sync] Error:', error);
    return NextResponse.json({
      error: 'Erro ao verificar status de sincronização',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
