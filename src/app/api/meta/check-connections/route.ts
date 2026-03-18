import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAccessControl } from '@/lib/middleware/user-access-middleware';
import { UserAccessControlService } from '@/lib/services/user-access-control';

// Requirements: 5.1, 5.2 - Filtrar conexões por acesso do usuário
const checkConnections = createAccessControl.requireOrganizationMembership('Acesso negado para verificar conexões')

export async function GET(request: NextRequest) {
  return checkConnections(async (request: NextRequest, context: any) => {
    try {
      const supabase = await createClient();
      const accessControl = new UserAccessControlService();
      
      console.log('🔍 Verificando conexões Meta para usuário:', context.user.id, 'tipo:', context.userType);

      let clients: any[] = [];
      let connections: any[] = [];
      let campaigns: any[] = [];

      if (context.userType === 'super_admin') {
        console.log('👑 Super admin - buscando TODAS as conexões');
        
        // Buscar todos os clientes
        const { data: allClients, error: clientsError } = await supabase
          .from('clients')
          .select('id, name, org_id');

        if (clientsError) {
          return NextResponse.json({ 
            error: 'Erro ao buscar clientes',
            details: clientsError.message 
          }, { status: 500 });
        }

        clients = allClients || [];
      } else {
        // Buscar clientes acessíveis pelo usuário
        const accessibleClients = await accessControl.getUserAccessibleClients(context.user.id);
        clients = accessibleClients.map(c => ({
          id: c.id,
          name: c.name,
          org_id: c.orgId
        }));
      }

      // Buscar conexões Meta dos clientes acessíveis
      const clientIds = clients?.map(c => c.id) || [];
      
      if (clientIds.length > 0) {
        const { data: connectionsData, error: connectionsError } = await supabase
          .from('client_meta_connections')
          .select('*')
          .in('client_id', clientIds);

        if (connectionsError) {
          return NextResponse.json({ 
            error: 'Erro ao buscar conexões Meta',
            details: connectionsError.message 
          }, { status: 500 });
        }

        connections = connectionsData || [];

        // Buscar campanhas das conexões
        const connectionIds = connections?.map(c => c.id) || [];
        
        if (connectionIds.length > 0) {
          const { data: campaignsData, error: campaignsError } = await supabase
            .from('meta_campaigns')
            .select('connection_id, id, name, status')
            .in('connection_id', connectionIds);

          campaigns = campaignsData || [];
        }
      }

      // Montar resposta detalhada
      const result = {
        user: {
          id: context.user.id,
          email: context.user.email,
          type: context.userType
        },
        summary: {
          clients: clients?.length || 0,
          connections: connections?.length || 0,
          campaigns: campaigns?.length || 0
        },
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
  })(request)
}
