import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

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
    const { data: userRole } = await supabase
      .from("memberships")
      .select(`
        user_roles!memberships_role_id_fkey (
          name,
          permissions
        )
      `)
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (!userRole?.user_roles?.name?.includes('super_admin')) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const includeStats = searchParams.get('include_stats') === 'true';

    // Buscar organizações
    let query = supabase
      .from("organizations")
      .select(`
        id,
        name,
        created_at,
        is_active,
        subscription_status,
        subscription_plan,
        subscription_expires_at
      `)
      .order("created_at", { ascending: false });

    const { data: organizations, error } = await query;

    if (error) {
      console.error("Erro ao buscar organizações:", error);
      return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
    }

    let result = { organizations };

    if (includeStats) {
      // Buscar estatísticas para cada organização
      const orgsWithStats = await Promise.all(
        organizations.map(async (org) => {
          // Contar membros ativos
          const { count: activeMembers } = await supabase
            .from("memberships")
            .select("*", { count: 'exact', head: true })
            .eq("organization_id", org.id)
            .eq("status", "active");

          // Contar convites pendentes
          const { count: pendingInvites } = await supabase
            .from("organization_invites")
            .select("*", { count: 'exact', head: true })
            .eq("org_id", org.id)
            .eq("status", "pending");

          // Buscar último login de qualquer membro
          const { data: lastActivity } = await supabase
            .from("user_profiles")
            .select("last_sign_in_at")
            .in("id", 
              await supabase
                .from("memberships")
                .select("user_id")
                .eq("organization_id", org.id)
                .eq("status", "active")
                .then(res => res.data?.map(m => m.user_id) || [])
            )
            .order("last_sign_in_at", { ascending: false })
            .limit(1)
            .single();

          return {
            ...org,
            stats: {
              activeMembers: activeMembers || 0,
              pendingInvites: pendingInvites || 0,
              lastActivity: lastActivity?.last_sign_in_at || null
            }
          };
        })
      );

      result = { organizations: orgsWithStats };
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error("Erro na API de organizações:", error);
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
    const { data: userRole } = await supabase
      .from("memberships")
      .select(`
        user_roles!memberships_role_id_fkey (
          name,
          permissions
        )
      `)
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (!userRole?.user_roles?.name?.includes('super_admin')) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const { name, subscriptionPlan, subscriptionExpiresAt } = body;

    if (!name) {
      return NextResponse.json({ 
        error: "Nome da organização é obrigatório" 
      }, { status: 400 });
    }

    // Verificar se a organização já existe
    const { data: existingOrg } = await supabase
      .from("organizations")
      .select("id")
      .eq("name", name)
      .single();

    if (existingOrg) {
      return NextResponse.json({ 
        error: "Organização com este nome já existe" 
      }, { status: 400 });
    }

    // Criar nova organização
    const { data: newOrg, error: createError } = await supabase
      .from("organizations")
      .insert({
        name,
        subscription_plan: subscriptionPlan || 'free',
        subscription_status: 'active',
        subscription_expires_at: subscriptionExpiresAt,
        is_active: true
      })
      .select()
      .single();

    if (createError) {
      console.error("Erro ao criar organização:", createError);
      return NextResponse.json({ error: "Erro ao criar organização" }, { status: 500 });
    }

    return NextResponse.json({
      message: "Organização criada com sucesso",
      organization: newOrg
    });

  } catch (error) {
    console.error("Erro ao criar organização:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}