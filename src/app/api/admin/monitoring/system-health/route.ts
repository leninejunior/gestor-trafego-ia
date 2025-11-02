/**
 * API: System Health Metrics
 * 
 * Retorna métricas de saúde do sistema
 * Requirement 9.1, 9.4: Dashboard administrativo com métricas
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ObservabilityService } from '@/lib/monitoring/observability-service';

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

    const observability = new ObservabilityService();

    // Obter métricas de saúde do sistema
    const healthMetrics = await observability.getSystemHealthMetrics();

    return NextResponse.json({
      success: true,
      data: healthMetrics,
    });

  } catch (error) {
    console.error('Error fetching system health:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
