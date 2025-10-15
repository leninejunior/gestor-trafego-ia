import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔍 [TEST CAMPAIGNS] Testando busca de campanhas...');
    console.log('👤 [TEST CAMPAIGNS] Usuário:', user.email);

    // Buscar todas as conexões Meta
    const { data: connections, error: connectionsError } = await supabase
      .from('client_meta_connections')
      .select(`
        id,
        client_id,
        ad_account_id,
        account_name,
        clients(id, name)
      `);

    console.log('🔗 [TEST CAMPAIGNS] Conexões encontradas:', connections?.length || 0);
    console.log('📊 [TEST CAMPAIGNS] Conexões:', connections);

    if (connectionsError) {
      console.error('❌ [TEST CAMPAIGNS] Erro ao buscar conexões:', connectionsError);
      return NextResponse.json({ error: 'Erro ao buscar conexões', details: connectionsError });
    }

    // Buscar campanhas usando JOIN correto
    const { data: campaigns, error: campaignsError } = await supabase
      .from('meta_campaigns')
      .select(`
        *,
        client_meta_connections!inner(
          client_id,
          account_name,
          ad_account_id,
          clients(id, name)
        )
      `);

    console.log('📈 [TEST CAMPAIGNS] Campanhas encontradas:', campaigns?.length || 0);
    console.log('📊 [TEST CAMPAIGNS] Campanhas:', campaigns);

    if (campaignsError) {
      console.error('❌ [TEST CAMPAIGNS] Erro ao buscar campanhas:', campaignsError);
      return NextResponse.json({ error: 'Erro ao buscar campanhas', details: campaignsError });
    }

    return NextResponse.json({
      success: true,
      connections: connections || [],
      campaigns: campaigns || [],
      message: 'Teste de busca de campanhas concluído'
    });

  } catch (error) {
    console.error('💥 [TEST CAMPAIGNS] Erro geral:', error);
    return NextResponse.json({ 
      error: 'Erro interno', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}