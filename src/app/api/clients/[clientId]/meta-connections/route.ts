import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(
  request: NextRequest,
  { params }: { params: { clientId: string } }
) {
  console.log('=== INÍCIO meta-connections POST ===');
  
  try {
    const clientId = params.clientId;
    console.log('1. Client ID:', clientId);
    
    const body = await request.json();
    console.log('2. Body recebido:', {
      access_token: body.access_token ? 'presente' : 'ausente',
      selected_accounts: body.selected_accounts?.length || 0,
      ad_accounts: body.ad_accounts?.length || 0
    });
    
    const { 
      access_token, 
      selected_accounts, 
      ad_accounts
    } = body;

    if (!access_token || !selected_accounts || selected_accounts.length === 0) {
      console.log('❌ Dados obrigatórios ausentes');
      return NextResponse.json({ error: 'Dados obrigatórios ausentes' }, { status: 400 });
    }
    
    console.log('3. Criando cliente Supabase com service role...');

    // Usar service client direto (bypass RLS)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    
    console.log('4. Verificando se cliente existe:', clientId);

    // Verificar se o cliente existe
    const { data: client, error: clientError} = await supabase
      .from('clients')
      .select('id, org_id')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      console.error('❌ Cliente não encontrado:', clientError);
      return NextResponse.json({ 
        error: 'Cliente não encontrado',
        details: clientError?.message 
      }, { status: 404 });
    }

    console.log('✅ Cliente encontrado');

    // Remover conexões existentes para este cliente
    console.log('5. Removendo conexões existentes...');
    
    const { error: deleteError } = await supabase
      .from('client_meta_connections')
      .delete()
      .eq('client_id', clientId);
    
    if (deleteError) {
      console.error('⚠️ Erro ao deletar conexões existentes:', deleteError);
    } else {
      console.log('✅ Conexões existentes removidas');
    }

    // Salvar as contas selecionadas
    console.log('6. Preparando dados para inserção...');
    const connectionsToInsert = selected_accounts.map((accountId: string) => {
      const account = ad_accounts.find((acc: any) => acc.id === accountId);
      return {
        client_id: clientId,
        ad_account_id: accountId,
        access_token: access_token,
        account_name: account?.name || `Conta ${accountId}`,
        currency: account?.currency || 'USD',
        is_active: true
      };
    });
    
    console.log('7. Inserindo', connectionsToInsert.length, 'conexões...');
    
    const { error: insertError } = await supabase
      .from('client_meta_connections')
      .upsert(connectionsToInsert, { 
        onConflict: 'client_id,ad_account_id',
        ignoreDuplicates: false 
      });

    if (insertError) {
      console.error('❌ Erro ao inserir conexões:', insertError);
      return NextResponse.json({ 
        error: 'Erro ao salvar conexões',
        details: insertError.message 
      }, { status: 500 });
    }
    
    console.log('✅ Conexões salvas com sucesso!');
    console.log('=== FIM meta-connections POST ===');
    
    return NextResponse.json({ 
      success: true, 
      message: `${selected_accounts.length} conta(s) conectada(s) com sucesso` 
    });

  } catch (error) {
    console.error('💥 Erro ao salvar contas:', error);
    return NextResponse.json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
