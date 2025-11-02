/**
 * API para gerenciar alertas críticos do sistema
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);

    // Verificar autenticação e permissões de admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Verificar se é admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // Parâmetros de filtro
    const resolved = searchParams.get('resolved');
    const severity = searchParams.get('severity');
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Gerar alertas simulados (em produção, viria do banco de dados)
    const alerts = await generateSystemAlerts(supabase, {
      resolved: resolved === 'false' ? false : resolved === 'true' ? true : undefined,
      severity,
      category,
      limit
    });

    return NextResponse.json({
      success: true,
      alerts,
      total: alerts.length
    });

  } catch (error) {
    console.error('Error fetching alerts:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

async function generateSystemAlerts(supabase: any, filters: any) {
  const alerts = [];

  // Verificar webhooks falhados
  const { data: failedWebhooks } = await supabase
    .from('webhook_logs')
    .select('*')
    .eq('status', 'failed')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .limit(10);

  if (failedWebhooks && failedWebhooks.length > 5) {
    alerts.push({
      id: 'webhook_failures_high',
      type: 'error',
      title: 'Alta Taxa de Falhas em Webhooks',
      description: `${failedWebhooks.length} webhooks falharam nas últimas 24 horas`,
      severity: 'critical',
      category: 'webhook',
      created_at: new Date().toISOString(),
      metadata: {
        failed_count: failedWebhooks.length,
        recent_failures: failedWebhooks.slice(0, 3)
      },
      action_url: '/admin/subscription-intents?tab=webhooks'
    });
  }

  // Verificar intents expirados
  const { data: expiredIntents } = await supabase
    .from('subscription_intents')
    .select('*')
    .eq('status', 'pending')
    .lt('expires_at', new Date().toISOString())
    .limit(10);

  if (expiredIntents && expiredIntents.length > 0) {
    alerts.push({
      id: 'expired_intents',
      type: 'warning',
      title: 'Subscription Intents Expirados',
      description: `${expiredIntents.length} intents expiraram sem pagamento`,
      severity: 'medium',
      category: 'payment',
      created_at: new Date().toISOString(),
      metadata: {
        expired_count: expiredIntents.length
      },
      action_url: '/admin/subscription-intents'
    });
  }

  // Verificar taxa de conversão baixa
  const { data: recentIntents } = await supabase
    .from('subscription_intents')
    .select('status')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  if (recentIntents && recentIntents.length > 10) {
    const completedCount = recentIntents.filter(i => i.status === 'completed').length;
    const conversionRate = (completedCount / recentIntents.length) * 100;

    if (conversionRate < 50) {
      alerts.push({
        id: 'low_conversion_rate',
        type: 'warning',
        title: 'Taxa de Conversão Baixa',
        description: `Taxa de conversão de ${conversionRate.toFixed(1)}% nas últimas 24h`,
        severity: 'high',
        category: 'payment',
        created_at: new Date().toISOString(),
        metadata: {
          conversion_rate: conversionRate,
          total_intents: recentIntents.length,
          completed_intents: completedCount
        },
        action_url: '/admin/subscription-intents?tab=analytics'
      });
    }
  }

  // Verificar webhooks antigos não processados
  const { data: oldWebhooks } = await supabase
    .from('webhook_logs')
    .select('*')
    .eq('status', 'received')
    .lt('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .limit(5);

  if (oldWebhooks && oldWebhooks.length > 0) {
    alerts.push({
      id: 'old_unprocessed_webhooks',
      type: 'error',
      title: 'Webhooks Não Processados',
      description: `${oldWebhooks.length} webhooks aguardando processamento há mais de 1 hora`,
      severity: 'high',
      category: 'webhook',
      created_at: new Date().toISOString(),
      metadata: {
        old_webhook_count: oldWebhooks.length
      },
      action_url: '/admin/subscription-intents?tab=troubleshooting'
    });
  }

  // Verificar intents sem user_id (problema de criação de conta)
  const { data: orphanIntents } = await supabase
    .from('subscription_intents')
    .select('*')
    .eq('status', 'completed')
    .is('user_id', null)
    .limit(5);

  if (orphanIntents && orphanIntents.length > 0) {
    alerts.push({
      id: 'orphan_intents',
      type: 'error',
      title: 'Intents Sem Usuário Criado',
      description: `${orphanIntents.length} intents completados mas sem usuário associado`,
      severity: 'critical',
      category: 'system',
      created_at: new Date().toISOString(),
      metadata: {
        orphan_count: orphanIntents.length,
        intent_ids: orphanIntents.map(i => i.id)
      },
      action_url: '/admin/subscription-intents?tab=troubleshooting'
    });
  }

  // Aplicar filtros
  let filteredAlerts = alerts;

  if (filters.resolved !== undefined) {
    filteredAlerts = filteredAlerts.filter(alert => 
      filters.resolved ? !!alert.resolved_at : !alert.resolved_at
    );
  }

  if (filters.severity) {
    filteredAlerts = filteredAlerts.filter(alert => 
      alert.severity === filters.severity
    );
  }

  if (filters.category) {
    filteredAlerts = filteredAlerts.filter(alert => 
      alert.category === filters.category
    );
  }

  return filteredAlerts.slice(0, filters.limit);
}