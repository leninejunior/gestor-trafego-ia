import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  countConnectionsByClientId,
  deactivateConnectionsByClientId,
  getClientAccess,
  listConnectionsByClientId,
  removeDuplicateConnections,
} from '@/lib/postgres/meta-connections-repository';

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

    const access = await getClientAccess(clientId, user.id);
    if (!access.clientExists) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
    }

    if (!access.hasAccess) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    // 1. Buscar conexões existentes antes de limpar (Postgres direto).
    const existingConnections = await listConnectionsByClientId(clientId);

    console.log(`[Meta Cleanup] Cliente ${clientId} tem ${existingConnections?.length || 0} conexões`);

    // 2. Desativar todas as conexões antigas deste cliente
    await deactivateConnectionsByClientId(clientId);

    // 3. Remover duplicatas (manter apenas a mais recente por ad_account_id)
    if (existingConnections && existingConnections.length > 0) {
      const accountGroups = existingConnections.reduce((acc, conn) => {
        const adAccountId = String(conn.ad_account_id || '');
        if (!adAccountId) {
          return acc;
        }

        if (!acc[adAccountId]) {
          acc[adAccountId] = [];
        }
        acc[adAccountId].push(conn);
        return acc;
      }, {} as Record<string, any[]>);

      const duplicateGroups = Object.values(accountGroups) as any[][];
      const duplicateGroupsCount = duplicateGroups.filter(group => group.length > 1).length;
      if (duplicateGroupsCount > 0) {
        const removedCount = await removeDuplicateConnections(clientId);
        console.log(`[Meta Cleanup] Removidas ${removedCount} conexões duplicadas`);
      }
    }

    // 4. Buscar conexões finais
    const finalConnections = await listConnectionsByClientId(clientId);
    const count = await countConnectionsByClientId(clientId);

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
