import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  console.log('=== INÍCIO save-simple ===');
  
  try {
    const body = await request.json();
    const { client_id, access_token, selected_accounts, ad_accounts } = body;

    console.log('Dados recebidos:', {
      client_id,
      selected_accounts: selected_accounts?.length,
      ad_accounts: ad_accounts?.length
    });

    if (!client_id || !access_token || !selected_accounts || selected_accounts.length === 0) {
      return NextResponse.json({ error: 'Dados obrigatórios ausentes' }, { status: 400 });
    }

    const supabase = await createClient();

    // Verificar se o cliente existe (sem verificar permissões por enquanto)
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .eq('id', client_id)
      .single();

    if (clientError || !client) {
      console.log('Cliente não encontrado:', clientError);
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
    }

    // Limpar conexões existentes
    console.log('Limpando conexões existentes...');
    await supabase
      .from('client_meta_connections')
      .delete()
      .eq('client_id', client_id);

    // Preparar dados para inserção
    const connectionsToInsert = selected_accounts.map((accountId: string) => {
      const account = ad_accounts.find((acc: any) => acc.id === accountId);
      return {
        client_id: client_id,
        ad_account_id: accountId,
        access_token: access_token,
        account_name: account?.name || `Conta ${accountId}`,
        currency: account?.currency || 'BRL',
        is_active: true
      };
    });

    console.log('Inserindo conexões:', connectionsToInsert.length);

    // Inserir uma por vez para identificar qual está causando problema
    for (const connection of connectionsToInsert) {
      console.log('Inserindo:', connection.account_name);
      
      const { error } = await supabase
        .from('client_meta_connections')
        .insert(connection);
      
      if (error) {
        console.error('Erro ao inserir conexão:', connection.account_name, error);
        // Continue com as outras mesmo se uma falhar
      }
    }

    console.log('Operação concluída');
    return NextResponse.json({ 
      success: true, 
      message: `${selected_accounts.length} conta(s) processada(s)` 
    });

  } catch (error) {
    console.error('Erro geral:', error);
    return NextResponse.json({ 
      error: 'Erro interno',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}