import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isSuperAdmin } from '@/lib/auth/super-admin';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Verificar autenticação do usuário
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    console.log('🔍 Verificando se é super admin:', user.id, user.email);

    // Verificar se é super admin
    const isSuper = await isSuperAdmin(user.id);
    console.log('👑 É super admin?', isSuper);

    let orgId = null;

    if (isSuper) {
      console.log('👑 Super admin detectado - acesso total aos clientes');
      // Super admin pode ver todos os clientes - não precisa de org_id
    } else {
      // Usuário normal - buscar organização
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

      orgId = membership?.org_id;

      if (!membership) {
        console.log('⚠️ Usuário não possui organização. Retornando lista vazia.');
        
        return NextResponse.json({ 
          clients: [],
          message: 'Usuário não possui organização. Entre em contato com um administrador para ser adicionado a uma organização.',
          needsOrganization: true
        });
      }

      console.log('✅ Usando org_id:', orgId);
    }

    // Verificar se deve incluir conexões Google
    const { searchParams } = new URL(request.url);
    const includeGoogleConnections = searchParams.get('includeGoogleConnections') === 'true';

    // Buscar clientes
    let clients, clientsError;
    
    if (isSuper) {
      console.log('🔍 Super admin - buscando TODOS os clientes');
      const result = await supabase
        .from('clients')
        .select(`
          id, 
          name, 
          created_at,
          organizations!inner(id, name)
        `)
        .order('name');
      clients = result.data;
      clientsError = result.error;
    } else {
      console.log('🔍 Usuário normal - buscando clientes para org_id:', orgId);
      const result = await supabase
        .from('clients')
        .select('id, name, created_at')
        .eq('org_id', orgId)
        .order('name');
      clients = result.data;
      clientsError = result.error;
    }

    console.log('📊 Resultado clientes:', { clients, clientsError });

    if (clientsError) {
      console.error('❌ Erro ao buscar clientes:', clientsError);
      return NextResponse.json({ error: 'Erro ao buscar clientes' }, { status: 500 });
    }

    // Se solicitado, buscar conexões Google para cada cliente
    if (includeGoogleConnections && clients && clients.length > 0) {
      const clientsWithConnections = await Promise.all(
        clients.map(async (client) => {
          const { data: googleConnections } = await supabase
            .from('google_ads_connections')
            .select('id, customer_id, status')
            .eq('client_id', client.id);

          return {
            ...client,
            googleConnections: googleConnections || []
          };
        })
      );

      console.log('✅ Clientes com conexões Google:', clientsWithConnections.length);
      return NextResponse.json({ clients: clientsWithConnections });
    }

    console.log('✅ Clientes encontrados:', clients?.length || 0);
    return NextResponse.json({ clients });
  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// DELETE - Excluir cliente
export async function DELETE(request: NextRequest) {
  try {
    console.log('🗑️ [DELETE] Iniciando exclusão de cliente...');
    const supabase = await createClient();
    
    // Verificar autenticação do usuário
    console.log('🔐 [DELETE] Verificando autenticação...');
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    console.log('👤 [DELETE] Resultado auth:', { 
      hasUser: !!user, 
      userId: user?.id, 
      email: user?.email,
      error: userError?.message 
    });
    
    if (userError || !user) {
      console.log('❌ [DELETE] Falha na autenticação:', userError?.message);
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('id');

    if (!clientId) {
      return NextResponse.json({ error: 'ID do cliente é obrigatório' }, { status: 400 });
    }

    console.log('🗑️ Tentando excluir cliente:', clientId, 'por usuário:', user.email);

    // Verificar se é super admin primeiro
    const isSuper = await isSuperAdmin(user.id);
    
    if (isSuper) {
      console.log('👑 Super admin pode excluir qualquer cliente');
      // Super admin pode excluir qualquer cliente - pular verificação de organização
    } else {
      // Usuário normal - verificar organização
      const { data: membership, error: membershipError } = await supabase
        .from('memberships')
        .select('org_id, role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (membershipError) {
        console.error('❌ Erro na query membership:', membershipError);
        return NextResponse.json({ error: 'Erro ao verificar permissões' }, { status: 500 });
      }

      if (!membership) {
        console.log('⚠️ Usuário não possui organização');
        return NextResponse.json({ error: 'Usuário não possui organização' }, { status: 403 });
      }

      // Verificar se o cliente pertence à organização do usuário
      const { data: existingClient, error: clientError } = await supabase
        .from('clients')
        .select('id, name, org_id')
        .eq('id', clientId)
        .single();

      if (clientError || !existingClient) {
        console.log('❌ Cliente não encontrado:', clientId);
        return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
      }

      if (existingClient.org_id !== membership.org_id) {
        console.log('🚫 Acesso negado - cliente não pertence à organização do usuário');
        return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
      }
    }

    // Buscar o cliente para exclusão
    const { data: existingClient, error: clientError } = await supabase
      .from('clients')
      .select('id, name, org_id')
      .eq('id', clientId)
      .single();

    if (clientError || !existingClient) {
      console.log('❌ Cliente não encontrado:', clientId);
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
    }

    console.log('✅ Permissões verificadas. Excluindo cliente:', existingClient.name);

    // Excluir cliente (as tabelas relacionadas devem ter CASCADE configurado)
    const { error: deleteError } = await supabase
      .from('clients')
      .delete()
      .eq('id', clientId);

    if (deleteError) {
      console.error('❌ Erro ao excluir cliente:', deleteError);
      throw deleteError;
    }

    console.log('✅ Cliente excluído com sucesso:', existingClient.name);
    return NextResponse.json({ 
      message: 'Cliente excluído com sucesso',
      clientName: existingClient.name 
    });
  } catch (error: any) {
    console.error('❌ Erro ao excluir cliente:', error);
    return NextResponse.json({ error: error.message || 'Erro interno do servidor' }, { status: 500 });
  }
}