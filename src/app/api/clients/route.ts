import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabase } from '@supabase/auth-ui-shared';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Verificar autenticação do usuário
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    console.log('🔍 Buscando membership para usuário:', user.id, user.email);

    // Buscar organização do usuário com tratamento de erro
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('org_id, role')
      .eq('user_id', user.id)
      .maybeSingle();

    console.log('📊 Resultado membership:', { membership, membershipError });

    if (membershipError) {
      console.error('❌ Erro na query membership:', membershipError);
      return NextResponse.json({ 
        error: `Erro na query membership: ${membershipError.message}` 
      }, { status: 500 });
    }

    let orgId = membership?.org_id;

    if (!membership) {
      console.log('⚠️ Usuário não possui organização. Retornando lista vazia.');
      
      // Não criar organização automaticamente - usuário deve ser convidado ou criar manualmente
      return NextResponse.json({ 
        clients: [],
        message: 'Usuário não possui organização. Entre em contato com um administrador para ser adicionado a uma organização.',
        needsOrganization: true
      });
    }

    console.log('✅ Usando org_id:', orgId);

    // Buscar clientes da organização
    console.log('🔍 Buscando clientes para org_id:', orgId);
    
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, created_at')
      .eq('org_id', orgId)
      .order('name');

    console.log('📊 Resultado clientes:', { clients, clientsError });

    if (clientsError) {
      console.error('❌ Erro ao buscar clientes:', clientsError);
      return NextResponse.json({ error: 'Erro ao buscar clientes' }, { status: 500 });
    }

    console.log('✅ Clientes encontrados:', clients?.length || 0);
    return NextResponse.json({ clients });
  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}