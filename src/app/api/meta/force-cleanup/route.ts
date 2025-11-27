import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * API para forçar limpeza de conexões Meta duplicadas e órfãs
 * Use com cuidado - remove todas as duplicatas do sistema
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { clientId } = await request.json();

    console.log('[Meta Force Cleanup] Iniciando limpeza forçada...');

    // Estatísticas antes
    const { count: beforeCount } = await supabase
      .from('client_meta_connections')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', clientId);

    // 1. Buscar todas as conexões do cliente
    const { data: allConnections } = await supabase
      .from('client_meta_connections')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (!allConnections || allConnections.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhuma conexão encontrada',
        stats: { before: 0, after: 0, removed: 0 }
      });
    }

    // 2. Agrupar por ad_account_id
    const accountGroups = allConnections.reduce((acc, conn) => {
      if (!acc[conn.ad_account_id]) {
        acc[conn.ad_account_id] = [];
      }
      acc[conn.ad_account_id].push(conn);
      return acc;
    }, {} as Record<string, any[]>);

    // 3. Para cada grupo, manter apenas a mais recente
    const idsToKeep: string[] = [];
    const idsToDelete: string[] = [];

    Object.entries(accountGroups).forEach(([accountId, connections]) => {
      // Ordenar por data (mais recente primeiro)
      connections.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // Manter a primeira (mais recente)
      idsToKeep.push(connections[0].id);

      // Deletar o resto
      if (connections.length > 1) {
        idsToDelete.push(...connections.slice(1).map(c => c.id));
      }
    });

    console.log(`[Meta Force Cleanup] Manter: ${idsToKeep.length}, Deletar: ${idsToDelete.length}`);

    // 4. Deletar as duplicatas
    if (idsToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('client_meta_connections')
        .delete()
        .in('id', idsToDelete);

      if (deleteError) {
        console.error('[Meta Force Cleanup] Erro ao deletar:', deleteError);
        throw deleteError;
      }
    }

    // 5. Garantir que as mantidas estão ativas
    if (idsToKeep.length > 0) {
      const { error: updateError } = await supabase
        .from('client_meta_connections')
        .update({ 
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .in('id', idsToKeep);

      if (updateError) {
        console.error('[Meta Force Cleanup] Erro ao atualizar:', updateError);
      }
    }

    // Estatísticas depois
    const { count: afterCount } = await supabase
      .from('client_meta_connections')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', clientId);

    const stats = {
      before: beforeCount || 0,
      after: afterCount || 0,
      removed: (beforeCount || 0) - (afterCount || 0),
      kept: idsToKeep.length,
      deleted: idsToDelete.length
    };

    console.log('[Meta Force Cleanup] Concluído:', stats);

    return NextResponse.json({
      success: true,
      message: 'Limpeza forçada concluída',
      stats
    });

  } catch (error) {
    console.error('[Meta Force Cleanup] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao executar limpeza forçada' },
      { status: 500 }
    );
  }
}

/**
 * GET - Verificar duplicatas sem deletar
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json({ error: 'clientId é obrigatório' }, { status: 400 });
    }

    // Buscar todas as conexões
    const { data: connections } = await supabase
      .from('client_meta_connections')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (!connections || connections.length === 0) {
      return NextResponse.json({
        hasDuplicates: false,
        total: 0,
        duplicates: []
      });
    }

    // Agrupar e identificar duplicatas
    const accountGroups = connections.reduce((acc, conn) => {
      if (!acc[conn.ad_account_id]) {
        acc[conn.ad_account_id] = [];
      }
      acc[conn.ad_account_id].push(conn);
      return acc;
    }, {} as Record<string, any[]>);

    const duplicates = Object.entries(accountGroups)
      .filter(([_, conns]) => conns.length > 1)
      .map(([accountId, conns]) => ({
        ad_account_id: accountId,
        count: conns.length,
        connections: conns
      }));

    return NextResponse.json({
      hasDuplicates: duplicates.length > 0,
      total: connections.length,
      uniqueAccounts: Object.keys(accountGroups).length,
      duplicates
    });

  } catch (error) {
    console.error('[Meta Force Cleanup] Erro no GET:', error);
    return NextResponse.json(
      { error: 'Erro ao verificar duplicatas' },
      { status: 500 }
    );
  }
}
