import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  console.log('=== DELETE CONNECTION ===');
  
  try {
    const supabase = await createClient();
    const { connectionId } = await params;
    
    console.log('Tentando deletar conexão:', connectionId);
    
    // Verificar autenticação do usuário
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.log('Usuário não autenticado:', userError);
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    console.log('Usuário autenticado:', user.id);

    // Verificar se a conexão existe e pertence ao usuário
    // Primeiro, buscar a conexão e o cliente
    const { data: connection, error: connectionError } = await supabase
      .from('client_meta_connections')
      .select(`
        *,
        clients!inner (
          id,
          org_id
        )
      `)
      .eq('id', connectionId)
      .single();

    if (connectionError || !connection) {
      console.log('Conexão não encontrada:', connectionError);
      return NextResponse.json({ 
        error: 'Conexão não encontrada',
        connectionId: connectionId,
        details: connectionError?.message 
      }, { status: 404 });
    }

    // Verificar se o usuário tem acesso à organização do cliente
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('*')
      .eq('user_id', user.id)
      .eq('org_id', connection.clients.org_id)
      .single();

    if (membershipError || !membership) {
      console.log('Usuário sem permissão para esta organização:', membershipError);
      return NextResponse.json({ 
        error: 'Sem permissão para acessar esta conexão',
        connectionId: connectionId
      }, { status: 403 });
    }



    // Deletar a conexão
    console.log('Deletando conexão...');
    const { data: deletedData, error: deleteError } = await supabase
      .from('client_meta_connections')
      .delete()
      .eq('id', connectionId)
      .select();

    if (deleteError) {
      console.error('Erro ao deletar conexão:', deleteError);
      return NextResponse.json({ 
        error: 'Erro ao deletar conexão', 
        details: deleteError.message,
        code: deleteError.code 
      }, { status: 500 });
    }

    console.log('Conexão deletada com sucesso. Registros afetados:', deletedData?.length || 0);
    
    if (!deletedData || deletedData.length === 0) {
      console.log('Nenhum registro foi deletado - possível problema de RLS');
      return NextResponse.json({ 
        error: 'Nenhum registro foi deletado. Verifique as permissões.',
        connectionId: connectionId
      }, { status: 404 });
    }

    return NextResponse.json({ success: true, deletedCount: deletedData.length });

  } catch (error) {
    console.error('Erro na API de deletar conexão:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  try {
    const supabase = await createClient();
    
    // Verificar autenticação do usuário
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { connectionId } = await params;
    const body = await request.json();

    // Verificar se a conexão pertence ao usuário
    const { data: connection, error: connectionError } = await supabase
      .from('client_meta_connections')
      .select(`
        *,
        clients!inner (
          id,
          org_id
        )
      `)
      .eq('id', connectionId)
      .single();

    if (connectionError || !connection) {
      return NextResponse.json({ error: 'Conexão não encontrada' }, { status: 404 });
    }

    // Verificar se o usuário tem acesso à organização do cliente
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('*')
      .eq('user_id', user.id)
      .eq('org_id', connection.clients.org_id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'Sem permissão para acessar esta conexão' }, { status: 403 });
    }

    // Atualizar a conexão
    const { data: updatedConnection, error: updateError } = await supabase
      .from('client_meta_connections')
      .update({
        is_active: body.is_active,
        account_name: body.account_name,
        updated_at: new Date().toISOString()
      })
      .eq('id', connectionId)
      .select()
      .single();

    if (updateError) {
      console.error('Erro ao atualizar conexão:', updateError);
      return NextResponse.json({ error: 'Erro ao atualizar conexão' }, { status: 500 });
    }

    return NextResponse.json({ connection: updatedConnection });

  } catch (error) {
    console.error('Erro na API de atualizar conexão:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}