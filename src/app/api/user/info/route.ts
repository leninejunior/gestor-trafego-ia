import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    
    // Verificar autenticação (cookies ou header)
    let user = null;
    
    // Tentar via cookies primeiro
    const { data: { user: cookieUser } } = await supabase.auth.getUser();
    if (cookieUser) {
      user = cookieUser;
    } else {
      // Tentar via header Authorization
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const { createClient: createSupabaseClient } = require('@supabase/supabase-js');
        const authSupabase = createSupabaseClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            global: {
              headers: {
                Authorization: `Bearer ${token}`
              }
            }
          }
        );
        
        const { data: { user: headerUser } } = await authSupabase.auth.getUser();
        user = headerUser;
      }
    }
    
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Usar service client para consultas no banco
    const serviceSupabase = createServiceClient();
    
    // Buscar membership do usuário
    const { data: membership, error: membershipError } = await serviceSupabase
      .from('memberships')
      .select(`
        role,
        organization_id,
        user_roles (
          name
        )
      `)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .single();

    if (membershipError) {
      console.error('Erro ao buscar membership:', membershipError);
    }

    // Buscar organização
    let orgName = 'Minha Organização';
    if (membership?.organization_id) {
      const { data: org } = await serviceSupabase
        .from('organizations')
        .select('name')
        .eq('id', membership.organization_id)
        .single();
      
      if (org?.name) {
        orgName = org.name;
      }
    }

    // Buscar dados do perfil do usuário
    const { data: userProfile } = await serviceSupabase
      .from('user_profiles')
      .select('first_name, last_name, email')
      .eq('user_id', user.id)
      .single();

    // Determinar o role correto
    let userRole = 'viewer';
    if (membership?.user_roles?.name) {
      userRole = membership.user_roles.name;
    } else if (membership?.role) {
      userRole = membership.role;
    }

    // Verificar se é super admin
    const { data: superAdmin } = await serviceSupabase
      .from('super_admins')
      .select('is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (superAdmin) {
      userRole = 'super_admin';
    }

    const displayName = userProfile?.first_name && userProfile?.last_name 
      ? `${userProfile.first_name} ${userProfile.last_name}`
      : userProfile?.email || user.email || 'Usuário';

    const userInfo = {
      email: userProfile?.email || user.email || '',
      displayName,
      orgName,
      role: userRole,
      planName: 'Pro Plan'
    };

    return NextResponse.json(userInfo);

  } catch (error) {
    console.error('Erro ao buscar info do usuário:', error);
    return NextResponse.json({ 
      email: 'Usuário',
      orgName: 'Organização',
      role: 'viewer',
      planName: 'Free'
    }, { status: 200 }); // Retornar 200 mesmo com erro para não quebrar a UI
  }
}