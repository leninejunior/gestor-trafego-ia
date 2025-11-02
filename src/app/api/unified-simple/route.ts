import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  console.log('🔍 Unified Simple API called - ENTRY POINT');
  
  try {
    console.log('🔍 Unified Simple API - Inside try block');
    
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    
    console.log('🔍 Unified Simple API - Parameters:', { clientId });

    if (!clientId) {
      console.log('🔍 Unified Simple API - No clientId provided');
      return NextResponse.json({ error: 'Client ID required' }, { status: 400 });
    }

    console.log('🔍 Unified Simple API - Creating Supabase client');
    const supabase = await createClient();
    
    console.log('🔍 Unified Simple API - Getting user');
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    console.log('🔍 Unified Simple API - Auth result:', {
      hasUser: !!user,
      userId: user?.id,
      authError: authError?.message
    });

    if (authError || !user) {
      console.log('🔍 Unified Simple API - Authentication failed');
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    console.log('🔍 Unified Simple API - Checking membership');
    const { data: membership, error: membershipError } = await supabase
      .from('organization_memberships')
      .select('client_id, organization_id, role')
      .eq('user_id', user.id)
      .eq('client_id', clientId)
      .single();

    console.log('🔍 Unified Simple API - Membership result:', {
      membership,
      membershipError: membershipError?.message
    });

    if (membershipError || !membership) {
      console.log('🔍 Unified Simple API - Membership check failed');
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    console.log('🔍 Unified Simple API - Success');
    return NextResponse.json({
      success: true,
      message: 'Simple unified API working',
      user: { id: user.id, email: user.email },
      membership,
      clientId
    });

  } catch (error) {
    console.error('❌ Unified Simple API error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}