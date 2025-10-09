import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { MetaAdsClient } from '@/lib/meta/client';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');
  const campaignId = searchParams.get('campaignId');
  const since = searchParams.get('since');
  const until = searchParams.get('until');
  
  if (!clientId || !campaignId) {
    return NextResponse.json({ error: 'Client ID e Campaign ID são obrigatórios' }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    
    // Verificar autenticação do usuário
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Buscar conexão do Meta para este cliente
    const { data: connection, error: connectionError } = await supabase
      .from('client_meta_connections')
      .select('*')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .single();

    if (connectionError || !connection) {
      return NextResponse.json({ error: 'Conexão com Meta não encontrada' }, { status: 404 });
    }

    // Buscar insights usando o Meta Ads Client
    const metaClient = new MetaAdsClient(connection.access_token);
    
    const dateRange = since && until ? { since, until } : undefined;
    const insights = await metaClient.getCampaignInsights(campaignId, dateRange);

    return NextResponse.json({ insights });
  } catch (error) {
    console.error('Erro ao buscar insights:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}