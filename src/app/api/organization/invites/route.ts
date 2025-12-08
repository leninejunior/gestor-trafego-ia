import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { randomBytes } from 'crypto';

// GET - Listar convites pendentes
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: membership } = await supabase
      .from('memberships')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .single();

    if (!membership || !['admin', 'owner'].includes(membership.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { data: invites, error } = await supabase
      .from('user_invites')
      .select('*')
      .eq('org_id', membership.organization_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ invites: invites || [] });

  } catch (error: any) {
    console.error('Error fetching invites:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch invites' },
      { status: 500 }
    );
  }
}

// POST - Criar novo convite
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email, role = 'member' } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    if (!['admin', 'member', 'viewer'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Verificar se usuário é admin
    const { data: membership } = await supabase
      .from('memberships')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .single();

    if (!membership || !['admin', 'owner'].includes(membership.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Verificar limite de usuários
    const { data: limits } = await supabase
      .rpc('get_org_user_limit', { org_uuid: membership.organization_id })
      .single();

    if (limits && !limits.can_add_more) {
      return NextResponse.json(
        { 
          error: 'User limit reached',
          details: `Your plan allows ${limits.max_users} user(s). Please upgrade to add more users.`
        },
        { status: 403 }
      );
    }

    // Verificar se email já está na organização
    const { data: existingUser } = await supabase
      .from('organization_users')
      .select('email')
      .eq('org_id', membership.organization_id)
      .eq('email', email)
      .single();

    if (existingUser) {
      return NextResponse.json(
        { error: 'User already in organization' },
        { status: 400 }
      );
    }

    // Verificar se já existe convite pendente
    const { data: existingInvite } = await supabase
      .from('user_invites')
      .select('id')
      .eq('org_id', membership.organization_id)
      .eq('email', email)
      .eq('status', 'pending')
      .single();

    if (existingInvite) {
      return NextResponse.json(
        { error: 'Invite already sent to this email' },
        { status: 400 }
      );
    }

    // Gerar token único
    const token = randomBytes(32).toString('hex');

    // Criar convite
    const { data: invite, error: inviteError } = await supabase
      .from('user_invites')
      .insert({
        org_id: membership.organization_id,
        email,
        role,
        invited_by: user.id,
        token
      })
      .select()
      .single();

    if (inviteError) throw inviteError;

    // TODO: Enviar email com link de convite
    const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${token}`;

    return NextResponse.json({
      success: true,
      invite,
      inviteLink
    });

  } catch (error: any) {
    console.error('Error creating invite:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create invite' },
      { status: 500 }
    );
  }
}

// DELETE - Cancelar convite
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const inviteId = searchParams.get('inviteId');

    if (!inviteId) {
      return NextResponse.json({ error: 'Invite ID required' }, { status: 400 });
    }

    // Verificar se usuário é admin
    const { data: membership } = await supabase
      .from('memberships')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .single();

    if (!membership || !['admin', 'owner'].includes(membership.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Cancelar convite
    const { error: updateError } = await supabase
      .from('user_invites')
      .update({ status: 'cancelled' })
      .eq('id', inviteId)
      .eq('org_id', membership.organization_id);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Error cancelling invite:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to cancel invite' },
      { status: 500 }
    );
  }
}
