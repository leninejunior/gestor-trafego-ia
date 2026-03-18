import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getClientAccess,
  getLatestConnectionByClientId,
} from '@/lib/postgres/meta-connections-repository';
import { listLeadFormsByConnectionId } from '@/lib/postgres/meta-leads-repository';

// GET - Listar formulários de lead ads
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

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

    const forms = await listLeadFormsByConnectionId(connection.id);
    return NextResponse.json({ forms });

  } catch (error: unknown) {
    console.error('Erro ao buscar formulários:', error);
    return NextResponse.json({
      error: 'Erro ao buscar formulários',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
