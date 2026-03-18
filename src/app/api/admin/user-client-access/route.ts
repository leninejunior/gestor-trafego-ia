import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { UserAccessControlService } from '@/lib/services/user-access-control';

// GET - Listar acesso de usuários a clientes (deprecated - use GET /api/admin/user-client-access/[userId])
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
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

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId parameter required' }, { status: 400 });
    }

    // Buscar acessos atuais do usuário
    const { data: clientAccess, error: accessError } = await supabase
      .from('user_client_access')
      .select(`
        id,
        client_id,
        permissions,
        is_active,
        created_at,
        notes,
        clients!inner(id, name, org_id)
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

      filteredAccess = clientAccess?.filter(ca => ca.clients.org_id === membership.organization_id) || [];
    }

    // Buscar informações do usuário
    const { data: userInfo, error: userError } = await supabase
      .from('auth.users')
      .select('id, email, created_at')
      .eq('id', userId)
      .single();

    if (userError) throw userError;

    return NextResponse.json({
      user: userInfo,
      client_access: filteredAccess,
      has_access_to: filteredAccess.map(ca => ca.client_id)
    });

  } catch (error: any) {
    console.error('Error fetching user client access:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch user access' },
      { status: 500 }
    );
  }
}

// POST - Conceder acesso a cliente específico
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
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

    const { user_id, client_id, permissions, notes } = await request.json();

    if (!user_id || !client_id) {
      return NextResponse.json({ 
        error: 'user_id and client_id are required' 
      }, { status: 400 });
    }

    // Verificar se o cliente existe e obter sua organização
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name, org_id')
      .eq('id', client_id)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Verificar se o usuário existe
    const { data: targetUser, error: userError } = await supabase
      .from('auth.users')
      .select('id, email')
      .eq('id', user_id)
      .single();

    if (userError || !targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Para org admins, verificar se o cliente pertence à sua organização
    if (userType === 'org_admin') {
      const { data: membership, error: membershipError } = await supabase
        .from('memberships')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();

      if (membershipError || !membership || membership.organization_id !== client.org_id) {
        return NextResponse.json({ 
          error: 'Access denied: Client not in your organization' 
        }, { status: 403 });
      }
    }

    // Verificar se já tem acesso
    const { data: existingAccess } = await supabase
      .from('user_client_access')
      .select('id, is_active')
      .eq('user_id', user_id)
      .eq('client_id', client_id)
      .single();

    if (existingAccess) {
      if (existingAccess.is_active) {
        return NextResponse.json({ 
          error: 'User already has access to this client' 
        }, { status: 400 });
      } else {
        // Reativar acesso existente
        const { error: updateError } = await supabase
          .from('user_client_access')
          .update({ 
            is_active: true,
            permissions: permissions || { read: true, write: false },
            notes: notes || 'Acesso reativado via API administrativa',
            updated_at: new Date().toISOString()
          })
          .eq('id', existingAccess.id);

        if (updateError) throw updateError;

        return NextResponse.json({
          success: true,
          message: 'User access reactivated successfully',
          access_type: 'reactivated'
        });
      }
    }

    // Criar novo acesso
    const { error: insertError } = await supabase
      .from('user_client_access')
      .insert({
        user_id,
        client_id,
        organization_id: client.org_id,
        granted_by: user.id,
        permissions: permissions || { read: true, write: false },
        notes: notes || `Acesso concedido via API administrativa - Cliente: ${client.name}`,
        is_active: true
      });

    if (insertError) throw insertError;

    return NextResponse.json({
      success: true,
      message: 'User access granted successfully',
      user: targetUser,
      client: client,
      access_type: 'created'
    });

  } catch (error: any) {
    console.error('Error granting user client access:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to grant access' },
      { status: 500 }
    );
  }
}

// DELETE - Revogar acesso a cliente
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    
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

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const clientId = searchParams.get('clientId');

    if (!userId || !clientId) {
      return NextResponse.json({ 
        error: 'userId and clientId parameters are required' 
      }, { status: 400 });
    }

    // Verificar se o acesso existe
    const { data: access, error: accessError } = await supabase
      .from('user_client_access')
      .select(`
        id,
        organization_id,
        clients!inner(name, org_id)
      `)
      .eq('user_id', userId)
      .eq('client_id', clientId)
      .eq('is_active', true)
      .single();

    if (accessError || !access) {
      return NextResponse.json({ 
        error: 'Access grant not found or already revoked' 
      }, { status: 404 });
    }

    // Para org admins, verificar se o cliente pertence à sua organização
    if (userType === 'org_admin') {
      const { data: membership, error: membershipError } = await supabase
        .from('memberships')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();

      if (membershipError || !membership || membership.organization_id !== access.organization_id) {
        return NextResponse.json({ 
          error: 'Access denied: Client not in your organization' 
        }, { status: 403 });
      }
    }

    // Revogar acesso (marcar como inativo)
    const { error: updateError } = await supabase
      .from('user_client_access')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString(),
        notes: `Acesso revogado via API administrativa por ${user.email}`
      })
      .eq('id', access.id);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      message: 'User access revoked successfully'
    });

  } catch (error: any) {
    console.error('Error revoking user client access:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to revoke access' },
      { status: 500 }
    );
  }
}