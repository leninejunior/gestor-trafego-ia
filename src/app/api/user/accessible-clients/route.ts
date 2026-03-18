import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/user/accessible-clients
 * Retorna lista de clientes que o usuário atual pode acessar
 */
export async function GET(_request: NextRequest) {
  try {
    console.log('[accessible-clients] Iniciando busca de clientes...');
    
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    console.log('[accessible-clients] Auth result:', { 
      userId: user?.id, 
      authError: authError?.message 
    });

    if (authError || !user) {
      console.log('[accessible-clients] Usuário não autenticado');
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    // Verificar se é super admin
    const { data: superAdmin, error: superAdminError } = await supabase
      .from('super_admins')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    console.log('[accessible-clients] Super admin check:', { 
      isSuperAdmin: !!superAdmin, 
      error: superAdminError?.message 
    });

    let clients: any[] = []

    if (superAdmin) {
      // Super admin: buscar todos os clientes
      const { data: allClients, error } = await supabase
        .from('clients')
        .select('id, name, org_id')
        .order('name')

      console.log('[accessible-clients] Super admin - clientes:', { 
        count: allClients?.length, 
        error: error?.message 
      });

      if (!error && allClients) {
        clients = allClients
      }
    } else {
      // Usuário normal: buscar clientes da organização
      const { data: membership, error: membershipError } = await supabase
        .from('memberships')
        .select('organization_id')
        .eq('user_id', user.id)
        .single()

      console.log('[accessible-clients] Membership:', { 
        orgId: membership?.organization_id, 
        error: membershipError?.message 
      });

      if (membership) {
        const { data: orgClients, error } = await supabase
          .from('clients')
          .select('id, name, org_id')
          .eq('org_id', membership.organization_id)
          .order('name')

        console.log('[accessible-clients] Org clients:', { 
          count: orgClients?.length, 
          error: error?.message 
        });

        if (!error && orgClients) {
          clients = orgClients
        }
      }
    }

    // Buscar informações de conexão Meta para cada cliente
    const clientIds = clients.map(c => c.id)
    
    if (clientIds.length > 0) {
      const { data: metaConnections } = await supabase
        .from('client_meta_connections')
        .select('client_id')
        .in('client_id', clientIds)
        .eq('is_active', true)

      // Criar set de clientes com conexão Meta
      const clientsWithMeta = new Set(metaConnections?.map(c => c.client_id) || [])

      // Adicionar flag de conexão Meta aos clientes
      clients = clients.map(client => ({
        ...client,
        has_meta_connection: clientsWithMeta.has(client.id)
      }))
    }

    console.log('[accessible-clients] Retornando:', { 
      clientCount: clients.length, 
      userId: user.id 
    });

    return NextResponse.json({ 
      clients,
      count: clients.length,
      userId: user.id
    })
  } catch (error) {
    console.error('[accessible-clients] Erro:', error)
    return NextResponse.json(
      { 
        error: 'Erro ao buscar clientes acessíveis',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    )
  }
}
