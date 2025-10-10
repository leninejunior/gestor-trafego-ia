import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Buscar organização do usuário
    const { data: membership } = await supabase
      .from("memberships")
      .select("org_id, role")
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: "Organização não encontrada" }, { status: 404 });
    }

    // Buscar membros da organização
    const { data: members, error } = await supabase
      .from("memberships")
      .select(`
        *,
        user_profiles (
          first_name,
          last_name,
          avatar_url,
          last_login_at
        ),
        user_roles (
          name,
          description
        ),
        invited_by_user:auth.users!memberships_invited_by_fkey (
          email
        )
      `)
      .eq("org_id", membership.org_id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao buscar membros:", error);
      return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }

    // Buscar emails dos usuários (necessário fazer join manual)
    const userIds = members?.map(m => m.user_id) || [];
    const { data: users } = await supabase
      .from("auth.users")
      .select("id, email")
      .in("id", userIds);

    // Combinar dados
    const membersWithEmails = members?.map(member => ({
      ...member,
      email: users?.find(u => u.id === member.user_id)?.email
    }));

    return NextResponse.json({ members: membersWithEmails });

  } catch (error) {
    console.error("Erro na API de membros:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}