import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { UserAccessControlService } from '@/lib/services/user-access-control';

// GET - Listar acessos de um usuário específico a clientes
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const supabase = await createClient();
    const { userId } = await params;
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessControl = new UserAccessControlService();
    const userType = await accessControl.getUserType(user.id);
    
    // Verificar se é super admin ou org admin
    if (userType !== 'super_admin' && userType !== 'org_admin') {
      return NextResponse.json({ 
        error: 'Access denied: Admin privileges required' 
      }, { status: 403 });
    }

    // Verificar se o usuário alvo existe
    const { data: targetUser, error: userError } = await supabase
      .from('auth.users')
      .select('id, email, created_at')
      .eq('id', userId)
      .single();

    if (userError || !targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Buscar acessos atuais do usuário
    const { data: clientAccess, error: accessError } = await supabase
      .from('user_client_access')
      .select(`
        id,
        client_id,
        organization_id,
        permissions,
        is_active,
        created_at,
        updated_at,
        notes,
        granted_by,
        clients!inner(id, name, org_id),
        granted_by_user:auth.users!granted_by(email)
      `)
      .eq('user_id', userId)
      .eq('is_active', true);

    if (accessError) throw accessError;

    // Para org admins, filtrar apenas clientes da sua organização
    let filteredAccess = clientAccess || [];
    if (userType === 'org_admin') {
      const { data: membership, error: membershipError } = await supabase
        .from('memberships')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();

      if (membershipError || !membership) {
        return NextResponse.json({ error: 'Organization membership not found' }, { status: 403 });
      }

      filteredAccess = clientAccess?.filter(ca => ca.organization_id === membership.organization_id) || [];
    }

    // Buscar clientes disponíveis para concessão de acesso
    let availableClients = [];
    if (userType === 'super_admin') {
      // Super admins veem todos os clientes
      const { data: allClients, error: clientsError } = await supabase
        .from('clients')
        .select('id, name, org_id')
        .eq('is_active', true)
        .order('name');

      if (!clientsError) {
        availableClients = allClients || [];
      }
    } else if (userType === 'org_admin') {
      // Org admins veem apenas clientes da sua organização
      const { data: membership, error: membershipError } = await supabase
        .from('memberships')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();

      if (!membershipError && membership) {
        const { data: orgClients, error: clientsError } = await supabase
          .from('clients')
          .select('id, name, org_id')
          .eq('org_id', membership.organization_id)
          .eq('is_active', true)
          .order('name');

        if (!clientsError) {
          availableClients = orgClients || [];
        }
      }
    }

    // Formatar resposta
    const accessList = filteredAccess.map(access => ({
      id: access.id,
      clientId: access.client_id,
      clientName: access.clients.name,
      organizationId: access.organization_id,
      permissions: access.permissions,
      grantedAt: access.created_at,
      updatedAt: access.updated_at,
      grantedBy: access.granted_by,
      grantedByEmail: access.granted_by_user?.email,
      notes: access.notes,
      isActive: access.is_active
    }));

    return NextResponse.json({
      user: {
        id: targetUser.id,
        email: targetUser.email,
        createdAt: targetUser.created_at
      },
      accesses: accessList,
      availableClients: availableClients,
      hasAccessTo: accessList.map(access => access.clientId),
      summary: {
        totalAccess: accessList.length,
        availableClients: availableClients.length
      }
    });

  } catch (error: any) {
    console.error('Error fetching user client access:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch user access' },
      { status: 500 }
    );
  }
}