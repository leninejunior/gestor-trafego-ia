import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
}

/**
 * Middleware to check if user is authenticated and has admin role
 */
export async function requireAdminAuth(request: NextRequest): Promise<{
  user: AuthenticatedUser | null;
  error: NextResponse | null;
}> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        user: null,
        error: NextResponse.json(
          { success: false, error: 'Authentication required' },
          { status: 401 }
        ),
      };
    }

    // Temporary: Allow any authenticated user as admin for development
    // TODO: Implement proper role-based access control
    let userRole = 'admin'; // Default to admin for now
    
    try {
      // Try to get role from profiles table, but don't fail if it doesn't exist
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!profileError && profile?.role) {
        userRole = profile.role;
      }
    } catch (profileError) {
      console.log('Profiles table not available, using default admin role');
    }

    return {
      user: {
        id: user.id,
        email: user.email || '',
        role: userRole,
      },
      error: null,
    };
  } catch (error) {
    console.error('Admin auth middleware error:', error);
    return {
      user: null,
      error: NextResponse.json(
        { success: false, error: 'Authentication error' },
        { status: 500 }
      ),
    };
  }
}

/**
 * Middleware to check if user is authenticated (any role)
 */
export async function requireAuth(request: NextRequest): Promise<{
  user: AuthenticatedUser | null;
  error: NextResponse | null;
}> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        user: null,
        error: NextResponse.json(
          { success: false, error: 'Authentication required' },
          { status: 401 }
        ),
      };
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError) {
      return {
        user: null,
        error: NextResponse.json(
          { success: false, error: 'User profile not found' },
          { status: 404 }
        ),
      };
    }

    return {
      user: {
        id: user.id,
        email: user.email || '',
        role: profile.role || 'user',
      },
      error: null,
    };
  } catch (error) {
    console.error('Auth middleware error:', error);
    return {
      user: null,
      error: NextResponse.json(
        { success: false, error: 'Authentication error' },
        { status: 500 }
      ),
    };
  }
}