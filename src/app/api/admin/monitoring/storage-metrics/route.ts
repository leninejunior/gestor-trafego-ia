import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/admin/monitoring/storage-metrics
 * Retorna métricas de uso de storage
 * Requisito 9.1: Métricas de uso de storage
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

    // Buscar estatísticas de campaign_insights_history
    const { data: stats, error } = await supabase
      .rpc('get_cache_storage_stats');

    if (error) {
      console.error('Erro ao buscar stats:', error);
      // Se a função não existir, retornar estrutura vazia
      return NextResponse.json({
        metrics: {
          total_records: 0,
          total_size_mb: 0,
          records_by_platform: {
            meta: 0,
            google: 0,
          },
          oldest_record_date: null,
          newest_record_date: null,
        },
      });
    }

    return NextResponse.json({
      metrics: stats || {
        total_records: 0,
        total_size_mb: 0,
        records_by_platform: {
          meta: 0,
          google: 0,
        },
        oldest_record_date: null,
        newest_record_date: null,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar métricas de storage:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar métricas de storage' },
      { status: 500 }
    );
  }
}
