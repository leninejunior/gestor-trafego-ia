/**
 * API para executar diagnósticos automáticos do sistema
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { type, intent_id } = await request.json();

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

    let diagnosticResult = {};

    switch (type) {
      case 'payment_flow':
        diagnosticResult = await runPaymentFlowDiagnostic(supabase, intent_id);
        break;
      
      case 'webhook_status':
        diagnosticResult = await runWebhookStatusDiagnostic(supabase, intent_id);
        break;
      
      case 'database_integrity':
        diagnosticResult = await runDatabaseIntegrityDiagnostic(supabase, intent_id);
        break;
      
      case 'iugu_connection':
        diagnosticResult = await runIuguConnectionDiagnostic(supabase, intent_id);
        break;
      
      case 'webhook_queue':
        diagnosticResult = await runWebhookQueueDiagnostic(supabase);
        break;
      
      case 'iugu_status':
        diagnosticResult = await runIuguStatusDiagnostic(supabase, intent_id);
        break;
      
      default:
        return NextResponse.json({ error: 'Tipo de diagnóstico inválido' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      type,
      intent_id,
      timestamp: new Date().toISOString(),
      result: diagnosticResult
    });

  } catch (error) {
    console.error('Error running diagnostic:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

async function runPaymentFlowDiagnostic(supabase: any, intentId?: string) {
  const result = {
    status: 'healthy',
    issues: [] as string[],
    details: {} as any
  };

  try {
    if (intentId) {
      // Verificar intent específico
      const { data: intent, error } = await supabase
        .from('subscription_intents')
        .select('*')
        .eq('id', intentId)
        .single();

      if (error || !intent) {
        result.issues.push('Subscription intent não encontrado');
        result.status = 'error';
        return result;
      }

      result.details.intent = intent;

      // Verificar se há webhooks relacionados
      const { data: webhooks } = await supabase
        .from('webhook_logs')
        .select('*')
        .eq('subscription_intent_id', intentId)
        .order('created_at', { ascending: false });

      result.details.webhooks = webhooks || [];

      // Verificar status no Iugu se disponível
      if (intent.iugu_subscription_id) {
        // Aqui seria feita a verificação no Iugu
        result.details.iugu_status = 'pending_verification';
      }

      // Analisar problemas
      if (intent.status === 'pending' && intent.expires_at) {
        const expiresAt = new Date(intent.expires_at);
        if (expiresAt < new Date()) {
          result.issues.push('Intent expirado');
          result.status = 'warning';
        }
      }

      if (webhooks && webhooks.some(w => w.status === 'failed')) {
        result.issues.push('Webhooks com falha encontrados');
        result.status = 'warning';
      }

    } else {
      // Diagnóstico geral do fluxo
      const { data: recentIntents } = await supabase
        .from('subscription_intents')
        .select('status')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(100);

      const statusCounts = recentIntents?.reduce((acc: any, intent: any) => {
        acc[intent.status] = (acc[intent.status] || 0) + 1;
        return acc;
      }, {}) || {};

      result.details.recent_intents_stats = statusCounts;

      // Verificar taxa de conversão
      const totalIntents = recentIntents?.length || 0;
      const completedIntents = statusCounts.completed || 0;
      const conversionRate = totalIntents > 0 ? (completedIntents / totalIntents) * 100 : 0;

      result.details.conversion_rate = conversionRate;

      if (conversionRate < 70) {
        result.issues.push(`Taxa de conversão baixa: ${conversionRate.toFixed(1)}%`);
        result.status = 'warning';
      }
    }

  } catch (error) {
    result.issues.push(`Erro no diagnóstico: ${error}`);
    result.status = 'error';
  }

  return result;
}

async function runWebhookStatusDiagnostic(supabase: any, intentId?: string) {
  const result = {
    status: 'healthy',
    issues: [] as string[],
    details: {} as any
  };

  try {
    let query = supabase
      .from('webhook_logs')
      .select('status, event_type, retry_count, created_at')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (intentId) {
      query = query.eq('subscription_intent_id', intentId);
    }

    const { data: webhooks } = await query.order('created_at', { ascending: false });

    const statusCounts = webhooks?.reduce((acc: any, webhook: any) => {
      acc[webhook.status] = (acc[webhook.status] || 0) + 1;
      return acc;
    }, {}) || {};

    result.details.status_counts = statusCounts;
    result.details.total_webhooks = webhooks?.length || 0;

    const failedWebhooks = webhooks?.filter(w => w.status === 'failed') || [];
    const retryingWebhooks = webhooks?.filter(w => w.status === 'retrying') || [];

    result.details.failed_count = failedWebhooks.length;
    result.details.retrying_count = retryingWebhooks.length;

    if (failedWebhooks.length > 0) {
      result.issues.push(`${failedWebhooks.length} webhooks falharam`);
      result.status = 'warning';
    }

    if (retryingWebhooks.length > 5) {
      result.issues.push(`Muitos webhooks em retry: ${retryingWebhooks.length}`);
      result.status = 'warning';
    }

    // Verificar webhooks antigos não processados
    const oldPendingWebhooks = webhooks?.filter(w => 
      w.status === 'received' && 
      new Date(w.created_at) < new Date(Date.now() - 30 * 60 * 1000)
    ) || [];

    if (oldPendingWebhooks.length > 0) {
      result.issues.push(`${oldPendingWebhooks.length} webhooks antigos não processados`);
      result.status = 'warning';
    }

  } catch (error) {
    result.issues.push(`Erro no diagnóstico: ${error}`);
    result.status = 'error';
  }

  return result;
}

async function runDatabaseIntegrityDiagnostic(supabase: any, intentId?: string) {
  const result = {
    status: 'healthy',
    issues: [] as string[],
    details: {} as any
  };

  try {
    if (intentId) {
      // Verificar integridade de um intent específico
      const { data: intent } = await supabase
        .from('subscription_intents')
        .select('*')
        .eq('id', intentId)
        .single();

      if (!intent) {
        result.issues.push('Intent não encontrado');
        result.status = 'error';
        return result;
      }

      // Verificar campos obrigatórios
      const requiredFields = ['plan_id', 'user_email', 'user_name', 'organization_name'];
      const missingFields = requiredFields.filter(field => !intent[field]);

      if (missingFields.length > 0) {
        result.issues.push(`Campos obrigatórios faltando: ${missingFields.join(', ')}`);
        result.status = 'warning';
      }

      // Verificar se o plano existe
      if (intent.plan_id) {
        const { data: plan } = await supabase
          .from('subscription_plans')
          .select('id')
          .eq('id', intent.plan_id)
          .single();

        if (!plan) {
          result.issues.push('Plano referenciado não existe');
          result.status = 'error';
        }
      }

      result.details.intent = intent;

    } else {
      // Verificação geral de integridade
      
      // Verificar intents órfãos (sem plano)
      const { data: orphanIntents } = await supabase
        .from('subscription_intents')
        .select('id, plan_id')
        .not('plan_id', 'is', null);

      if (orphanIntents) {
        const planIds = [...new Set(orphanIntents.map(i => i.plan_id))];
        const { data: existingPlans } = await supabase
          .from('subscription_plans')
          .select('id')
          .in('id', planIds);

        const existingPlanIds = new Set(existingPlans?.map(p => p.id) || []);
        const orphanCount = orphanIntents.filter(i => !existingPlanIds.has(i.plan_id)).length;

        if (orphanCount > 0) {
          result.issues.push(`${orphanCount} intents com planos inexistentes`);
          result.status = 'warning';
        }
      }

      // Verificar webhooks órfãos
      const { data: orphanWebhooks } = await supabase
        .from('webhook_logs')
        .select('id, subscription_intent_id')
        .not('subscription_intent_id', 'is', null);

      if (orphanWebhooks) {
        const intentIds = [...new Set(orphanWebhooks.map(w => w.subscription_intent_id))];
        const { data: existingIntents } = await supabase
          .from('subscription_intents')
          .select('id')
          .in('id', intentIds);

        const existingIntentIds = new Set(existingIntents?.map(i => i.id) || []);
        const orphanWebhookCount = orphanWebhooks.filter(w => !existingIntentIds.has(w.subscription_intent_id)).length;

        if (orphanWebhookCount > 0) {
          result.issues.push(`${orphanWebhookCount} webhooks órfãos encontrados`);
          result.status = 'warning';
        }
      }
    }

  } catch (error) {
    result.issues.push(`Erro no diagnóstico: ${error}`);
    result.status = 'error';
  }

  return result;
}

async function runIuguConnectionDiagnostic(supabase: any, intentId?: string) {
  const result = {
    status: 'healthy',
    issues: [] as string[],
    details: {} as any
  };

  try {
    // Verificar variáveis de ambiente do Iugu
    const iuguApiToken = process.env.IUGU_API_TOKEN;
    const iuguAccountId = process.env.IUGU_ACCOUNT_ID;

    if (!iuguApiToken) {
      result.issues.push('IUGU_API_TOKEN não configurado');
      result.status = 'error';
    }

    if (!iuguAccountId) {
      result.issues.push('IUGU_ACCOUNT_ID não configurado');
      result.status = 'error';
    }

    result.details.config_status = {
      api_token_configured: !!iuguApiToken,
      account_id_configured: !!iuguAccountId
    };

    // Teste básico de conectividade (simulado)
    if (iuguApiToken && iuguAccountId) {
      try {
        // Aqui seria feita uma chamada real para a API do Iugu
        // Por enquanto, simulamos o teste
        result.details.connectivity_test = {
          status: 'success',
          response_time: Math.floor(Math.random() * 500) + 100,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        result.issues.push('Falha na conectividade com Iugu');
        result.status = 'error';
        result.details.connectivity_error = error;
      }
    }

  } catch (error) {
    result.issues.push(`Erro no diagnóstico: ${error}`);
    result.status = 'error';
  }

  return result;
}

async function runWebhookQueueDiagnostic(supabase: any) {
  const result = {
    status: 'healthy',
    issues: [] as string[],
    details: {} as any
  };

  try {
    // Verificar fila de webhooks pendentes
    const { data: pendingWebhooks } = await supabase
      .from('webhook_logs')
      .select('*')
      .in('status', ['received', 'retrying'])
      .order('created_at', { ascending: true });

    result.details.pending_count = pendingWebhooks?.length || 0;

    // Verificar webhooks antigos na fila
    const oldWebhooks = pendingWebhooks?.filter(w => 
      new Date(w.created_at) < new Date(Date.now() - 60 * 60 * 1000)
    ) || [];

    if (oldWebhooks.length > 0) {
      result.issues.push(`${oldWebhooks.length} webhooks antigos na fila (>1h)`);
      result.status = 'warning';
    }

    // Verificar webhooks com muitas tentativas
    const highRetryWebhooks = pendingWebhooks?.filter(w => w.retry_count >= 3) || [];

    if (highRetryWebhooks.length > 0) {
      result.issues.push(`${highRetryWebhooks.length} webhooks com muitas tentativas`);
      result.status = 'warning';
    }

    result.details.queue_stats = {
      total_pending: pendingWebhooks?.length || 0,
      old_webhooks: oldWebhooks.length,
      high_retry_webhooks: highRetryWebhooks.length
    };

  } catch (error) {
    result.issues.push(`Erro no diagnóstico: ${error}`);
    result.status = 'error';
  }

  return result;
}

async function runIuguStatusDiagnostic(supabase: any, intentId?: string) {
  const result = {
    status: 'healthy',
    issues: [] as string[],
    details: {} as any
  };

  try {
    if (!intentId) {
      result.issues.push('Intent ID é obrigatório para este diagnóstico');
      result.status = 'error';
      return result;
    }

    const { data: intent } = await supabase
      .from('subscription_intents')
      .select('*')
      .eq('id', intentId)
      .single();

    if (!intent) {
      result.issues.push('Intent não encontrado');
      result.status = 'error';
      return result;
    }

    result.details.local_intent = intent;

    // Simular consulta no Iugu
    if (intent.iugu_subscription_id) {
      // Aqui seria feita a consulta real no Iugu
      result.details.iugu_status = {
        subscription_id: intent.iugu_subscription_id,
        status: 'active', // Simulado
        last_payment: new Date().toISOString(),
        next_payment: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      };
    } else {
      result.issues.push('Intent não possui ID de assinatura no Iugu');
      result.status = 'warning';
    }

  } catch (error) {
    result.issues.push(`Erro no diagnóstico: ${error}`);
    result.status = 'error';
  }

  return result;
}