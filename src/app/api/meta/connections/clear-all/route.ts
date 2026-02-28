import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { UserAccessControlService } from '@/lib/services/user-access-control';

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

    const serviceSupabase = createServiceClient();
    const accessControl = new UserAccessControlService();

    console.log('Limpando todas as conexões para cliente:', clientId);

    // Verificar se cliente existe
    const { data: client, error: clientError } = await serviceSupabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      console.log('Cliente não encontrado no Supabase:', clientId, clientError?.message);
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
    }

    const hasAccess = await accessControl.hasClientAccess(user.id, clientId);
    if (!hasAccess) {
      console.log('Usuário sem permissão para este cliente:', { userId: user.id, clientId });
      return NextResponse.json({ error: 'Sem permissão para acessar este cliente' }, { status: 403 });
    }

    const { data: deletedRows, error: deleteError } = await serviceSupabase
      .from('client_meta_connections')
      .delete()
      .eq('client_id', clientId)
      .select('id');

    if (deleteError) {
      console.error('Erro ao remover conexões:', deleteError);
      return NextResponse.json({ error: 'Erro ao limpar conexões' }, { status: 500 });
    }

    const deletedCount = deletedRows?.length ?? 0;
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
