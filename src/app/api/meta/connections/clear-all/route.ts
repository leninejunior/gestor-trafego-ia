import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function DELETE(request: NextRequest) {
  console.log('=== CLEAR ALL CONNECTIONS ===');
  
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    
    if (!clientId) {
      return NextResponse.json({ error: 'Client ID é obrigatório' }, { status: 400 });
    }

    const supabase = await createClient();
    
    // Verificar autenticação do usuário
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    console.log('Limpando todas as conexões para cliente:', clientId);

    // Verificar se o cliente pertence ao usuário antes de deletar
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, org_id')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      console.log('Cliente não encontrado:', clientError);
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
    }

    // Verificar se o usuário tem acesso à organização do cliente
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('*')
      .eq('user_id', user.id)
      .eq('org_id', client.org_id)
      .single();

    if (membershipError || !membership) {
      console.log('Usuário sem permissão para esta organização:', membershipError);
      return NextResponse.json({ error: 'Sem permissão para acessar este cliente' }, { status: 403 });
    }

    // Deletar todas as conexões do cliente
    const { data: deletedData, error: deleteError } = await supabase
      .from('client_meta_connections')
      .delete()
      .eq('client_id', clientId)
      .select();

    if (deleteError) {
      console.error('Erro ao deletar conexões:', deleteError);
      return NextResponse.json({ 
        error: 'Erro ao deletar conexões', 
        details: deleteError.message,
        code: deleteError.code 
      }, { status: 500 });
    }

    const deletedCount = deletedData?.length || 0;
    console.log('Conexões removidas:', deletedCount);
    
    if (deletedCount === 0) {
      console.log('Nenhuma conexão foi deletada - possível problema de RLS');
      return NextResponse.json({ 
        success: true, 
        message: 'Nenhuma conexão encontrada para deletar',
        deletedCount: 0
      });
    }

    console.log('Todas as conexões foram removidas com sucesso');
    return NextResponse.json({ 
      success: true, 
      message: `${deletedCount} conexões foram removidas`,
      deletedCount: deletedCount
    });

  } catch (error) {
    console.error('Erro na API de limpar conexões:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}