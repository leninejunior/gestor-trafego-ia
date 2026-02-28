import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { UserAccessControlService } from '@/lib/services/user-access-control';

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

    const serviceSupabase = createServiceClient();
    const accessControl = new UserAccessControlService();

    const { data: connection, error: connectionError } = await serviceSupabase
      .from('client_meta_connections')
      .select('id, client_id')
      .eq('id', connectionId)
      .single();

    if (connectionError || !connection) {
      console.log('Conexão não encontrada no Supabase:', connectionId, connectionError?.message);
      return NextResponse.json({ 
        error: 'Conexão não encontrada',
        connectionId: connectionId,
      }, { status: 404 });
    }

    const hasAccess = await accessControl.hasClientAccess(user.id, connection.client_id);
    if (!hasAccess) {
      console.log('Usuário sem permissão para este cliente:', {
        userId: user.id,
        clientId: connection.client_id,
      });
      return NextResponse.json({ 
        error: 'Sem permissão para acessar esta conexão',
        connectionId: connectionId
      }, { status: 403 });
    }

    // Deletar a conexão
    console.log('Deletando conexão...');
    const { data: deletedRows, error: deleteError } = await serviceSupabase
      .from('client_meta_connections')
      .delete()
      .eq('id', connectionId)
      .select('id');

    if (deleteError) {
      console.error('Erro ao deletar conexão no Supabase:', deleteError);
      return NextResponse.json({ error: 'Erro ao deletar conexão' }, { status: 500 });
    }

    const deletedCount = deletedRows?.length ?? 0;

    console.log('Conexão deletada com sucesso. Registros afetados:', deletedCount);
    
    if (deletedCount === 0) {
      console.log('Nenhum registro foi deletado');
      return NextResponse.json({ 
        error: 'Nenhum registro foi deletado.',
        connectionId: connectionId
      }, { status: 404 });
    }

    return NextResponse.json({ success: true, deletedCount });

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

    const serviceSupabase = createServiceClient();
    const accessControl = new UserAccessControlService();
    const { connectionId } = await params;
    const body = await request.json();

    const { data: connection, error: connectionError } = await serviceSupabase
      .from('client_meta_connections')
      .select('id, client_id')
      .eq('id', connectionId)
      .single();

    if (connectionError || !connection) {
      return NextResponse.json({ error: 'Conexão não encontrada' }, { status: 404 });
    }

    const hasAccess = await accessControl.hasClientAccess(user.id, connection.client_id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Sem permissão para acessar esta conexão' }, { status: 403 });
    }

    const updates: Record<string, unknown> = {};
    if (typeof body?.is_active === 'boolean') {
      updates.is_active = body.is_active;
    }
    if (typeof body?.account_name === 'string' && body.account_name.trim().length > 0) {
      updates.account_name = body.account_name.trim();
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo válido para atualizar' }, { status: 400 });
    }

    updates.updated_at = new Date().toISOString();

    const { data: updatedConnection, error: updateError } = await serviceSupabase
      .from('client_meta_connections')
      .update(updates)
      .eq('id', connectionId)
      .select('*')
      .single();

    if (updateError || !updatedConnection) {
      console.error('Erro ao atualizar conexão:', updateError);
      return NextResponse.json({ error: 'Erro ao atualizar conexão' }, { status: 500 });
    }

    return NextResponse.json({ connection: updatedConnection });

  } catch (error) {
    console.error('Erro na API de atualizar conexão:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
