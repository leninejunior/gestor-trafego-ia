import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  console.log('=== DEBUG USER DATA ===');
  
  try {
    const supabase = await createClient();
    
    // 1. Verificar usuário autenticado
    console.log('1. Verificando usuário autenticado...');
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({
        error: 'Usuário não autenticado',
        details: userError?.message
      }, { status: 401 });
    }

    const debugInfo: any = {
      user: {
        id: user.id,
        email: user.email
      }
    };

    // 2. Verificar memberships do usuário
    console.log('2. Verificando memberships...');
    const { data: memberships, error: membershipError } = await supabase
      .from('memberships')
      .select('*')
      .eq('user_id', user.id);

    debugInfo.memberships = {
      count: memberships?.length || 0,
      data: memberships,
      error: membershipError?.message
    };

    // 3. Verificar organizações
    console.log('3. Verificando organizações...');
    const { data: organizations, error: orgError } = await supabase
      .from('organizations')
      .select('*');

    debugInfo.organizations = {
      count: organizations?.length || 0,
      data: organizations,
      error: orgError?.message
    };

    // 4. Verificar clientes
    console.log('4. Verificando clientes...');
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('*');

    debugInfo.clients = {
      count: clients?.length || 0,
      data: clients,
      error: clientError?.message
    };

    // 5. Verificar conexões Meta
    console.log('5. Verificando conexões Meta...');
    const { data: connections, error: connectionError } = await supabase
      .from('client_meta_connections')
      .select(`
        *,
        clients (
          id,
          name,
          org_id
        )
      `);

    debugInfo.connections = {
      count: connections?.length || 0,
      data: connections,
      error: connectionError?.message
    };

    // 6. Verificar acesso às conexões
    if (memberships && memberships.length > 0 && connections && connections.length > 0) {
      console.log('6. Verificando acesso às conexões...');
      
      const userOrgIds = memberships.map(m => m.org_id);
      
      const accessCheck = connections.map(conn => ({
        connectionId: conn.id,
        accountName: conn.account_name,
        clientOrgId: conn.clients?.org_id,
        hasAccess: userOrgIds.includes(conn.clients?.org_id)
      }));

      debugInfo.accessCheck = accessCheck;
    }

    return NextResponse.json({
      success: true,
      debug: debugInfo
    });

  } catch (error) {
    console.error('Erro no debug:', error);
    return NextResponse.json({
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}