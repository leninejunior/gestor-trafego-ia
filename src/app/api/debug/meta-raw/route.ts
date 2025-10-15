import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    console.log('🔍 [META RAW] Verificando dados Meta sem RLS...');

    // Usar query SQL direta para contornar RLS
    const { data: connectionsRaw, error: connectionsError } = await supabase
      .rpc('get_meta_connections_debug');

    if (connectionsError) {
      console.log('❌ [META RAW] Erro na função RPC, tentando query direta...');
      
      // Tentar query direta
      const { data: directConnections, error: directError } = await supabase
        .from('client_meta_connections')
        .select('*', { count: 'exact' });

      console.log('📊 [META RAW] Query direta - Conexões:', directConnections?.length || 0);
      console.log('❌ [META RAW] Erro direto:', directError);

      // Tentar com service role (se disponível)
      const serviceSupabase = createClient();
      const { data: serviceConnections, error: serviceError } = await serviceSupabase
        .from('client_meta_connections')
        .select(`
          id,
          client_id,
          ad_account_id,
          account_name,
          is_active,
          created_at
        `);

      console.log('📊 [META RAW] Service query - Conexões:', serviceConnections?.length || 0);
      console.log('❌ [META RAW] Service erro:', serviceError);

      return NextResponse.json({
        success: true,
        rpcError: connectionsError,
        directQuery: {
          connections: directConnections?.length || 0,
          error: directError
        },
        serviceQuery: {
          connections: serviceConnections?.length || 0,
          error: serviceError,
          data: serviceConnections
        },
        message: 'Debug de conexões Meta concluído'
      });
    }

    return NextResponse.json({
      success: true,
      rpcData: connectionsRaw,
      message: 'RPC funcionou'
    });

  } catch (error) {
    console.error('💥 [META RAW] Erro:', error);
    return NextResponse.json({ 
      error: 'Erro interno',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}