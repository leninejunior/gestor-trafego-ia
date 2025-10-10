import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: "Token é obrigatório" }, { status: 400 });
    }

    // Chamar função do banco para aceitar convite
    const { data, error } = await supabase.rpc('accept_invite', {
      p_token: token
    });

    if (error) {
      console.error("Erro ao aceitar convite:", error);
      
      if (error.message.includes('Convite inválido ou expirado')) {
        return NextResponse.json({ error: "Convite inválido ou expirado" }, { status: 400 });
      }
      
      if (error.message.includes('Email do usuário não confere')) {
        return NextResponse.json({ error: "Este convite não foi enviado para seu email" }, { status: 400 });
      }
      
      if (error.message.includes('Usuário já é membro')) {
        return NextResponse.json({ error: "Você já é membro desta organização" }, { status: 409 });
      }

      return NextResponse.json({ error: "Erro ao aceitar convite" }, { status: 500 });
    }

    // Buscar informações da nova membership
    const { data: membership } = await supabase
      .from("memberships")
      .select(`
        *,
        organizations (
          id,
          name
        ),
        user_roles (
          name,
          description
        )
      `)
      .eq("id", data)
      .single();

    return NextResponse.json({ 
      message: "Convite aceito com sucesso",
      membership,
      redirect: "/dashboard"
    });

  } catch (error) {
    console.error("Erro na API de aceitar convite:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}