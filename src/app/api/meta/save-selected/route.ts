import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  console.log('=== INÍCIO save-selected ===');
  
  try {
    console.log('1. Lendo body da requisição...');
    const body = await request.json();
    console.log('Body recebido:', {
      client_id: body.client_id,
      access_token: body.access_token ? 'presente' : 'ausente',
      selected_accounts: body.selected_accounts?.length || 0,
      selected_pages: body.selected_pages?.length || 0,
      ad_accounts: body.ad_accounts?.length || 0
    });
    
    const { 
      client_id, 
      access_token, 
      selected_accounts, 
      selected_pages, 
      ad_accounts, 
      pages 
    } = body;

    if (!client_id || !access_token || !selected_accounts || selected_accounts.length === 0) {
      console.log('Dados obrigatórios ausentes');
      return NextResponse.json({ error: 'Dados obrigatórios ausentes' }, { status: 400 });
    }
    
    console.log('2. Dados validados, criando cliente Supabase...');

    const supabase = await createClient();
    console.log('3. Cliente Supabase criado');

    // Verificar autenticação do usuário
    console.log('4. Verificando autenticação...');
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.log('Erro de autenticação:', userError);
      console.log('Headers da requisição:', Object.fromEntries(request.headers.entries()));
      
      // Tentar obter usuário via service client como fallback
      try {
        const { createServiceClient } = require('@/lib/supabase/server');
        const serviceSupabase = createServiceClient();
        
        // Buscar cliente para verificar se existe
        const { data: clientCheck } = await serviceSupabase
          .from('clients')
          .select('id')
          .eq('id', client_id)
          .single();
          
        if (!clientCheck) {
          return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
        }
        
        console.log('5. Usando service client como fallback para cliente:', client_id);
      } catch (fallbackError) {
        console.error('Erro no fallback:', fallbackError);
        return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
      }
    } else {
      console.log('5. Usuário autenticado:', user.id);
    }

    console.log('6. Verificando cliente:', client_id);

    // Usar service client para operações no banco
    const { createServiceClient } = require('@/lib/supabase/server');
    const serviceSupabase = createServiceClient();

    // Verificar se o cliente existe
    const { data: client, error: clientError } = await serviceSupabase
      .from('clients')
      .select('id, org_id')
      .eq('id', client_id)
      .single();

    console.log('7. Cliente encontrado:', client ? 'sim' : 'não');

    if (clientError || !client) {
      console.error('Cliente não encontrado:', clientError);
      return NextResponse.json({ 
        error: 'Cliente não encontrado',
        details: clientError?.message 
      }, { status: 404 });
    }

    // Remover conexões existentes para este cliente
    console.log('Removendo conexões existentes para cliente:', client_id);
    
    const { error: deleteError } = await serviceSupabase
      .from('client_meta_connections')
      .delete()
      .eq('client_id', client_id);
    
    if (deleteError) {
      console.error('Erro ao deletar conexões existentes:', deleteError);
    } else {
      console.log('Conexões existentes removidas com sucesso');
    }

    // Salvar as contas selecionadas
    console.log('8. Preparando dados para inserção...');
    const connectionsToInsert = selected_accounts.map((accountId: string) => {
      const account = ad_accounts.find((acc: any) => acc.id === accountId);
      console.log('Processando conta:', accountId, 'Nome:', account?.name);
      return {
        client_id: client_id,
        ad_account_id: accountId,
        access_token: access_token,
        account_name: account?.name || `Conta ${accountId}`,
        currency: account?.currency || 'USD',
        is_active: true
      };
    });
    
    console.log('Dados preparados:', connectionsToInsert.length, 'conexões');

    console.log('Inserindo conexões:', connectionsToInsert.length, 'contas');
    
    const { error: insertError } = await serviceSupabase
      .from('client_meta_connections')
      .upsert(connectionsToInsert, { 
        onConflict: 'client_id,ad_account_id',
        ignoreDuplicates: false 
      });

    if (insertError) {
      console.error('Erro ao inserir conexões:', insertError);
      return NextResponse.json({ 
        error: 'Erro ao salvar conexões',
        details: insertError.message 
      }, { status: 500 });
    }
    
    console.log('Conexões salvas com sucesso!');

    // TODO: Salvar páginas selecionadas em uma tabela separada se necessário
    // Por enquanto, vamos focar apenas nas contas de anúncios

    console.log('10. Operação concluída com sucesso!');
    console.log('=== FIM save-selected ===');
    
    return NextResponse.json({ 
      success: true, 
      message: `${selected_accounts.length} conta(s) conectada(s) com sucesso` 
    });

  } catch (error) {
    console.error('Erro ao salvar contas selecionadas:', error);
    return NextResponse.json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}