/**
 * Endpoint de teste para buscar campanhas diretamente
 * GET /api/google/test-campaigns?connectionId=xxx
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GoogleAdsClient } from '@/lib/google/client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const connectionId = searchParams.get('connectionId');

    if (!connectionId) {
      return NextResponse.json(
        { error: 'connectionId é obrigatório' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Buscar conexão
    const { data: connection, error: connError } = await supabase
      .from('google_ads_connections')
      .select('*')
      .eq('id', connectionId)
      .single();

    if (connError || !connection) {
      return NextResponse.json(
        { error: 'Conexão não encontrada' },
        { status: 404 }
      );
    }

    console.log('[Test Campaigns] Conexão encontrada:', {
      id: connection.id,
      customer_id: connection.customer_id,
      status: connection.status,
    });

    // Criar client
    const client = new GoogleAdsClient({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      developerToken: process.env.GOOGLE_DEVELOPER_TOKEN!,
      refreshToken: connection.refresh_token,
      customerId: connection.customer_id,
      connectionId: connection.id,
    });

    console.log('[Test Campaigns] Buscando campanhas...');

    // Buscar campanhas
    const campaigns = await client.getCampaigns();

    console.log('[Test Campaigns] Campanhas encontradas:', campaigns.length);

    return NextResponse.json({
      success: true,
      connectionId: connection.id,
      customerId: connection.customer_id,
      campaignsCount: campaigns.length,
      campaigns: campaigns.map(c => ({
        id: c.id,
        name: c.name,
        status: c.status,
        budget: c.budget,
        impressions: c.metrics.impressions,
        clicks: c.metrics.clicks,
        cost: c.metrics.cost,
      })),
    });

  } catch (error) {
    console.error('[Test Campaigns] Erro:', error);
    
    return NextResponse.json(
      { 
        error: 'Erro ao buscar campanhas',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
