/**
 * API para salvar contas Meta selecionadas
 * Rota: POST /api/meta/save-selected
 * Versão: 4.0 - Postgres Direto
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  clientExists,
  deleteConnectionsByClientId,
  upsertConnections,
} from '@/lib/postgres/meta-connections-repository';

interface AdAccountInput {
  id: string;
  name?: string;
  currency?: string;
}

interface SaveSelectedBody {
  client_id?: string;
  access_token?: string;
  selected_accounts?: string[];
  ad_accounts?: AdAccountInput[];
}

export async function POST(request: NextRequest) {
  console.log('=== INÍCIO save-selected ===');
  
  try {
    const body = (await request.json()) as SaveSelectedBody;
    console.log('Body recebido:', {
      client_id: body.client_id,
      access_token: body.access_token ? 'presente' : 'ausente',
      selected_accounts: body.selected_accounts?.length || 0,
      ad_accounts: body.ad_accounts?.length || 0
    });
    
    const clientId = body.client_id;
    const accessToken = body.access_token;
    const adAccounts = Array.isArray(body.ad_accounts) ? body.ad_accounts : [];
    const selectedAccounts = Array.isArray(body.selected_accounts) ? body.selected_accounts : [];

    if (!clientId || !accessToken || selectedAccounts.length === 0) {
      console.log('Dados obrigatórios ausentes');
      return NextResponse.json({ error: 'Dados obrigatórios ausentes' }, { status: 400 });
    }

    const exists = await clientExists(clientId);
    if (!exists) {
      return NextResponse.json({ 
        error: 'Cliente não encontrado',
      }, { status: 404 });
    }

    // Remover conexões existentes para este cliente
    await deleteConnectionsByClientId(clientId);

    const uniqueSelectedAccounts = Array.from(new Set(selectedAccounts.map(String)));

    const connectionsToUpsert = uniqueSelectedAccounts.map((accountId) => {
      const account = adAccounts.find((acc) => acc.id === accountId);
      return {
        client_id: clientId,
        ad_account_id: accountId,
        access_token: accessToken,
        account_name: account?.name || `Conta ${accountId}`,
        currency: account?.currency || 'USD',
        is_active: true
      };
    });

    const savedConnections = await upsertConnections(connectionsToUpsert);

    console.log('10. Operação concluída com sucesso!');
    console.log('=== FIM save-selected ===');
    
    return NextResponse.json({ 
      success: true, 
      connections: savedConnections,
      message: `${savedConnections.length} conta(s) conectada(s) com sucesso` 
    });

  } catch (error: unknown) {
    console.error('Erro ao salvar contas selecionadas:', error);
    return NextResponse.json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
