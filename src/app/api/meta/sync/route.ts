import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSyncService } from '@/lib/meta/sync-service';

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
    const { data: metaConnection } = await supabase
      .from('user_meta_tokens')
      .select('access_token')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!metaConnection?.access_token) {
      return NextResponse.json(
        { error: 'Token do Meta Ads não encontrado. Conecte sua conta primeiro.' },
        { status: 400 }
      );
    }

    // Criar serviço de sincronização
    const syncService = createSyncService(metaConnection.access_token);

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
    await supabase
      .from('sync_logs')
      .insert({
        user_id: user.id,
        sync_type: syncType,
        status: Array.isArray(results) 
          ? (results.every(r => r.success) ? 'success' : 'partial_success')
          : (results.success ? 'success' : 'error'),
        results: JSON.stringify(results),
        created_at: new Date().toISOString()
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
    const { data: syncLogs, error } = await supabase
      .from('sync_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    // Buscar status das conexões
    const { data: connections } = await supabase
      .from('client_meta_connections')
      .select(`
        id,
        account_id,
        account_name,
        is_active,
        last_sync,
        sync_status,
        clients (
          name
        )
      `)
      .eq('created_by', user.id);

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