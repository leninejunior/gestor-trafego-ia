import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

function normalizeString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

async function sendSupabaseAuthInviteEmail(email: string): Promise<{ ok: boolean; warning?: string }> {
  const serviceSupabase = createServiceClient();
  const configuredBaseUrl = normalizeString(process.env.NEXT_PUBLIC_APP_URL);
  const redirectTo = configuredBaseUrl ? `${configuredBaseUrl.replace(/\/+$/, "")}/login` : undefined;

  const { error } = await serviceSupabase.auth.admin.inviteUserByEmail(email, {
    redirectTo,
  });

  if (error) {
    return { ok: false, warning: error.message || "Invite email could not be sent by Supabase Auth" };
  }

  return { ok: true };
}

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

    // Verificar permissão
    if (!['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    // Buscar convites da organização
    const { data: invites, error } = await supabase
      .from("organization_invites")
      .select(`
        *,
        user_roles (
          name,
          description
        ),
        invited_by_user:auth.users!organization_invites_invited_by_fkey (
          email
        )
      `)
      .eq("org_id", membership.org_id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao buscar convites:", error);
      return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }

    return NextResponse.json({ invites });

  } catch (error) {
    console.error("Erro na API de convites:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { email, role } = await request.json();

    if (!email || !role) {
      return NextResponse.json({ error: "Email e role são obrigatórios" }, { status: 400 });
    }

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 });
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

    // Verificar permissão
    if (!['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: "Sem permissão para convidar usuários" }, { status: 403 });
    }

    // Chamar função do banco para criar convite
    const { data, error } = await supabase.rpc('invite_user_to_org', {
      p_org_id: membership.org_id,
      p_email: email.toLowerCase(),
      p_role_name: role,
      p_invited_by: user.id
    });

    if (error) {
      console.error("Erro ao criar convite:", error);
      
      if (error.message.includes('Já existe um convite pendente')) {
        return NextResponse.json({ error: "Já existe um convite pendente para este email" }, { status: 409 });
      }
      
      if (error.message.includes('Usuário já é membro')) {
        return NextResponse.json({ error: "Usuário já é membro desta organização" }, { status: 409 });
      }
      
      if (error.message.includes('Role não encontrada')) {
        return NextResponse.json({ error: "Função não encontrada" }, { status: 400 });
      }

      return NextResponse.json({ error: "Erro ao criar convite" }, { status: 500 });
    }

    // Buscar o convite criado para retornar
    const { data: newInvite } = await supabase
      .from("organization_invites")
      .select(`
        *,
        user_roles (
          name,
          description
        )
      `)
      .eq("id", data)
      .single();

    const emailDelivery = await sendSupabaseAuthInviteEmail(email.toLowerCase());

    return NextResponse.json({
      message: "Convite criado com sucesso",
      invite: newInvite,
      emailDelivery,
    });

  } catch (error) {
    console.error("Erro na API de convites:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
