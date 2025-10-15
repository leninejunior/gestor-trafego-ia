import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Verificar autenticação
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    console.log("Usuário logado:", user.email);

    // Buscar user_profiles diretamente (mais confiável)
    const { data: profiles, error: profilesError } = await supabase
      .from("user_profiles")
      .select("user_id, email, first_name, last_name, created_at, last_sign_in_at, is_suspended")
      .order("created_at", { ascending: false });

    if (profilesError) {
      console.error("Erro ao buscar user_profiles:", profilesError);
      return NextResponse.json({ 
        error: "Erro ao buscar usuários", 
        details: profilesError.message 
      }, { status: 500 });
    }

    console.log("Profiles encontrados:", profiles?.length);

    // Buscar memberships para cada usuário
    const usersWithMemberships = await Promise.all(
      (profiles || []).map(async (profile) => {
        // Buscar memberships com join para organizations
        const { data: memberships } = await supabase
          .from("memberships")
          .select(`
            id,
            role,
            status,
            created_at,
            accepted_at,
            role_id,
            organizations!memberships_org_id_fkey (
              id,
              name
            )
          `)
          .eq("user_id", profile.user_id);

        return {
          id: profile.user_id,
          user_id: profile.user_id,
          first_name: profile.first_name,
          last_name: profile.last_name,
          email: profile.email,
          created_at: profile.created_at,
          last_sign_in_at: profile.last_sign_in_at,
          is_suspended: profile.is_suspended || false,
          memberships: memberships || []
        };
      })
    );

    // Calcular estatísticas básicas
    const stats = {
      total: profiles?.length || 0,
      active: usersWithMemberships.filter(u => 
        u.memberships?.some(m => m.status === 'active') && !u.is_suspended
      ).length || 0,
      pending: usersWithMemberships.filter(u => 
        u.memberships?.some(m => m.status === 'pending')
      ).length || 0,
      suspended: usersWithMemberships.filter(u => u.is_suspended).length || 0,
      superAdmins: usersWithMemberships.filter(u => 
        u.memberships?.some(m => m.role === 'super_admin')
      ).length || 0
    };

    return NextResponse.json({
      users: usersWithMemberships,
      stats,
      debug: {
        method: "user_profiles_simple",
        userEmail: user.email,
        totalProfiles: profiles?.length,
        sampleUser: profiles?.[0]
      }
    });



  } catch (error) {
    console.error("Erro na API simples de usuários:", error);
    return NextResponse.json({ 
      error: "Erro interno do servidor",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}