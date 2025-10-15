import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// Cancelar convite
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ inviteId: string }> }
) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { inviteId } = await params;

    // Buscar organização do usuário
    const { data: membership } = await supabase
      .from("memberships")
      .select("organization_id, role")
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: "Organização não encontrada" }, { status: 404 });
    }

    // Verificar permissão
    if (!['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    // Verificar se o convite pertence à organização do usuário
    const { data: invite } = await supabase
      .from("organization_invites")
      .select("id, organization_id, status")
      .eq("id", inviteId)
      .eq("organization_id", membership.organization_id)
      .single();

    if (!invite) {
      return NextResponse.json({ error: "Convite não encontrado" }, { status: 404 });
    }

    if (invite.status !== 'pending') {
      return NextResponse.json({ error: "Convite não pode ser cancelado" }, { status: 400 });
    }

    // Cancelar convite
    const { error } = await supabase
      .from("organization_invites")
      .update({ status: 'cancelled' })
      .eq("id", inviteId);

    if (error) {
      console.error("Erro ao cancelar convite:", error);
      return NextResponse.json({ error: "Erro ao cancelar convite" }, { status: 500 });
    }

    return NextResponse.json({ message: "Convite cancelado com sucesso" });

  } catch (error) {
    console.error("Erro na API de cancelar convite:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// Reenviar convite
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ inviteId: string }> }
) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { inviteId } = await params;

    // Buscar organização do usuário
    const { data: membership } = await supabase
      .from("memberships")
      .select("organization_id, role")
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: "Organização não encontrada" }, { status: 404 });
    }

    // Verificar permissão
    if (!['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    // Buscar convite
    const { data: invite } = await supabase
      .from("organization_invites")
      .select("*")
      .eq("id", inviteId)
      .eq("organization_id", membership.organization_id)
      .single();

    if (!invite) {
      return NextResponse.json({ error: "Convite não encontrado" }, { status: 404 });
    }

    // Gerar novo token e estender expiração
    const newToken = crypto.randomUUID();
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 7);

    const { error } = await supabase
      .from("organization_invites")
      .update({ 
        token: newToken,
        expires_at: newExpiresAt.toISOString(),
        status: 'pending'
      })
      .eq("id", inviteId);

    if (error) {
      console.error("Erro ao reenviar convite:", error);
      return NextResponse.json({ error: "Erro ao reenviar convite" }, { status: 500 });
    }

    return NextResponse.json({ 
      message: "Convite reenviado com sucesso",
      token: newToken
    });

  } catch (error) {
    console.error("Erro na API de reenviar convite:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}