import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  console.log('🔄 [SAVE CONNECTIONS] Iniciando salvamento...');
  
  try {
    const body = await request.json();
    const { client_id, access_token, selected_accounts, selected_pages, ad_accounts, pages } = body;

    console.log('📦 [SAVE CONNECTIONS] Dados recebidos:', {
      client_id,
      selected_accounts: selected_accounts?.length || 0,
      selected_pages: selected_pages?.length || 0,
      ad_accounts: ad_accounts?.length || 0
    });

    if (!client_id || !access_token || !selected_accounts || selected_accounts.length === 0) {
      return NextResponse.json(
        { error: 'Dados inválidos' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    // Limpar conexões antigas
    const { error: deleteError } = await supabase
      .from('client_meta_connections')
      .delete()
      .eq('client_id', client_id);

    if (deleteError) {
      console.error('❌ Erro ao limpar conexões antigas:', deleteError);
    }

    // Salvar novas conexões
    const connections = selected_accounts.map((accountId: string) => {
      const account = ad_accounts.find((acc: any) => acc.id === accountId);
      return {
        client_id,
        ad_account_id: accountId,
        ad_account_name: account?.name || 'Unknown',
        access_token,
        status: 'active'
      };
    });

    const { data, error } = await supabase
      .from('client_meta_connections')
      .insert(connections)
      .select();

    if (error) {
      console.error('❌ Erro ao salvar conexões:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    console.log('✅ Conexões salvas com sucesso:', data?.length || 0);

    return NextResponse.json({
      success: true,
      connections: data
    });

  } catch (error: any) {
    console.error('💥 Erro no salvamento:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno' },
      { status: 500 }
    );
  }
}
