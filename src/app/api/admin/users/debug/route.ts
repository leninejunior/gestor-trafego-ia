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

    console.log("=== DEBUG API USUÁRIOS ===");
    console.log("Usuário logado:", user.email, user.id);

    // 1. Buscar dados básicos
    const { data: authUsers, error: authError } = await supabase
      .rpc('exec_sql', { 
        sql: 'SELECT id, email, created_at FROM auth.users ORDER BY created_at' 
      });

    console.log("Auth users:", authUsers, authError);

    // 2. Buscar user_profiles
    const { data: profiles, error: profilesError } = await supabase
      .from("user_profiles")
      .select("*");

    console.log("User profiles:", profiles?.length, profilesError);

    // 3. Buscar memberships
    const { data: memberships, error: membershipsError } = await supabase
      .from("memberships")
      .select("*");

    console.log("Memberships:", memberships?.length, membershipsError);

    // 4. Buscar organizations
    const { data: organizations, error: orgsError } = await supabase
      .from("organizations")
      .select("*");

    console.log("Organizations:", organizations?.length, orgsError);

    // 5. Criar lista de usuários a partir de TODOS os memberships
    const usersList = [];
    const processedUserIds = new Set();

    // Primeiro, adicionar usuários que têm profiles
    if (profiles && profiles.length > 0) {
      for (const profile of profiles) {
        const userMemberships = memberships?.filter(m => m.user_id === profile.user_id) || [];
        processedUserIds.add(profile.user_id);
        
        usersList.push({
          id: profile.user_id,
          user_id: profile.user_id,
          first_name: profile.first_name || '',
          last_name: profile.last_name || '',
          email: profile.email || 'sem-email',
          created_at: profile.created_at,
          last_sign_in_at: profile.last_sign_in_at,
          is_suspended: profile.is_suspended || false,
          memberships: userMemberships.map(m => ({
            id: m.id,
            role: m.role,
            status: m.status,
            created_at: m.created_at,
            organizations: organizations?.find(o => o.id === m.organization_id) || null
          }))
        });
      }
    }

    // 6. Adicionar usuários que só têm memberships (sem profiles)
    if (memberships && memberships.length > 0) {
      const uniqueUserIds = [...new Set(memberships.map(m => m.user_id))];
      
      for (const userId of uniqueUserIds) {
        // Verificar se já foi adicionado pelos profiles
        if (!processedUserIds.has(userId)) {
          const userMemberships = memberships.filter(m => m.user_id === userId);
          
          // Tentar buscar email do auth.users se possível
          let userEmail = 'usuário-' + userId.slice(0, 8);
          if (userId === user.id) {
            userEmail = user.email || userEmail;
          }
          
          usersList.push({
            id: userId,
            user_id: userId,
            first_name: '',
            last_name: '',
            email: userEmail,
            created_at: userMemberships[0]?.created_at || new Date().toISOString(),
            last_sign_in_at: null,
            is_suspended: false,
            memberships: userMemberships.map(m => ({
              id: m.id,
              role: m.role,
              status: m.status,
              created_at: m.created_at,
              organizations: organizations?.find(o => o.id === m.organization_id) || null
            }))
          });
          
          processedUserIds.add(userId);
        }
      }
    }

    // Calcular estatísticas
    const stats = {
      total: usersList.length,
      active: usersList.filter(u => 
        u.memberships?.some(m => m.status === 'active') && !u.is_suspended
      ).length,
      pending: usersList.filter(u => 
        u.memberships?.some(m => m.status === 'pending')
      ).length,
      suspended: usersList.filter(u => u.is_suspended).length,
      superAdmins: usersList.filter(u => 
        u.memberships?.some(m => m.role === 'super_admin')
      ).length
    };

    console.log("=== RESULTADO FINAL ===");
    console.log("Users list:", usersList.length);
    console.log("Stats:", stats);

    return NextResponse.json({
      users: usersList,
      stats,
      debug: {
        method: "debug_manual",
        userEmail: user.email,
        userId: user.id,
        profilesCount: profiles?.length || 0,
        membershipsCount: memberships?.length || 0,
        organizationsCount: organizations?.length || 0,
        rawData: {
          profiles: profiles?.slice(0, 2),
          memberships: memberships?.slice(0, 2),
          organizations: organizations?.slice(0, 2)
        }
      }
    });

  } catch (error) {
    console.error("Erro na API debug:", error);
    return NextResponse.json({ 
      error: "Erro interno do servidor",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}