import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - Listar usuários da organização
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Buscar organização do usuário
    const { data: membership } = await supabase
      .from('memberships')
      .select('org_id, role')
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }

    // Buscar todos os usuários da organização
    const { data: users, error } = await supabase
      .from('organization_users')
      .select('*')
      .eq('org_id', membership.org_id)
      .order('joined_at', { ascending: false });

    if (error) throw error;

    // Buscar limites do plano
    const { data: limits } = await supabase
      .rpc('get_org_user_limit', { org_uuid: membership.org_id })
      .single();

    return NextResponse.json({
      users: users || [],
      limits: limits || { current_users: 0, max_users: 1, can_add_more: false, plan_name: 'Free' },
      currentUserRole: membership.role
    });

  } catch (error: any) {
    console.error('Error fetching organization users:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// DELETE - Remover usuário da organização
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const membershipId = searchParams.get('membershipId');

    if (!membershipId) {
      return NextResponse.json({ error: 'Membership ID required' }, { status: 400 });
    }

    // Verificar se usuário é admin
    const { data: adminMembership } = await supabase
      .from('memberships')
      .select('org_id, role')
      .eq('user_id', user.id)
      .single();

    if (!adminMembership || !['admin', 'owner'].includes(adminMembership.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Buscar membership a ser removido
    const { data: targetMembership } = await supabase
      .from('memberships')
      .select('user_id, org_id')
      .eq('id', membershipId)
      .single();

    if (!targetMembership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 });
    }

    // Verificar se pertence à mesma organização
    if (targetMembership.org_id !== adminMembership.org_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Não pode remover a si mesmo
    if (targetMembership.user_id === user.id) {
      return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 });
    }

    // Remover membership
    const { error: deleteError } = await supabase
      .from('memberships')
      .delete()
      .eq('id', membershipId);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Error removing user:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to remove user' },
      { status: 500 }
    );
  }
}
