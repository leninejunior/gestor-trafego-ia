import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { clientId } = await request.json();

    if (!clientId) {
      return NextResponse.json({ error: 'clientId é obrigatório' }, { status: 400 });
    }

    // Verificar se o usuário tem acesso ao cliente
    const { data: client } = await supabase
      .from('clients')
      .select('id, org_id')
      .eq('id', clientId)
      .single();

    if (!client) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
    }

    // Verificar se o usuário pertence à organização
    const { data: membership } = await supabase
      .from('memberships')
      .select('id')
      .eq('user_id', user.id)
      .eq('organization_id', client.org_id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    // 1. Buscar conexões existentes antes de limpar
    const { data: existingConnections } = await supabase
      .from('client_meta_connections')
      .select('*')
      .eq('client_id', clientId);

    console.log(`[Meta Cleanup] Cliente ${clientId} tem ${existingConnections?.length || 0} conexões`);

    // 2. Desativar todas as conexões antigas deste cliente
    const { error: deactivateError } = await supabase
      .from('client_meta_connections')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('client_id', clientId);

    if (deactivateError) {
      console.error('[Meta Cleanup] Erro ao desativar conexões:', deactivateError);
      throw deactivateError;
    }

    // 3. Remover duplicatas (manter apenas a mais recente por ad_account_id)
    if (existingConnections && existingConnections.length > 0) {
      const accountGroups = existingConnections.reduce((acc, conn) => {
        if (!acc[conn.ad_account_id]) {
          acc[conn.ad_account_id] = [];
        }
        acc[conn.ad_account_id].push(conn);
        return acc;
      }, {} as Record<string, any[]>);

      const idsToDelete: string[] = [];
      
      Object.values(accountGroups).forEach(group => {
        if (group.length > 1) {
          // Ordenar por data de criação (mais recente primeiro)
          group.sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          // Deletar todas exceto a primeira (mais recente)
          idsToDelete.push(...group.slice(1).map(c => c.id));
        }
      });

      if (idsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('client_meta_connections')
          .delete()
          .in('id', idsToDelete);

        if (deleteError) {
          console.error('[Meta Cleanup] Erro ao deletar duplicatas:', deleteError);
        } else {
          console.log(`[Meta Cleanup] Removidas ${idsToDelete.length} conexões duplicadas`);
        }
      }
    }

    // 4. Buscar conexões finais
    const { data: finalConnections, count } = await supabase
      .from('client_meta_connections')
      .select('*', { count: 'exact' })
      .eq('client_id', clientId);

    return NextResponse.json({
      success: true,
      message: 'Conexões antigas limpas com sucesso',
      stats: {
        before: existingConnections?.length || 0,
        after: count || 0,
        removed: (existingConnections?.length || 0) - (count || 0)
      },
      connections: finalConnections
    });

  } catch (error) {
    console.error('[Meta Cleanup] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao limpar conexões antigas' },
      { status: 500 }
    );
  }
}
