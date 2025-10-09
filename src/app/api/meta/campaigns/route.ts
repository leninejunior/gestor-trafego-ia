import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { MetaAdsClient } from '@/lib/meta/client';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');
  const adAccountId = searchParams.get('adAccountId');
  
  if (!clientId || !adAccountId) {
    return NextResponse.json({ error: 'Client ID e Ad Account ID são obrigatórios' }, { status: 400 });
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
      .eq('ad_account_id', adAccountId)
      .eq('is_active', true)
      .single();

    if (connectionError || !connection) {
      return NextResponse.json({ error: 'Conexão com Meta não encontrada' }, { status: 404 });
    }

    // Buscar campanhas usando o Meta Ads Client
    const metaClient = new MetaAdsClient(connection.access_token);
    const campaigns = await metaClient.getCampaigns(adAccountId);

    return NextResponse.json({ campaigns });
  } catch (error) {
    console.error('Erro ao buscar campanhas:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}