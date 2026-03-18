/**
 * API: Sync Logs
 * 
 * Retorna logs de sincronização
 * Requirement 9.4: Logs de sincronização no dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verificar se usuário é admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('is_super_admin')
      .eq('user_id', user.id)
      .single();

    if (!adminUser?.is_super_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parâmetros de query
    const searchParams = request.nextUrl.searchParams;
    const platform = searchParams.get('platform');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Buscar logs
    let query = supabase
      .from('sync_logs')
      .select(`
        *,
        sync_configurations!inner(
          platform,
          client_id,
          clients!inner(name)
        )
      `, { count: 'exact' })
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (platform) {
      query = query.eq('sync_configurations.platform', platform);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: logs, error, count } = await query;

    if (error) {
      throw error;
    }

    // Formatar resposta
    const formattedLogs = (logs || []).map(log => ({
      id: log.id,
      platform: (log as any).sync_configurations.platform,
      client_name: (log as any).sync_configurations.clients.name,
      client_id: (log as any).sync_configurations.client_id,
      status: log.status,
      started_at: log.started_at,
      completed_at: log.completed_at,
      duration_ms: log.duration_ms,
      records_synced: log.records_synced,
      records_failed: log.records_failed,
      api_calls_made: log.api_calls_made,
      error_message: log.error_message,
    }));

    return NextResponse.json({
      success: true,
      data: formattedLogs,
      pagination: {
        total: count || 0,
        limit,
        offset,
        has_more: (count || 0) > offset + limit,
      },
    });

  } catch (error) {
    console.error('Error fetching sync logs:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
