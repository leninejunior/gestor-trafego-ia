import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Debug endpoint to check authentication status
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
      return NextResponse.json({
        authenticated: false,
        error: authError.message,
        user: null,
        isAdmin: false,
        checks: {}
      });
    }

    if (!user) {
      return NextResponse.json({
        authenticated: false,
        user: null,
        isAdmin: false,
        checks: {}
      });
    }

    // Check admin status in different tables
    const checks: any = {};

    // Check profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    checks.profiles = profile || null;

    // Check memberships
    const { data: memberships } = await supabase
      .from('memberships')
      .select('role, status, organization_id')
      .eq('user_id', user.id);
    checks.memberships = memberships || [];

    // Check admin_users
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('is_admin')
      .eq('user_id', user.id)
      .single();
    checks.admin_users = adminUser || null;

    // Check metadata
    checks.user_metadata = user.user_metadata || {};

    // Determine if admin
    const isAdmin = 
      profile?.role === 'admin' || 
      profile?.role === 'super_admin' ||
      memberships?.some(m => ['admin', 'super_admin', 'owner'].includes(m.role)) ||
      adminUser?.is_admin ||
      user.user_metadata?.role === 'admin' ||
      user.user_metadata?.role === 'super_admin';

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at
      },
      isAdmin,
      checks
    });

  } catch (error) {
    return NextResponse.json({
      authenticated: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      user: null,
      isAdmin: false,
      checks: {}
    }, { status: 500 });
  }
}
