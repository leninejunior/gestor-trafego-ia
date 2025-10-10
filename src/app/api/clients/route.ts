import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
      console.log('⚠️ Nenhum membership encontrado. Tentando criar organização...');
      
      try {
        // Tentar criar organização automaticamente
        const { data: newOrgId, error: rpcError } = await supabase.rpc('create_org_and_add_admin');
        
        if (rpcError) {
          console.error('❌ Erro ao criar organização:', rpcError);
          return NextResponse.json({ 
            error: `Não foi possível criar organização: ${rpcError.message}` 
          }, { status: 500 });
        }
        
        console.log('✅ Organização criada automaticamente:', newOrgId);
        
        // Buscar o membership recém-criado
        const { data: newMembership } = await supabase
          .from('memberships')
          .select('org_id')
          .eq('user_id', user.id)
          .single();
        
        if (newMembership) {
          orgId = newMembership.org_id;
          console.log('✅ Novo membership encontrado:', orgId);
        } else {
          return NextResponse.json({ 
            error: 'Falha ao criar membership automaticamente' 
          }, { status: 500 });
        }
        
      } catch (autoCreateError: any) {
        console.error('❌ Falha na criação automática:', autoCreateError);
        return NextResponse.json({ 
          error: `Organização não encontrada e não foi possível criar automaticamente: ${autoCreateError.message}` 
        }, { status: 500 });
      }
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