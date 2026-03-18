import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { isSuperAdmin } from '@/lib/auth/super-admin';
import { checkPlanLimits } from '@/lib/middleware/plan-limits';
import { createAccessControl } from '@/lib/middleware/user-access-middleware';
import { UserAccessControlService } from '@/lib/services/user-access-control';

// POST - Criar novo cliente
// Requirements: 4.1, 4.2, 4.3 - Validar limites de plano, 6.2, 6.4 - Bloquear criação por usuários comuns
const createClientMiddleware = createAccessControl.createClient('Usuários comuns não podem criar clientes')

export async function POST(request: NextRequest) {
  return createClientMiddleware(async (request: NextRequest, context: any) => {
    try {
      const supabase = await createClient();
      
      // Parse do body
      const body = await request.json();
      const { name, description } = body;

      if (!name) {
        return NextResponse.json({ error: 'Nome do cliente é obrigatório' }, { status: 400 });
      }

      // Criar cliente
      const { data: newClient, error: createError } = await supabase
        .from('clients')
        .insert({
          name,
          description,
          org_id: context.organizationId,
          created_by: context.user.id
        })
        .select()
        .single();

      if (createError) {
        console.error('Erro ao criar cliente:', createError);
        return NextResponse.json({ error: 'Erro ao criar cliente' }, { status: 500 });
      }

      return NextResponse.json({ 
        message: 'Cliente criado com sucesso',
        client: newClient 
      });
    } catch (error: any) {
      console.error('Erro ao criar cliente:', error);
      return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
  })(request)
}

// GET - Listar clientes
// Requirements: 5.1, 5.2 - Filtrar clientes por acesso do usuário
const getClientsMiddleware = createAccessControl.requireOrganizationMembership('Acesso negado para visualizar clientes')

export async function GET(request: NextRequest) {
  return getClientsMiddleware(async (request: NextRequest, context: any) => {
    try {
      const supabase = await createClient();
      const accessControl = new UserAccessControlService();

      console.log('🔍 Verificando acesso aos clientes para usuário:', context.user.id, 'tipo:', context.userType);

      // Verificar se deve incluir conexões Google
      const { searchParams } = new URL(request.url);
      const includeGoogleConnections = searchParams.get('includeGoogleConnections') === 'true';

      let clients: any[] = [];

      if (context.userType === 'super_admin') {
        console.log('👑 Super admin - buscando TODOS os clientes');
        const { data, error } = await supabase
          .from('clients')
          .select(`
            id, 
            name, 
            created_at,
            organizations!inner(id, name)
          `)
          .order('name');
        
        if (error) {
          console.error('❌ Erro ao buscar clientes para super admin:', error);
          return NextResponse.json({ error: 'Erro ao buscar clientes' }, { status: 500 });
        }
        
        clients = data || [];
      } else if (context.userType === 'org_admin') {
        console.log('🏢 Org admin - buscando clientes da organização:', context.organizationId);
        const { data, error } = await supabase
          .from('clients')
          .select('id, name, created_at')
          .eq('org_id', context.organizationId)
          .order('name');
        
        if (error) {
          console.error('❌ Erro ao buscar clientes para org admin:', error);
          return NextResponse.json({ error: 'Erro ao buscar clientes' }, { status: 500 });
        }
        
        clients = data || [];
      } else {
        // Usuário comum - apenas clientes com acesso explícito
        console.log('👤 Usuário comum - buscando clientes com acesso explícito');
        const accessibleClients = await accessControl.getUserAccessibleClients(context.user.id);
        clients = accessibleClients.map(c => ({
          id: c.id,
          name: c.name,
          created_at: null // Não temos essa informação no retorno do service
        }));
      }

      console.log('📊 Clientes encontrados:', clients?.length || 0);

      // Se solicitado, buscar conexões Google para cada cliente
      if (includeGoogleConnections && clients && clients.length > 0) {
        // Use service role for Google connections to bypass RLS temporarily
        const supabaseAdmin = createSupabaseClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const clientsWithConnections = await Promise.all(
          clients.map(async (client) => {
            const { data: googleConnections } = await supabaseAdmin
              .from('google_ads_connections')
              .select('id, customer_id, status, last_sync_at, updated_at')
              .eq('client_id', client.id);

            const sortedConnections = [...(googleConnections || [])].sort((a, b) => {
              const priorityA = a.status === 'active' ? 0 : a.status === 'expired' ? 1 : 2;
              const priorityB = b.status === 'active' ? 0 : b.status === 'expired' ? 1 : 2;
              if (priorityA !== priorityB) return priorityA - priorityB;

              const aTime = a.last_sync_at || a.updated_at || '';
              const bTime = b.last_sync_at || b.updated_at || '';
              return bTime.localeCompare(aTime);
            });

            console.log(`[Clients API] Found ${googleConnections?.length || 0} Google connections for client ${client.name}`);

            return {
              ...client,
              googleConnections: sortedConnections
            };
          })
        );

        console.log('✅ Clientes com conexões Google:', clientsWithConnections.length);
        return NextResponse.json({ clients: clientsWithConnections });
      }

      return NextResponse.json({ clients });
    } catch (error) {
      console.error('Erro interno:', error);
      return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
  })(request)
}

// DELETE - Excluir cliente
// Requirements: 6.2, 6.4 - Bloquear exclusão por usuários comuns
const deleteClientMiddleware = createAccessControl.manageUsers('Usuários comuns não podem excluir clientes')

export async function DELETE(request: NextRequest) {
  return deleteClientMiddleware(async (request: NextRequest, context: any) => {
    try {
      console.log('🗑️ [DELETE] Iniciando exclusão de cliente...');
      const supabase = await createClient();
      
      const { searchParams } = new URL(request.url);
      const clientId = searchParams.get('id');

      if (!clientId) {
        return NextResponse.json({ error: 'ID do cliente é obrigatório' }, { status: 400 });
      }

      console.log('🗑️ Tentando excluir cliente:', clientId, 'por usuário:', context.user.email);

      // Buscar o cliente para exclusão
      const { data: existingClient, error: clientError } = await supabase
        .from('clients')
        .select('id, name, org_id')
        .eq('id', clientId)
        .single();

      if (clientError || !existingClient) {
        console.log('❌ Cliente não encontrado:', clientId);
        return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
      }

      // Se não for super admin, verificar se o cliente pertence à organização do usuário
      if (context.userType !== 'super_admin') {
        if (existingClient.org_id !== context.organizationId) {
          console.log('🚫 Acesso negado - cliente não pertence à organização do usuário');
          return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
        }
      }

      console.log('✅ Permissões verificadas. Excluindo cliente:', existingClient.name);

      // Excluir cliente (as tabelas relacionadas devem ter CASCADE configurado)
      const { error: deleteError } = await supabase
        .from('clients')
        .delete()
        .eq('id', clientId);

      if (deleteError) {
        console.error('❌ Erro ao excluir cliente:', deleteError);
        throw deleteError;
      }

      console.log('✅ Cliente excluído com sucesso:', existingClient.name);
      return NextResponse.json({ 
        message: 'Cliente excluído com sucesso',
        clientName: existingClient.name 
      });
    } catch (error: any) {
      console.error('❌ Erro ao excluir cliente:', error);
      return NextResponse.json({ error: error.message || 'Erro interno do servidor' }, { status: 500 });
    }
  })(request)
}
