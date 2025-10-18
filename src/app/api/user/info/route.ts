import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();
    
    // Verificar autenticação
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Buscar membership do usuário
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('role, org_id')
      .eq('user_id', user.id)
      .single();

    if (membershipError) {
      console.error('Erro ao buscar membership:', membershipError);
    }

    // Buscar organização
    let orgName = 'Minha Organização';
    if (membership?.org_id) {
      const { data: org } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', membership.org_id)
        .single();
      
      if (org?.name) {
        orgName = org.name;
      }
    }

    const userInfo = {
      email: user.email || '',
      orgName,
      role: membership?.role || 'viewer',
      planName: 'Pro Plan'
    };

    return NextResponse.json(userInfo);

  } catch (error) {
    console.error('Erro ao buscar info do usuário:', error);
    return NextResponse.json({ 
      email: 'Usuário',
      orgName: 'Organização',
      role: 'viewer',
      planName: 'Free'
    }, { status: 200 }); // Retornar 200 mesmo com erro para não quebrar a UI
  }
}