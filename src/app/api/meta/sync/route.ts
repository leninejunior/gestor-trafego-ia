import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSyncService } from '@/lib/meta/sync-service';
import {
  getActiveUserMetaToken,
  insertSyncLog,
  listConnectionsForSyncByUser,
  listSyncLogsByUser,
} from '@/lib/postgres/meta-sync-repository';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { 
      syncType = 'full', 
      accountId, 
      dateRange,
      forceSync = false 
    } = body;

    // Buscar token de acesso do Meta
    const accessToken = await getActiveUserMetaToken(user.id);
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Token do Meta Ads não encontrado. Conecte sua conta primeiro.' },
        { status: 400 }
      );
    }

    // Criar serviço de sincronização
    const syncService = createSyncService(accessToken);

    let results;

    switch (syncType) {
      case 'accounts':
        results = await syncService.syncAdAccounts(user.id);
        break;
        
      case 'campaigns':
        if (!accountId) {
          return NextResponse.json(
            { error: 'accountId é obrigatório para sincronização de campanhas' },
            { status: 400 }
          );
        }
        results = await syncService.syncCampaigns(accountId, user.id);
        break;
        
      case 'insights':
        if (!accountId) {
          return NextResponse.json(
            { error: 'accountId é obrigatório para sincronização de insights' },
            { status: 400 }
          );
        }
        results = await syncService.syncInsights(accountId, user.id, {
          dateRange,
          forceSync
        });
        break;
        
      case 'full':
      default:
        results = await syncService.fullSync(user.id, {
          dateRange,
          forceSync
        });
        break;
    }

    // Registrar log de sincronização
    const status = Array.isArray(results)
      ? (results.every((result: { success?: boolean }) => result.success) ? 'success' : 'partial_success')
      : (results?.success ? 'success' : 'error');

    await insertSyncLog({
      userId: user.id,
      syncType,
      status,
      results,
    });

    return NextResponse.json({
      success: true,
      results,
      message: 'Sincronização concluída'
    });

  } catch (error) {
    console.error('Erro na API de sincronização:', error);
    
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Buscar histórico de sincronizações
    const syncLogs = await listSyncLogsByUser(user.id, limit, offset);

    // Buscar status das conexões
    const rawConnections = await listConnectionsForSyncByUser(user.id);
    const connections = rawConnections.map((connection) => ({
      id: connection.id,
      account_id: connection.account_id,
      account_name: connection.account_name,
      is_active: connection.is_active,
      last_sync: connection.last_sync,
      sync_status: connection.sync_status,
      clients: connection.client_name ? { name: connection.client_name } : null,
    }));

    return NextResponse.json({
      success: true,
      data: {
        syncLogs: syncLogs || [],
        connections: connections || [],
        pagination: {
          limit,
          offset,
          total: syncLogs?.length || 0
        }
      }
    });

  } catch (error) {
    console.error('Erro ao buscar histórico de sincronização:', error);
    
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}
