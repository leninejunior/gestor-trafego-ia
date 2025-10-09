import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  console.log('=== TESTE DELETE CONNECTION ===');
  
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { connectionId, confirmDelete } = body;
    
    // Verificar usuário autenticado
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    console.log('Usuário:', user.id);
    console.log('Connection ID para teste:', connectionId);

    if (!connectionId) {
      return NextResponse.json({ error: 'Connection ID é obrigatório' }, { status: 400 });
    }

    // 1. Primeiro, verificar se a conexão existe e buscar detalhes
    const { data: connection, error: connectionError } = await supabase
      .from('client_meta_connections')
      .select(`
        *,
        clients!inner (
          id,
          name,
          org_id
        )
      `)
      .eq('id', connectionId)
      .single();

    if (connectionError || !connection) {
      console.log('Conexão não encontrada:', connectionError);
      return NextResponse.json({
        success: false,
        error: 'Conexão não encontrada',
        details: connectionError?.message
      }, { status: 404 });
    }

    console.log('Conexão encontrada:', {
      id: connection.id,
      account_name: connection.account_name,
      client_name: connection.clients.name,
      client_org_id: connection.clients.org_id
    });

    // 2. Verificar se o usuário tem acesso à organização
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('*')
      .eq('user_id', user.id)
      .eq('org_id', connection.clients.org_id)
      .single();

    if (membershipError || !membership) {
      console.log('Usuário sem permissão:', membershipError);
      return NextResponse.json({
        success: false,
        error: 'Sem permissão para acessar esta conexão',
        userOrgAccess: false
      }, { status: 403 });
    }

    console.log('Usuário tem permissão. Membership:', {
      org_id: membership.org_id,
      role: membership.role
    });

    // 3. Se não confirmou delete, apenas retornar info para confirmação
    if (!confirmDelete) {
      return NextResponse.json({
        success: true,
        action: 'info',
        message: 'Conexão encontrada e usuário tem permissão',
        connection: {
          id: connection.id,
          account_name: connection.account_name,
          ad_account_id: connection.ad_account_id,
          client_name: connection.clients.name,
          is_active: connection.is_active,
          created_at: connection.created_at
        },
        instructions: 'Para deletar, envie novamente com confirmDelete: true'
      });
    }

    // 4. EXECUTAR DELETE REAL
    console.log('🚨 EXECUTANDO DELETE REAL...');
    
    const { data: deletedData, error: deleteError } = await supabase
      .from('client_meta_connections')
      .delete()
      .eq('id', connectionId)
      .select();

    if (deleteError) {
      console.error('❌ Erro ao deletar:', deleteError);
      return NextResponse.json({
        success: false,
        error: 'Erro ao deletar conexão',
        details: deleteError.message,
        code: deleteError.code
      }, { status: 500 });
    }

    const deletedCount = deletedData?.length || 0;
    console.log('✅ DELETE executado. Registros deletados:', deletedCount);

    if (deletedCount === 0) {
      console.log('⚠️ Nenhum registro foi deletado - possível problema de RLS');
      return NextResponse.json({
        success: false,
        error: 'Nenhum registro foi deletado',
        possibleCause: 'Problema de Row Level Security (RLS)',
        deletedCount: 0
      });
    }

    // 5. Verificar se realmente foi deletado
    const { data: checkData, error: checkError } = await supabase
      .from('client_meta_connections')
      .select('*')
      .eq('id', connectionId);

    const stillExists = checkData && checkData.length > 0;

    return NextResponse.json({
      success: true,
      action: 'deleted',
      message: `Conexão deletada com sucesso!`,
      deletedCount: deletedCount,
      deletedConnection: deletedData[0],
      verification: {
        stillExists: stillExists,
        message: stillExists ? '⚠️ Conexão ainda existe no banco' : '✅ Conexão removida do banco'
      }
    });

  } catch (error) {
    console.error('❌ Erro geral no teste:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}