/**
 * API para analytics de subscription intents
 * Fornece métricas de conversão, abandono e performance
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface AnalyticsMetrics {
  total_intents: number;
  pending_intents: number;
  completed_intents: number;
  failed_intents: number;
  expired_intents: number;
  conversion_rate: number;
  average_completion_time: number;
  abandonment_rate: number;
  total_revenue: number;
}

interface ConversionTrendData {
  date: string;
  started: number;
  completed: number;
  conversion_rate: number;
}

interface PlanPerformanceData {
  plan_name: string;
  plan_id: string;
  total_intents: number;
  completed_intents: number;
  conversion_rate: number;
  revenue: number;
}

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

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const periodStart = searchParams.get('period_start') || 
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days ago
    const periodEnd = searchParams.get('period_end') || new Date().toISOString();
    const statusFilter = searchParams.get('status_filter');
    const planFilter = searchParams.get('plan_filter');
    const billingCycleFilter = searchParams.get('billing_cycle_filter');

    // Construir query com filtros
    let query = supabase
      .from('subscription_intents')
      .select(`
        id,
        status,
        created_at,
        completed_at,
        plan_id,
        billing_cycle,
        subscription_plans!inner(name, monthly_price, annual_price)
      `)
      .gte('created_at', periodStart)
      .lte('created_at', periodEnd);

    // Aplicar filtros adicionais
    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }
    if (planFilter) {
      query = query.eq('plan_id', planFilter);
    }
    if (billingCycleFilter) {
      query = query.eq('billing_cycle', billingCycleFilter);
    }

    const { data: intentsData } = await query;

    if (!intentsData) {
      return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }

    // Calcular métricas
    const totalIntents = intentsData.length;
    const completedIntents = intentsData.filter(i => i.status === 'completed').length;
    const pendingIntents = intentsData.filter(i => i.status === 'pending').length;
    const failedIntents = intentsData.filter(i => i.status === 'failed').length;
    const expiredIntents = intentsData.filter(i => i.status === 'expired').length;
    
    const conversionRate = totalIntents > 0 ? (completedIntents / totalIntents) * 100 : 0;
    const abandonmentRate = totalIntents > 0 ? ((expiredIntents + failedIntents) / totalIntents) * 100 : 0;
    
    // Calcular tempo médio de conclusão
    const completedWithTimes = intentsData.filter(i => i.status === 'completed' && i.completed_at);
    const avgCompletionTime = completedWithTimes.length > 0 
      ? completedWithTimes.reduce((acc, intent) => {
          const start = new Date(intent.created_at).getTime();
          const end = new Date(intent.completed_at!).getTime();
          return acc + (end - start) / 1000; // em segundos
        }, 0) / completedWithTimes.length
      : 0;

    // Calcular receita total
    const totalRevenue = intentsData
      .filter(i => i.status === 'completed')
      .reduce((acc, intent) => {
        const plan = intent.subscription_plans as any;
        const price = intent.billing_cycle === 'monthly' ? plan.monthly_price : plan.annual_price;
        return acc + (price || 0);
      }, 0);

    // Dados de tendência de conversão (últimos 30 dias)
    const conversionTrend: ConversionTrendData[] = [];
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      return date.toISOString().split('T')[0];
    });

    last30Days.forEach(date => {
      const dayIntents = intentsData.filter(i => i.created_at.startsWith(date));
      const dayCompleted = dayIntents.filter(i => i.status === 'completed').length;
      const dayStarted = dayIntents.length;
      const dayConversionRate = dayStarted > 0 ? (dayCompleted / dayStarted) * 100 : 0;

      conversionTrend.push({
        date,
        started: dayStarted,
        completed: dayCompleted,
        conversion_rate: dayConversionRate
      });
    });

    // Performance por plano
    const planPerformance: PlanPerformanceData[] = [];
    const planGroups = intentsData.reduce((acc, intent) => {
      const planId = intent.plan_id;
      if (!acc[planId]) {
        acc[planId] = {
          plan_name: (intent.subscription_plans as any).name,
          plan_id: planId,
          intents: []
        };
      }
      acc[planId].intents.push(intent);
      return acc;
    }, {} as any);

    Object.values(planGroups).forEach((group: any) => {
      const totalIntents = group.intents.length;
      const completedIntents = group.intents.filter((i: any) => i.status === 'completed').length;
      const conversionRate = totalIntents > 0 ? (completedIntents / totalIntents) * 100 : 0;
      
      const revenue = group.intents
        .filter((i: any) => i.status === 'completed')
        .reduce((acc: number, intent: any) => {
          const plan = intent.subscription_plans;
          const price = intent.billing_cycle === 'monthly' ? plan.monthly_price : plan.annual_price;
          return acc + (price || 0);
        }, 0);

      planPerformance.push({
        plan_name: group.plan_name,
        plan_id: group.plan_id,
        total_intents: totalIntents,
        completed_intents: completedIntents,
        conversion_rate: conversionRate,
        revenue
      });
    });

    // Análise de abandono por etapa (simplificada)
    const abandonmentAnalysis = [
      { stage: 'Formulário de checkout', count: failedIntents, percentage: totalIntents > 0 ? (failedIntents / totalIntents) * 100 : 0 },
      { stage: 'Pagamento', count: expiredIntents, percentage: totalIntents > 0 ? (expiredIntents / totalIntents) * 100 : 0 }
    ];

    const metrics: AnalyticsMetrics = {
      total_intents: totalIntents,
      pending_intents: pendingIntents,
      completed_intents: completedIntents,
      failed_intents: failedIntents,
      expired_intents: expiredIntents,
      conversion_rate: conversionRate,
      average_completion_time: avgCompletionTime,
      abandonment_rate: abandonmentRate,
      total_revenue: totalRevenue
    };

    return NextResponse.json({
      analytics: { metrics },
      conversion_trend: conversionTrend,
      plan_performance: planPerformance,
      abandonment_analysis: abandonmentAnalysis
    });

  } catch (error) {
    console.error('Error fetching subscription intent analytics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { action, ...params } = body;

    switch (action) {
      case 'export_analytics':
        // Exportar dados de analytics (implementação simplificada)
        const { format = 'csv', period_start, period_end } = params;
        
        // Buscar dados para exportação
        const { data: exportData } = await supabase
          .from('subscription_intents')
          .select(`
            id,
            status,
            created_at,
            completed_at,
            user_email,
            user_name,
            organization_name,
            billing_cycle,
            subscription_plans!inner(name, monthly_price, annual_price)
          `)
          .gte('created_at', period_start)
          .lte('created_at', period_end);

        if (format === 'csv') {
          // Gerar CSV
          const csvHeaders = 'ID,Status,Email,Nome,Organização,Plano,Ciclo,Valor,Criado em,Completado em\n';
          const csvRows = exportData?.map(row => {
            const plan = row.subscription_plans as any;
            const price = row.billing_cycle === 'monthly' ? plan.monthly_price : plan.annual_price;
            return [
              row.id,
              row.status,
              row.user_email,
              row.user_name,
              row.organization_name,
              plan.name,
              row.billing_cycle,
              price || 0,
              row.created_at,
              row.completed_at || ''
            ].join(',');
          }).join('\n') || '';

          const csvContent = csvHeaders + csvRows;
          
          return NextResponse.json({
            success: true,
            data: csvContent,
            filename: `subscription-intents-${new Date().toISOString().split('T')[0]}.csv`
          });
        }

        return NextResponse.json({
          success: true,
          data: exportData,
          filename: `subscription-intents-${new Date().toISOString().split('T')[0]}.json`
        });

      case 'refresh_cache':
        // Atualizar cache de métricas (implementação simplificada)
        return NextResponse.json({
          success: true,
          message: 'Analytics cache refreshed'
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error in subscription intent analytics action:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}