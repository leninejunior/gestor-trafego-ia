import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    console.log('🔍 [CHECK META] Verificando campanhas Meta no banco...');

    // Buscar todas as conexões Meta
    const { data: connections, error: connectionsError } = await supabase
      .from('client_meta_connections')
      .select(`
        id,
        client_id,
        ad_account_id,
        account_name,
        is_active,
        created_at,
        clients(id, name)
      `);

    console.log('🔗 [CHECK META] Conexões encontradas:', connections?.length || 0);

    // Buscar todas as campanhas Meta
    const { data: campaigns, error: campaignsError } = await supabase
      .from('meta_campaigns')
      .select(`
        id,
        connection_id,
        external_id,
        name,
        status,
        objective,
        created_time,
        client_meta_connections(
          account_name,
          client_id,
          clients(name)
        )
      `);

    console.log('📊 [CHECK META] Campanhas encontradas:', campaigns?.length || 0);

    // Buscar insights de campanhas
    const { data: insights, error: insightsError } = await supabase
      .from('meta_campaign_insights')
      .select('*');

    console.log('📈 [CHECK META] Insights encontrados:', insights?.length || 0);

    return NextResponse.json({
      success: true,
      connections: {
        total: connections?.length || 0,
        data: connections || [],
        error: connectionsError
      },
      campaigns: {
        total: campaigns?.length || 0,
        data: campaigns || [],
        error: campaignsError
      },
      insights: {
        total: insights?.length || 0,
        data: insights || [],
        error: insightsError
      },
      summary: {
        totalConnections: connections?.length || 0,
        totalCampaigns: campaigns?.length || 0,
        totalInsights: insights?.length || 0,
        message: `${connections?.length || 0} conexões, ${campaigns?.length || 0} campanhas, ${insights?.length || 0} insights`
      }
    });

  } catch (error) {
    console.error('💥 [CHECK META] Erro:', error);
    return NextResponse.json({ 
      error: 'Erro interno',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}