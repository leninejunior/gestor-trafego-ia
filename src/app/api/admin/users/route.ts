import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

async function checkSuperAdmin(supabase: any, userId: string) {
  // Verificar super_admins table primeiro
  try {
    const { data: superAdmin, error: superError } = await supabase
      .from("super_admins")
      .select("id, is_active")
      .eq("user_id", userId)
      .eq("is_active", true)
      .single();
    
    if (superAdmin && !superError) {
      return true;
    }
  } catch (error) {
    console.log('Super admin check failed:', error);
  }
  
  // Fallback: verificar memberships
  try {
    const { data: membership } = await supabase
      .from("memberships")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["admin", "super_admin", "owner"])
      .single();
    
    return !!membership;
  } catch (error) {
    console.log('Membership check failed:', error);
  }
  
  return false;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    // Verificar autenticação
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Verificar se é super admin
    const isSuperAdmin = await checkSuperAdmin(supabase, user.id);
    if (!isSuperAdmin) {
      if (process.env.NODE_ENV === 'development') {
        console.log('❌ Auth failed for user:', user.id);
        // In development, log but continue for testing
        console.log('🔧 Development mode: Continuing despite auth failure for testing');
      } else {
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
      }
    }

    // Parâmetros de busca
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'all';

    console.log('=== API ADMIN USERS ===');
    console.log('Search:', search);
    console.log('Status:', status);

    // Buscar todos os usuários com seus perfis
    const { data: profiles, error: profilesError } = await supabase
      .from("user_profiles")
      .select(`
        user_id,
        first_name,
        last_name,
        email,
        created_at,
        last_sign_in_at,
        is_suspended
      `)
      .order("created_at", { ascending: false });

    if (profilesError) {
      console.error("Erro ao buscar perfis:", profilesError);
      return NextResponse.json({ error: "Erro ao buscar usuários" }, { status: 500 });
    }

    console.log('Profiles encontrados:', profiles?.length || 0);

    // Buscar memberships para todos os usuários
    const { data: memberships, error: membershipsError } = await supabase
      .from("memberships")
      .select(`
        user_id,
        role,
        status,
        created_at,
        organization_id,
        organizations (
          id,
          name
        )
      `);

    if (membershipsError) {
      console.error("Erro ao buscar memberships:", membershipsError);
    }

    console.log('Memberships encontrados:', memberships?.length || 0);

    // Combinar dados
    const usersWithMemberships = (profiles || []).map(profile => {
      const userMemberships = (memberships || []).filter(m => m.user_id === profile.user_id);
      
      return {
        ...profile,
        id: profile.user_id,
        memberships: userMemberships
      };
    });

    // Aplicar filtros
    let filteredUsers = usersWithMemberships;

    if (search) {
      filteredUsers = filteredUsers.filter(user => 
        user.email?.toLowerCase().includes(search.toLowerCase()) ||
        user.first_name?.toLowerCase().includes(search.toLowerCase()) ||
        user.last_name?.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (status !== 'all') {
      filteredUsers = filteredUsers.filter(user => {
        switch (status) {
          case 'active':
            return user.memberships?.some(m => m.status === 'active') && !user.is_suspended;
          case 'pending':
            return user.memberships?.some(m => m.status === 'pending');
          case 'suspended':
            return user.is_suspended;
          default:
            return true;
        }
      });
    }

    // Calcular estatísticas
    const stats = {
      total: usersWithMemberships.length,
      active: usersWithMemberships.filter(u => 
        u.memberships?.some(m => m.status === 'active') && !u.is_suspended
      ).length,
      pending: usersWithMemberships.filter(u => 
        u.memberships?.some(m => m.status === 'pending')
      ).length,
      suspended: usersWithMemberships.filter(u => u.is_suspended).length,
      superAdmins: usersWithMemberships.filter(u => 
        u.memberships?.some(m => m.role?.includes('super_admin'))
      ).length
    };

    console.log('=== FILTER RESULTS ===');
    console.log('Total users:', usersWithMemberships.length);
    console.log('Filtered users:', filteredUsers.length);
    console.log('Search term:', search);
    console.log('Status filter:', status);

    return NextResponse.json({
      users: filteredUsers,
      stats
    });

  } catch (error) {
    console.error("Erro na API de usuários:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    // Verificar autenticação
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Verificar se é super admin
    const isSuperAdmin = await checkSuperAdmin(supabase, user.id);
    if (!isSuperAdmin) {
      if (process.env.NODE_ENV === 'development') {
        console.log('❌ Auth failed for user:', user.id);
        // In development, log but continue for testing
        console.log('🔧 Development mode: Continuing despite auth failure for testing');
      } else {
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
      }
    }

    const { email, firstName, lastName, organizationId, role } = body;

    if (!email || !firstName || !organizationId || !role) {
      return NextResponse.json({ 
        error: "Email, nome, organização e role são obrigatórios" 
      }, { status: 400 });
    }

    // Verificar se o usuário já existe
    const { data: existingUser } = await supabase
      .from("user_profiles")
      .select("user_id")
      .eq("email", email)
      .single();

    if (existingUser) {
      return NextResponse.json({ 
        error: "Usuário com este email já existe" 
      }, { status: 400 });
    }

    // Criar convite
    const inviteToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { data: invite, error: inviteError } = await supabase
      .from("organization_invites")
      .insert({
        email,
        organization_id: organizationId,
        role,
        invited_by: user.id,
        token: inviteToken,
        expires_at: expiresAt.toISOString(),
        status: 'pending'
      })
      .select()
      .single();

    if (inviteError) {
      console.error("Erro ao criar convite:", inviteError);
      return NextResponse.json({ error: "Erro ao criar convite" }, { status: 500 });
    }

    return NextResponse.json({
      message: "Convite enviado com sucesso",
      invite: {
        id: invite.id,
        email: invite.email,
        token: invite.token,
        expiresAt: invite.expires_at
      }
    });

  } catch (error) {
    console.error("Erro ao criar usuário:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}