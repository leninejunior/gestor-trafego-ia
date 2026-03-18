import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getClientAccess,
  getLatestConnectionByClientId,
} from '@/lib/postgres/meta-connections-repository';
import { listLeadsByConnectionId } from '@/lib/postgres/meta-leads-repository';

// GET - Listar leads
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const status = searchParams.get('status');
    const campaignId = searchParams.get('campaignId');
    const since = searchParams.get('since');
    const until = searchParams.get('until');
    const limit = Number.parseInt(searchParams.get('limit') || '50', 10);
    const offset = Number.parseInt(searchParams.get('offset') || '0', 10);

    const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 50;
    const safeOffset = Number.isFinite(offset) && offset >= 0 ? offset : 0;

    if (!clientId) {
      return NextResponse.json({ error: 'clientId é obrigatório' }, { status: 400 });
    }

    const access = await getClientAccess(clientId, user.id);
    if (!access.clientExists || !access.hasAccess) {
      return NextResponse.json({ error: 'Conexão não encontrada' }, { status: 404 });
    }

    const connection = await getLatestConnectionByClientId(clientId);
    if (!connection) {
      return NextResponse.json({ error: 'Conexão não encontrada' }, { status: 404 });
    }

    const result = await listLeadsByConnectionId(connection.id, {
      status,
      campaignId,
      since,
      until,
      limit: safeLimit,
      offset: safeOffset,
    });

    return NextResponse.json({
      leads: result.leads,
      total: result.total,
      limit: safeLimit,
      offset: safeOffset
    });

  } catch (error: unknown) {
    console.error('Erro ao buscar leads:', error);
    return NextResponse.json({
      error: 'Erro ao buscar leads',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    }, { status: 500 });
  }
}
