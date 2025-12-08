import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ 
        error: 'Não autenticado',
        details: authError?.message 
      }, { status: 401 });
    }

    // Buscar organizações do usuário
    const { data: memberships, error: membershipsError } = await supabase
      .from('memberships')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (membershipsError) {
      return NextResponse.json({ 
        error: 'Erro ao buscar organizações',
        details: membershipsError.message 
      }, { status: 500 });
    }

    // Buscar clientes das organizações
    const orgIds = memberships?.map(m => m.organization_id) || [];
    
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, org_id')
      .in('org_id', orgIds);

    if (clientsError) {
      return NextResponse.json({ 
        error: 'Erro ao buscar clientes',
        details: clientsError.message 
      }, { status: 500 });
    }

    // Buscar conexões Meta dos clientes
    const clientIds = clients?.map(c => c.id) || [];
    
    const { data: connections, error: connectionsError } = await supabase
      .from('client_meta_connections')
      .select('*')
      .in('client_id', clientIds);

    if (connectionsError) {
      return NextResponse.json({ 
        error: 'Erro ao buscar conexões Meta',
        details: connectionsError.message 
      }, { status: 500 });
    }

    // Buscar campanhas das conexões
    const connectionIds = connections?.map(c => c.id) || [];
    
    const { data: campaigns, error: campaignsError } = await supabase
      .from('meta_campaigns')
      .select('connection_id, id, name, status')
      .in('connection_id', connectionIds);

    // Montar resposta detalhada
    const result = {
      user: {
        id: user.id,
        email: user.email
      },
      summary: {
        organizations: memberships?.length || 0,
        clients: clients?.length || 0,
        connections: connections?.length || 0,
        campaigns: campaigns?.length || 0
      },
      organizations: memberships?.map(m => ({
        id: m.org_id,
        role: m.role
      })),
      clients: clients?.map(c => {
        const clientConnections = connections?.filter(conn => conn.client_id === c.id) || [];
        const clientCampaigns = campaigns?.filter(camp => 
          clientConnections.some(conn => conn.id === camp.connection_id)
        ) || [];
        
        return {
          id: c.id,
          name: c.name,
          org_id: c.org_id,
          connections: clientConnections.length,
          campaigns: clientCampaigns.length,
          connectionDetails: clientConnections.map(conn => ({
            id: conn.id,
            ad_account_id: conn.ad_account_id,
            account_name: conn.account_name,
            is_active: conn.is_active,
            created_at: conn.created_at,
            updated_at: conn.updated_at
          }))
        };
      }),
      rawData: {
        connections: connections?.map(c => ({
          ...c,
          access_token: c.access_token ? '***REDACTED***' : null
        })),
        campaigns: campaigns
      }
    };

    return NextResponse.json(result, { status: 200 });
    
  } catch (error: any) {
    console.error('Erro ao verificar conexões Meta:', error);
    return NextResponse.json({ 
      error: 'Erro interno',
      details: error.message 
    }, { status: 500 });
  }
}
