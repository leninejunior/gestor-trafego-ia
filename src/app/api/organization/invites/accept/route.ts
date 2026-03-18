import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST - Aceitar convite
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    // Usar função do banco para aceitar convite
    const { data: membershipId, error } = await supabase
      .rpc('accept_user_invite', { invite_token: token });

    if (error) {
      if (error.message.includes('Invalid or expired')) {
        return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 400 });
      }
      if (error.message.includes('User limit reached')) {
        return NextResponse.json({ error: 'Organization has reached user limit' }, { status: 403 });
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      membershipId
    });

  } catch (error: any) {
    console.error('Error accepting invite:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to accept invite' },
      { status: 500 }
    );
  }
}
