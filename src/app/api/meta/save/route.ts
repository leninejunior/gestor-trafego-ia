import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { client_id, access_token, selected_accounts, ad_accounts } = body;

    console.log('💾 [SAVE] Salvando conexões Meta:', {
      client_id,
      accounts: selected_accounts?.length || 0
    });

    if (!client_id || !access_token || !selected_accounts?.length) {
      return NextResponse.json({ error: 'Dados obrigatórios ausentes' }, { status: 400 });
    }

    // Importar dinamicamente para evitar problemas de build
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();

    // Verificar cliente
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .eq('id', client_id)
      .single();

    if (clientError || !client) {
      console.error('❌ [SAVE] Cliente não encontrado:', client_id);
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
    }

    console.log('✅ [SAVE] Cliente encontrado');

    // Remover conexões antigas
    const { error: deleteError } = await supabase
      .from('client_meta_connections')
      .delete()
      .eq('client_id', client_id);

    if (deleteError) {
      console.error('⚠️ [SAVE] Erro ao deletar conexões antigas:', deleteError);
    }

    // Preparar novas conexões
    const connections = selected_accounts.map((accountId: string) => {
      const account = ad_accounts?.find((acc: any) => acc.id === accountId);
      return {
        client_id,
        ad_account_id: accountId,
        access_token,
        account_name: account?.name || `Conta ${accountId}`,
        currency: account?.currency || 'USD',
        is_active: true,
        status: 'active'
      };
    });

    console.log('📝 [SAVE] Inserindo', connections.length, 'conexões');

    // Inserir novas conexões
    const { error: insertError } = await supabase
      .from('client_meta_connections')
      .insert(connections);

    if (insertError) {
      console.error('❌ [SAVE] Erro ao inserir:', insertError);
      return NextResponse.json({ 
        error: 'Erro ao salvar conexões',
        details: insertError.message 
      }, { status: 500 });
    }

    console.log('✅ [SAVE] Conexões salvas com sucesso!');

    return NextResponse.json({ 
      success: true, 
      message: `${selected_accounts.length} conta(s) conectada(s) com sucesso` 
    });

  } catch (error) {
    console.error('💥 [SAVE] Erro:', error);
    return NextResponse.json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
