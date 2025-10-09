import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  console.log('=== TEST DELETE OPERATIONS ===');
  
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { connectionId, testType } = body;
    
    // Verificar usuário autenticado
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    console.log('Usuário:', user.id);
    console.log('Teste:', testType);
    console.log('Connection ID:', connectionId);

    if (testType === 'check-permissions') {
      // Testar apenas as verificações de permissão sem deletar
      
      // 1. Buscar a conexão
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
        return NextResponse.json({
          success: false,
          step: 'find-connection',
          error: connectionError?.message,
          connectionId
        });
      }

      // 2. Verificar membership
      const { data: membership, error: membershipError } = await supabase
        .from('memberships')
        .select('*')
        .eq('user_id', user.id)
        .eq('org_id', connection.clients.org_id)
        .single();

      if (membershipError || !membership) {
        return NextResponse.json({
          success: false,
          step: 'check-membership',
          error: membershipError?.message,
          userOrgAccess: false,
          connectionOrgId: connection.clients.org_id
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Usuário tem permissão para deletar esta conexão',
        connection: {
          id: connection.id,
          accountName: connection.account_name,
          clientId: connection.client_id,
          clientOrgId: connection.clients.org_id
        },
        membership: {
          orgId: membership.org_id,
          role: membership.role
        }
      });
    }

    if (testType === 'simulate-delete') {
      // Simular DELETE sem realmente deletar
      
      const { data: deleteResult, error: deleteError } = await supabase
        .from('client_meta_connections')
        .select('*')
        .eq('id', connectionId);

      if (deleteError) {
        return NextResponse.json({
          success: false,
          step: 'simulate-delete',
          error: deleteError.message,
          code: deleteError.code
        });
      }

      return NextResponse.json({
        success: true,
        message: 'DELETE simulado com sucesso',
        wouldDelete: deleteResult?.length || 0,
        records: deleteResult
      });
    }

    return NextResponse.json({
      error: 'Tipo de teste inválido. Use: check-permissions ou simulate-delete'
    }, { status: 400 });

  } catch (error) {
    console.error('Erro no teste:', error);
    return NextResponse.json({
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}