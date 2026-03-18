import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// PATCH - Atualizar role do usuário
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const supabase = await createClient();
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = await params;
    const { role } = await request.json();

    if (!role || !['admin', 'member', 'viewer'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Verificar se usuário é admin
    const { data: adminMembership } = await supabase
      .from('memberships')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .single();

    if (!adminMembership || !['admin', 'owner'].includes(adminMembership.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Buscar membership do usuário alvo
    const { data: targetMembership } = await supabase
      .from('memberships')
      .select('organization_id, role')
      .eq('user_id', userId)
      .single();

    if (!targetMembership) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verificar se pertence à mesma organização
    if (targetMembership.organization_id !== adminMembership.organization_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Não pode alterar próprio role
    if (userId === user.id) {
      return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 });
    }

    // Atualizar role
    const { error: updateError } = await supabase
      .from('memberships')
      .update({ role })
      .eq('user_id', userId)
      .eq('organization_id', adminMembership.organization_id);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, role });

  } catch (error: any) {
    console.error('Error updating user role:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update user' },
      { status: 500 }
    );
  }
}
