import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 API /api/admin/users/simple called');
    
    // In development, use service client for testing
    const serviceSupabase = createServiceClient();
    
    // Get all users from auth
    const { data: authUsers, error: authError } = await serviceSupabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('Error fetching auth users:', authError);
      return NextResponse.json({ error: "Erro ao buscar usuários" }, { status: 500 });
    }
    
    console.log('Auth users found:', authUsers.users.length);
    
    // Use service client to bypass RLS for admin operations
    const supabase = createServiceClient();
    
    // Get memberships with roles (simplified to avoid relationship issues)
    const { data: memberships, error: membershipError } = await supabase
      .from('memberships')
      .select(`
        user_id, 
        role, 
        role_id,
        status,
        organization_id
      `)
      .eq('status', 'active');
    
    // Get user roles for role_id lookup
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('id, name, description');
    
    // Get user profiles for additional data (exclude deleted users)
    const { data: userProfiles } = await supabase
      .from('user_profiles')
      .select('user_id, first_name, last_name, is_suspended, avatar_url, is_deleted')
      .or('is_deleted.is.null,is_deleted.eq.false');
    
    // Filter out deleted users and transform to simple format
    const activeUsers = authUsers.users.filter(user => {
      const profileData = userProfiles?.find(p => p.user_id === user.id);
      return profileData && !profileData.is_deleted;
    });
    
    const users = activeUsers.map(user => {
      const userMemberships = memberships?.filter(m => m.user_id === user.id) || [];
      
      // Determine user type - check both role field and role_id
      let userType = 'Usuário';
      const isSuperAdmin = userMemberships.some(m => {
        const roleMatch = m.role === 'super_admin';
        const roleIdMatch = m.role_id && userRoles?.find(r => r.id === m.role_id && r.name === 'super_admin');
        return roleMatch || roleIdMatch;
      });
      
      if (isSuperAdmin) {
        userType = 'Super Admin';
      } else if (userMemberships.some(m => m.role === 'admin' || m.role === 'owner')) {
        userType = 'Admin';
      } else if (userMemberships.length > 0) {
        userType = 'Membro';
      }
      
      // Get profile data from user_profiles table
      const profileData = userProfiles?.find(p => p.user_id === user.id);
      
      return {
        id: user.id,
        email: user.email,
        first_name: profileData?.first_name || user.user_metadata?.first_name || '',
        last_name: profileData?.last_name || user.user_metadata?.last_name || '',
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
        is_suspended: profileData?.is_suspended || false,
        user_type: userType,
        memberships: userMemberships
      };
    });
    
    // Calculate correct stats
    const stats = {
      total: users.length,
      active: users.filter(u => !u.is_suspended).length,
      pending: 0,
      suspended: users.filter(u => u.is_suspended).length,
      superAdmins: users.filter(u => u.user_type === 'Super Admin').length
    };
    
    console.log('Returning users:', users.length);
    
    return NextResponse.json({
      users,
      stats
    });
    
  } catch (error) {
    console.error("Erro na API simple de usuários:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}