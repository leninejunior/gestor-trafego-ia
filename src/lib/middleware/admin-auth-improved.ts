import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export interface AdminAuthResult {
  success: boolean;
  user?: any;
  error?: string;
  status?: number;
}

/**
 * Simplified admin authentication middleware that uses super_admins table
 */
export async function checkAdminAuth(): Promise<AdminAuthResult> {
  try {
    console.log('🔐 checkAdminAuth: Starting admin authentication check');
    const supabase = await createClient();
    
    // Check authentication
    console.log('🔐 checkAdminAuth: Getting user from Supabase');
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
      console.error('🔐 checkAdminAuth: Auth error:', authError.message);
      return {
        success: false,
        error: 'Authentication required',
        status: 401
      };
    }

    if (!user) {
      console.log('🔐 checkAdminAuth: No user found');
      return {
        success: false,
        error: 'Authentication required',
        status: 401
      };
    }

    console.log('🔐 checkAdminAuth: User found:', user.id);
    
    // Check super_admins table (primary method)
    try {
      const { data: superAdmin, error: superError } = await supabase
        .from('super_admins')
        .select('id, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();
      
      if (superAdmin && !superError) {
        console.log('🔐 checkAdminAuth: User IS super admin - access granted');
        return {
          success: true,
          user
        };
      }
      
      console.log('🔐 checkAdminAuth: Super admin check failed:', superError?.message);
    } catch (error) {
      console.log('🔐 checkAdminAuth: Super admin table check failed:', error);
    }
    
    // Fallback: Check memberships table for admin roles
    try {
      const { data: membership, error: memberError } = await supabase
        .from('memberships')
        .select('role')
        .eq('user_id', user.id)
        .in('role', ['admin', 'super_admin', 'owner'])
        .single();
      
      if (membership && !memberError) {
        console.log('🔐 checkAdminAuth: User IS admin via membership - access granted');
        return {
          success: true,
          user
        };
      }
      
      console.log('🔐 checkAdminAuth: Membership check failed:', memberError?.message);
    } catch (error) {
      console.log('🔐 checkAdminAuth: Membership table check failed:', error);
    }

    // Development fallback - allow specific user
    if (process.env.NODE_ENV === 'development') {
      const allowedEmails = ['lenine.engrene@gmail.com', 'admin@sistema.com'];
      if (user.email && allowedEmails.includes(user.email)) {
        console.log('🔐 checkAdminAuth: Development mode - allowed user access granted');
        return {
          success: true,
          user
        };
      }
    }

    console.log('🔐 checkAdminAuth: User is NOT admin');
    return {
      success: false,
      error: 'Admin access required',
      status: 403
    };

  } catch (error) {
    console.error('🔐 checkAdminAuth: Fatal error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      status: 500
    };
  }
}

/**
 * Helper function to create a standardized error response
 */
export function createAdminAuthErrorResponse(result: AdminAuthResult) {
  return NextResponse.json(
    { success: false, error: result.error },
    { status: result.status || 500 }
  );
}