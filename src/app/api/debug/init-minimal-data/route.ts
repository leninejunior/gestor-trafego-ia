import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * Initialize minimal data for authenticated user
 * Creates organization, client, and membership
 */
export async function POST() {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({
        success: false,
        error: "Usuário não autenticado",
        message: "Faça login primeiro"
      }, { status: 401 });
    }

    console.log(`🚀 Inicializando dados mínimos para usuário: ${user.email}`);

    // 1. Create organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({ name: 'Minha Organização' })
      .select()
      .single();

    if (orgError) {
      console.error('❌ Erro ao criar organização:', orgError);
      return NextResponse.json({
        success: false,
        error: "Erro ao criar organização",
        details: orgError.message
      }, { status: 500 });
    }

    console.log(`✅ Organização criada: ${org.id}`);

    // 2. Create client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .insert({
        name: 'Cliente Padrão',
        org_id: org.id
      })
      .select()
      .single();

    if (clientError) {
      console.error('❌ Erro ao criar cliente:', clientError);
      return NextResponse.json({
        success: false,
        error: "Erro ao criar cliente",
        details: clientError.message
      }, { status: 500 });
    }

    console.log(`✅ Cliente criado: ${client.id}`);

    // 3. Create membership
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .insert({
        user_id: user.id,
        org_id: org.id,
        role: 'admin'
      })
      .select()
      .single();

    if (membershipError) {
      console.error('❌ Erro ao criar membership:', membershipError);
      return NextResponse.json({
        success: false,
        error: "Erro ao criar membership",
        details: membershipError.message
      }, { status: 500 });
    }

    console.log(`✅ Membership criado: ${membership.id}`);

    return NextResponse.json({
      success: true,
      message: "Dados mínimos inicializados com sucesso!",
      data: {
        organization: org,
        client: client,
        membership: membership,
        user: {
          id: user.id,
          email: user.email
        }
      }
    });

  } catch (error) {
    console.error('❌ Erro inesperado:', error);
    return NextResponse.json({
      success: false,
      error: "Erro inesperado",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
