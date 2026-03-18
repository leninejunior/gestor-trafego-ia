import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  console.log('🔍 Test Unified API called');
  
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    
    console.log('📊 Parameters:', { clientId });

    if (!clientId) {
      console.log('❌ No clientId provided');
      return NextResponse.json({ error: 'Client ID required' }, { status: 400 });
    }

    // Test authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    console.log('🔍 Auth result:', {
      hasUser: !!user,
      userId: user?.id,
      authError: authError?.message
    });

    if (authError || !user) {
      console.log('❌ Authentication failed');
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Test membership check
    const { data: membership, error: membershipError } = await supabase
      .from('organization_memberships')
      .select('client_id, organization_id, role')
      .eq('user_id', user.id)
      .eq('client_id', clientId)
      .single();

    console.log('🔍 Membership result:', {
      membership,
      membershipError: membershipError?.message
    });

    if (membershipError || !membership) {
      console.log('❌ Membership check failed');
      
      // Get all user memberships for debug
      const { data: allMemberships } = await supabase
        .from('organization_memberships')
        .select('client_id, organization_id, role')
        .eq('user_id', user.id);
      
      console.log('📋 All user memberships:', allMemberships);
      
      return NextResponse.json({
        error: 'Access denied',
        debug: {
          userId: user.id,
          requestedClientId: clientId,
          userMemberships: allMemberships,
          membershipError: membershipError?.message
        }
      }, { status: 403 });
    }

    console.log('✅ Test successful');
    return NextResponse.json({
      success: true,
      message: 'Test API working',
      user: { id: user.id, email: user.email },
      membership,
      clientId
    });

  } catch (error) {
    console.error('❌ Test API error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}