import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export interface AdminAuthResult {
  success: boolean;
  user?: any;
  error?: string;
  status?: number;
}

/**
 * Improved admin authentication middleware that checks multiple sources
 * for admin permissions to handle different system configurations
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
    let isAdmin = false;
    
    // Method 1: Check profiles table
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      
      if (profile?.role === 'admin' || profile?.role === 'super_admin') {
        isAdmin = true;
      }
    } catch (error) {
      console.log('Profiles table check failed:', error);
    }
    
    // Method 2: Check memberships table for admin roles
    if (!isAdmin) {
      try {
        const { data: membership } = await supabase
          .from('memberships')
          .select('role')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single();
        
        if (membership?.role === 'admin' || membership?.role === 'super_admin' || membership?.role === 'owner') {
          isAdmin = true;
        }
      } catch (error) {
        console.log('Memberships table check failed:', error);
      }
    }
    
    // Method 3: Check admin_users table
    if (!isAdmin) {
      try {
        const { data: adminUser } = await supabase
          .from('admin_users')
          .select('is_admin')
          .eq('user_id', user.id)
          .eq('is_admin', true)
          .single();
        
        if (adminUser?.is_admin) {
          isAdmin = true;
        }
      } catch (error) {
        console.log('Admin users table check failed:', error);
      }
    }
    
    // Method 4: Check user metadata for admin flag
    if (!isAdmin && user.user_metadata?.role) {
      if (user.user_metadata.role === 'admin' || user.user_metadata.role === 'super_admin') {
        isAdmin = true;
      }
    }
    
    // Method 5: Development fallback - check if user is first user
    if (!isAdmin && process.env.NODE_ENV === 'development') {
      try {
        // In development, allow the first user to be admin
        // Note: This requires service_role key which may not be available
        if (supabase.auth.admin) {
          const { data: allUsers } = await supabase.auth.admin.listUsers();
          if (allUsers?.users && allUsers.users.length > 0 && allUsers.users[0].id === user.id) {
            isAdmin = true;
            console.log('Development mode: First user granted admin access');
          }
        }
      } catch (error) {
        console.log('Development fallback check failed (this is normal):', error instanceof Error ? error.message : 'Unknown error');
      }
    }

    if (!isAdmin) {
      console.log('🔐 checkAdminAuth: User is NOT admin');
      return {
        success: false,
        error: 'Admin access required',
        status: 403
      };
    }

    console.log('🔐 checkAdminAuth: User IS admin - access granted');
    return {
      success: true,
      user
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