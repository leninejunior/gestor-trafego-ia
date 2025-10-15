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

    // Buscar todas as roles
    const { data: roles, error } = await supabase
      .from("user_roles")
      .select(`
        id,
        name,
        description,
        permissions,
        created_at,
        is_system_role
      `)
      .order("name");

    if (error) {
      console.error("Erro ao buscar roles:", error);
      return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
    }

    return NextResponse.json({ roles });

  } catch (error) {
    console.error("Erro na API de roles:", error);
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

    const { name, description, permissions } = body;

    if (!name || !permissions) {
      return NextResponse.json({ 
        error: "Nome e permissões são obrigatórios" 
      }, { status: 400 });
    }

    // Verificar se a role já existe
    const { data: existingRole } = await supabase
      .from("user_roles")
      .select("id")
      .eq("name", name)
      .single();

    if (existingRole) {
      return NextResponse.json({ 
        error: "Role com este nome já existe" 
      }, { status: 400 });
    }

    // Criar nova role
    const { data: newRole, error: createError } = await supabase
      .from("user_roles")
      .insert({
        name,
        description,
        permissions,
        is_system_role: false
      })
      .select()
      .single();

    if (createError) {
      console.error("Erro ao criar role:", createError);
      return NextResponse.json({ error: "Erro ao criar role" }, { status: 500 });
    }

    return NextResponse.json({
      message: "Role criada com sucesso",
      role: newRole
    });

  } catch (error) {
    console.error("Erro ao criar role:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}