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

    // Buscar informações do usuário, organização e plano
    const { data: membershipData } = await supabase
      .from('memberships')
      .select(`
        role,
        organizations (
          name
        ),
        subscriptions (
          subscription_plans (
            name
          )
        )
      `)
      .eq('user_id', user.id)
      .single();

    // Buscar plano ativo da organização
    const { data: subscriptionData } = await supabase
      .from('subscriptions')
      .select(`
        subscription_plans (
          name
        )
      `)
      .eq('org_id', membershipData?.organizations?.id || '')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const userInfo = {
      email: user.email || '',
      orgName: membershipData?.organizations?.name || 'Sem organização',
      role: membershipData?.role || 'viewer',
      planName: subscriptionData?.subscription_plans?.name || 'Sem plano'
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