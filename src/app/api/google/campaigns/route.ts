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
    
    if (!activeConnection) {
      console.log('⚠️ [GOOGLE CAMPAIGNS API] Nenhuma conexão ativa encontrada');
      return NextResponse.json({ 
        campaigns: [],
        message: 'Nenhuma conexão Google Ads ativa. Reconecte sua conta.',
        needsReconnection: true
      });
    }

    // Buscar campanhas sincronizadas do banco
    let query = supabase
      .from('google_ads_campaigns')
      .select(`
        *,
        connection:google_ads_connections(customer_id)
      `)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    // Filtrar por conexão específica se fornecido
    if (connectionId) {
      query = query.eq('connection_id', connectionId);
    } else {
      // Se não especificou, usar apenas a conexão ativa
      query = query.eq('connection_id', activeConnection.id);
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

    return NextResponse.json({ 
      campaigns: campaigns || [],
      count: campaigns?.length || 0
    });

  } catch (error) {
    console.error('💥 [GOOGLE CAMPAIGNS API] Erro geral:', error);
    return NextResponse.json({ 
      error: 'Erro interno ao buscar campanhas',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
