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
    const { data: membership } = await supabase
      .from('memberships')
      .select('role, organization_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    // Buscar organização
    let orgName = 'Minha Organização';
    if (membership?.organization_id) {
      const { data: org } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', membership.organization_id)
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
      planName: 'Carregando...'
    });
  }
}