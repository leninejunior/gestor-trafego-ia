import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// Atualizar role do membro
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { memberId } = await params;
    const { role, status } = await request.json();

    // Buscar organização do usuário atual
    const { data: currentMembership } = await supabase
      .from("memberships")
      .select("org_id, role")
      .eq("user_id", user.id)
      .single();

    if (!currentMembership) {
      return NextResponse.json({ error: "Organização não encontrada" }, { status: 404 });
    }

    // Verificar permissão
    if (!['owner', 'admin'].includes(currentMembership.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    // Buscar membro a ser atualizado
    const { data: targetMember } = await supabase
      .from("memberships")
      .select("*")
      .eq("id", memberId)
      .eq("org_id", currentMembership.org_id)
      .single();

    if (!targetMember) {
      return NextResponse.json({ error: "Membro não encontrado" }, { status: 404 });
    }

    // Não permitir que admin altere owner
    if (targetMember.role === 'owner' && currentMembership.role !== 'owner') {
      return NextResponse.json({ error: "Sem permissão para alterar proprietário" }, { status: 403 });
    }

    // Não permitir que owner se remova se for o único
    if (targetMember.user_id === user.id && targetMember.role === 'owner') {
      const { data: ownerCount } = await supabase
        .from("memberships")
        .select("id")
        .eq("org_id", currentMembership.org_id)
        .eq("role", "owner");

      if (ownerCount && ownerCount.length <= 1) {
        return NextResponse.json({ 
          error: "Não é possível remover o último proprietário" 
        }, { status: 400 });
      }
    }

    const updateData: any = {};
    
    if (role) {
      // Buscar role_id
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("id")
        .eq("name", role)
        .single();

      if (!roleData) {
        return NextResponse.json({ error: "Função não encontrada" }, { status: 400 });
      }

      updateData.role = role;
      updateData.role_id = roleData.id;
    }

    if (status) {
      updateData.status = status;
    }

    // Atualizar membro
    const { error } = await supabase
      .from("memberships")
      .update(updateData)
      .eq("id", memberId);

    if (error) {
      console.error("Erro ao atualizar membro:", error);
      return NextResponse.json({ error: "Erro ao atualizar membro" }, { status: 500 });
    }

    return NextResponse.json({ message: "Membro atualizado com sucesso" });

  } catch (error) {
    console.error("Erro na API de atualizar membro:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// Remover membro
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { memberId } = await params;

    // Buscar organização do usuário atual
    const { data: currentMembership } = await supabase
      .from("memberships")
      .select("org_id, role")
      .eq("user_id", user.id)
      .single();

    if (!currentMembership) {
      return NextResponse.json({ error: "Organização não encontrada" }, { status: 404 });
    }

    // Verificar permissão
    if (!['owner', 'admin'].includes(currentMembership.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    // Buscar membro a ser removido
    const { data: targetMember } = await supabase
      .from("memberships")
      .select("*")
      .eq("id", memberId)
      .eq("org_id", currentMembership.org_id)
      .single();

    if (!targetMember) {
      return NextResponse.json({ error: "Membro não encontrado" }, { status: 404 });
    }

    // Não permitir que admin remova owner
    if (targetMember.role === 'owner' && currentMembership.role !== 'owner') {
      return NextResponse.json({ error: "Sem permissão para remover proprietário" }, { status: 403 });
    }

    // Não permitir que owner se remova se for o único
    if (targetMember.user_id === user.id && targetMember.role === 'owner') {
      const { data: ownerCount } = await supabase
        .from("memberships")
        .select("id")
        .eq("org_id", currentMembership.org_id)
        .eq("role", "owner");

      if (ownerCount && ownerCount.length <= 1) {
        return NextResponse.json({ 
          error: "Não é possível remover o último proprietário" 
        }, { status: 400 });
      }
    }

    // Remover membro
    const { error } = await supabase
      .from("memberships")
      .delete()
      .eq("id", memberId);

    if (error) {
      console.error("Erro ao remover membro:", error);
      return NextResponse.json({ error: "Erro ao remover membro" }, { status: 500 });
    }

    return NextResponse.json({ message: "Membro removido com sucesso" });

  } catch (error) {
    console.error("Erro na API de remover membro:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}