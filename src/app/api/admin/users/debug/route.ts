import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 API /api/admin/users/debug called');
    
    const serviceSupabase = createServiceClient();
    
    // Debug information
    const debug = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      has_service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    };
    
    console.log('Debug info:', debug);
    
    // Try to get users
    let users = [];
    let error = null;
    
    try {
      const { data: authUsers, error: authError } = await serviceSupabase.auth.admin.listUsers();
      
      if (authError) {
        error = authError.message;
      } else {
        // Get additional user info
        const supabase = await createClient();
        
        // Get super admins
        const { data: superAdmins } = await supabase
          .from('super_admins')
          .select('user_id')
          .eq('is_active', true);
        
        // Get memberships
        const { data: memberships } = await supabase
          .from('memberships')
          .select('user_id, role');
        
        const superAdminIds = new Set(superAdmins?.map(sa => sa.user_id) || []);
        
        users = authUsers.users.map(user => {
          const userMemberships = memberships?.filter(m => m.user_id === user.id) || [];
          
          // Determine user type
          let userType = 'Usuário';
          if (superAdminIds.has(user.id)) {
            userType = 'Super Admin';
          } else if (userMemberships.some(m => m.role === 'admin' || m.role === 'owner')) {
            userType = 'Admin';
          } else if (userMemberships.some(m => m.role === 'super_admin')) {
            userType = 'Super Admin';
          } else if (userMemberships.length > 0) {
            userType = 'Membro';
          }
          
          return {
            id: user.id,
            email: user.email,
            created_at: user.created_at,
            email_confirmed_at: user.email_confirmed_at,
            user_type: userType,
            memberships: userMemberships
          };
        });
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
    }
    
    // Calculate correct stats
    const stats = {
      total: users.length,
      active: users.filter(u => !u.is_suspended).length,
      pending: 0,
      suspended: users.filter(u => u.is_suspended).length,
      superAdmins: users.filter(u => u.user_type === 'Super Admin').length
    };
    
    return NextResponse.json({
      debug,
      users,
      stats,
      error
    });
    
  } catch (error) {
    console.error("Erro na API debug de usuários:", error);
    return NextResponse.json({ 
      error: "Erro interno do servidor",
      debug: {
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }, { status: 500 });
  }
}