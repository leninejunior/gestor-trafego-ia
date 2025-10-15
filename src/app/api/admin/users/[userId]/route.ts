import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

async function checkSuperAdmin(supabase: any, userId: string) {
  const { data: userRole } = await supabase
    .from("memberships")
    .select("role")
    .eq("user_id", userId)
    .eq("status", "active")
    .single();

  return userRole?.role?.includes('super_admin');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const supabase = await createClient();
    const { userId } = await params;
    
    // Verificar autenticação
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Verificar se é super admin
    const isSuperAdmin = await checkSuperAdmin(supabase, user.id);
    if (!isSuperAdmin) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // Buscar dados completos do usuário
    const { data: userData, error } = await supabase
      .from("user_profiles")
      .select(`
        user_id,
        first_name,
        last_name,
        email,
        created_at,
        last_sign_in_at,
        is_suspended,
        suspended_at,
        suspended_by,
        suspension_reason
      `)
      .eq("user_id", userId)
      .single();

    if (error || !userData) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    // Buscar memberships separadamente
    const { data: memberships } = await supabase
      .from("memberships")
      .select(`
        id,
        role,
        status,
        created_at,
        accepted_at,
        organization_id,
        role_id,
        organizations (
          id,
          name,
          created_at
        )
      `)
      .eq("user_id", userId);

    // Criar objeto de resposta com tipos corretos
    const userResponse = {
      ...userData,
      id: userData.user_id,
      memberships: memberships || []
    };

    return NextResponse.json({
      user: userResponse,
      activities: [],
      pendingInvites: []
    });

  } catch (error) {
    console.error("Erro ao buscar usuário:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const supabase = await createClient();
    const { userId } = await params;
    const body = await request.json();
    
    // Verificar autenticação
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Verificar se é super admin
    const isSuperAdmin = await checkSuperAdmin(supabase, user.id);
    if (!isSuperAdmin) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const { action, ...updateData } = body;

    switch (action) {
      case 'update_profile':
        const { firstName, lastName, email } = updateData;
        
        const { error: profileError } = await supabase
          .from("user_profiles")
          .update({
            first_name: firstName,
            last_name: lastName,
            email: email
          })
          .eq("user_id", userId);

        if (profileError) {
          return NextResponse.json({ error: "Erro ao atualizar perfil" }, { status: 500 });
        }
        break;

      case 'suspend':
        const { reason } = updateData;
        
        const { error: suspendError } = await supabase
          .from("user_profiles")
          .update({
            is_suspended: true,
            suspended_at: new Date().toISOString(),
            suspended_by: user.id,
            suspension_reason: reason
          })
          .eq("user_id", userId);

        if (suspendError) {
          return NextResponse.json({ error: "Erro ao suspender usuário" }, { status: 500 });
        }
        break;

      case 'unsuspend':
        const { error: unsuspendError } = await supabase
          .from("user_profiles")
          .update({
            is_suspended: false,
            suspended_at: null,
            suspended_by: null,
            suspension_reason: null
          })
          .eq("user_id", userId);

        if (unsuspendError) {
          return NextResponse.json({ error: "Erro ao reativar usuário" }, { status: 500 });
        }
        break;

      case 'update_role':
        const { membershipId, newRole } = updateData;
        
        const { error: roleError } = await supabase
          .from("memberships")
          .update({
            role: newRole
          })
          .eq("id", membershipId)
          .eq("user_id", userId);

        if (roleError) {
          return NextResponse.json({ error: "Erro ao atualizar role" }, { status: 500 });
        }
        break;

      case 'remove_from_organization':
        const { membershipId: removeMembershipId } = updateData;
        
        const { error: removeError } = await supabase
          .from("memberships")
          .update({
            status: "removed",
            removed_at: new Date().toISOString(),
            removed_by: user.id
          })
          .eq("id", removeMembershipId)
          .eq("user_id", userId);

        if (removeError) {
          return NextResponse.json({ error: "Erro ao remover da organização" }, { status: 500 });
        }
        break;

      default:
        return NextResponse.json({ error: "Ação não reconhecida" }, { status: 400 });
    }

    return NextResponse.json({ message: "Usuário atualizado com sucesso" });

  } catch (error) {
    console.error("Erro ao atualizar usuário:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const supabase = await createClient();
    const { userId } = await params;
    
    // Verificar autenticação
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Verificar se é super admin
    const isSuperAdmin = await checkSuperAdmin(supabase, user.id);
    if (!isSuperAdmin) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // Não permitir deletar o próprio usuário
    if (userId === user.id) {
      return NextResponse.json({ 
        error: "Não é possível deletar seu próprio usuário" 
      }, { status: 400 });
    }

    // Verificar se o usuário existe
    const { data: userData } = await supabase
      .from("user_profiles")
      .select("user_id, email")
      .eq("user_id", userId)
      .single();

    if (!userData) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    // Marcar todas as memberships como removidas
    await supabase
      .from("memberships")
      .update({
        status: "removed",
        removed_at: new Date().toISOString(),
        removed_by: user.id
      })
      .eq("user_id", userId);

    // Marcar o usuário como deletado (soft delete)
    const { error: deleteError } = await supabase
      .from("user_profiles")
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by: user.id
      })
      .eq("user_id", userId);

    if (deleteError) {
      return NextResponse.json({ error: "Erro ao deletar usuário" }, { status: 500 });
    }

    return NextResponse.json({ message: "Usuário deletado com sucesso" });

  } catch (error) {
    console.error("Erro ao deletar usuário:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}