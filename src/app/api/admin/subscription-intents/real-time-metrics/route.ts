/**
 * API para métricas em tempo real de subscription intents
 * Fornece dados atualizados para dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Verificar se é admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verificar permissões de admin
    const { data: memberships } = await supabase
      .from('memberships')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!memberships || !['admin', 'super_admin'].includes(memberships.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Buscar dados para métricas em tempo real
    const { data: intentsData } = await supabase
      .from('subscription_intents')
      .select('id, status, created_at, completed_at')
      .gte('created_at', todayStart.toISOString());

    if (!intentsData) {
      return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }

    // Calcular métricas
    const activeCheckouts = intentsData.filter(i => 
      i.status === 'pending' || i.status === 'processing'
    ).length;

    const pendingPayments = intentsData.filter(i => 
      i.status === 'pending'
    ).length;

    const recentCompletions = intentsData.filter(i => 
      i.status === 'completed' && 
      new Date(i.completed_at || i.created_at) >= oneHourAgo
    ).length;

    const failedLastHour = intentsData.filter(i => 
      i.status === 'failed' && 
      new Date(i.created_at) >= oneHourAgo
    ).length;

    // Conversão hoje
    const todayIntents = intentsData.length;
    const todayCompleted = intentsData.filter(i => i.status === 'completed').length;
    const conversionRateToday = todayIntents > 0 ? (todayCompleted / todayIntents) * 100 : 0;

    // Tempo médio hoje
    const completedToday = intentsData.filter(i => 
      i.status === 'completed' && i.completed_at
    );
    
    const averageTimeToday = completedToday.length > 0 
      ? completedToday.reduce((acc, intent) => {
          const start = new Date(intent.created_at).getTime();
          const end = new Date(intent.completed_at!).getTime();
          return acc + (end - start) / 1000; // em segundos
        }, 0) / completedToday.length
      : 0;

    return NextResponse.json({
      active_checkouts: activeCheckouts,
      pending_payments: pendingPayments,
      recent_completions: recentCompletions,
      failed_last_hour: failedLastHour,
      conversion_rate_today: conversionRateToday,
      average_time_today: averageTimeToday,
      last_updated: now.toISOString()
    });

  } catch (error) {
    console.error('Error fetching real-time metrics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}