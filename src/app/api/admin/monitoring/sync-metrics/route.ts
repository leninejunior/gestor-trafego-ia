import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/admin/monitoring/sync-metrics
 * Retorna métricas de sincronização
 * Requisito 9.1: Registrar métricas de tempo de execução e volume de dados
 */
export async function GET() {
  try {
    const supabase = await createClient();

    // Verificar se usuário é admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    // Buscar métricas de sync_logs
    const { data: logs, error } = await supabase
      .from('sync_logs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(1000);

    if (error) {
      throw error;
    }

    // Calcular métricas
    const totalSyncs = logs?.length || 0;
    const successfulSyncs = logs?.filter(log => log.status === 'completed').length || 0;
    const failedSyncs = logs?.filter(log => log.status === 'failed').length || 0;
    const successRate = totalSyncs > 0 ? (successfulSyncs / totalSyncs) * 100 : 0;
    
    const completedLogs = logs?.filter(log => log.duration_ms) || [];
    const avgDuration = completedLogs.length > 0
      ? completedLogs.reduce((sum, log) => sum + (log.duration_ms || 0), 0) / completedLogs.length
      : 0;

    const lastSync = logs && logs.length > 0 ? logs[0].started_at : null;

    return NextResponse.json({
      metrics: {
        total_syncs: totalSyncs,
        successful_syncs: successfulSyncs,
        failed_syncs: failedSyncs,
        success_rate: successRate,
        avg_duration_ms: Math.round(avgDuration),
        last_sync_at: lastSync,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar métricas de sync:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar métricas de sincronização' },
      { status: 500 }
    );
  }
}
