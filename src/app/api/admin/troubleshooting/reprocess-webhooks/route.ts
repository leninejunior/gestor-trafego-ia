/**
 * API para reprocessar webhooks falhados
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { intent_id } = await request.json();

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

    // Buscar webhooks falhados
    let query = supabase
      .from('webhook_logs')
      .select('*')
      .eq('status', 'failed')
      .lt('retry_count', 5);

    if (intent_id) {
      query = query.eq('subscription_intent_id', intent_id);
    }

    const { data: failedWebhooks, error: fetchError } = await query
      .order('created_at', { ascending: true })
      .limit(50); // Limitar para evitar sobrecarga

    if (fetchError) {
      throw new Error(`Erro ao buscar webhooks: ${fetchError.message}`);
    }

    if (!failedWebhooks || failedWebhooks.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhum webhook falhado encontrado para reprocessamento',
        processed: 0
      });
    }

    let processedCount = 0;
    let errors = [];

    // Reprocessar cada webhook
    for (const webhook of failedWebhooks) {
      try {
        await reprocessWebhook(supabase, webhook, user.id);
        processedCount++;
      } catch (error) {
        console.error(`Error reprocessing webhook ${webhook.id}:`, error);
        errors.push({
          webhook_id: webhook.id,
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        });
      }
    }

    // Log da ação administrativa
    await supabase
      .from('admin_action_logs')
      .insert({
        action_type: 'reprocess_webhooks',
        intent_id: intent_id,
        admin_user_id: user.id,
        reason: 'Manual webhook reprocessing',
        result: {
          total_webhooks: failedWebhooks.length,
          processed: processedCount,
          errors: errors
        },
        created_at: new Date().toISOString()
      });

    return NextResponse.json({
      success: true,
      message: `${processedCount} webhooks reprocessados com sucesso`,
      processed: processedCount,
      total: failedWebhooks.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Error reprocessing webhooks:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

async function reprocessWebhook(supabase: any, webhook: any, adminUserId: string) {
  // Atualizar status para retrying
  await supabase
    .from('webhook_logs')
    .update({
      status: 'retrying',
      retry_count: webhook.retry_count + 1,
      error_message: null,
      updated_at: new Date().toISOString(),
      metadata: {
        ...webhook.metadata,
        manual_reprocess: true,
        admin_user_id: adminUserId,
        reprocess_timestamp: new Date().toISOString()
      }
    })
    .eq('id', webhook.id);

  // Processar webhook conforme tipo de evento
  try {
    const result = await processWebhookPayload(supabase, webhook);
    
    // Atualizar como processado com sucesso
    await supabase
      .from('webhook_logs')
      .update({
        status: 'processed',
        processed_at: new Date().toISOString(),
        error_message: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', webhook.id);

    return result;

  } catch (error) {
    // Atualizar como falhado novamente
    await supabase
      .from('webhook_logs')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Erro no reprocessamento',
        updated_at: new Date().toISOString()
      })
      .eq('id', webhook.id);

    throw error;
  }
}

async function processWebhookPayload(supabase: any, webhook: any) {
  const { event_type, payload, subscription_intent_id } = webhook;

  switch (event_type) {
    case 'invoice.status_changed':
      return await processInvoiceStatusChanged(supabase, payload, subscription_intent_id);
    
    case 'subscription.activated':
      return await processSubscriptionActivated(supabase, payload, subscription_intent_id);
    
    case 'subscription.suspended':
      return await processSubscriptionSuspended(supabase, payload, subscription_intent_id);
    
    case 'payment.confirmed':
      return await processPaymentConfirmed(supabase, payload, subscription_intent_id);
    
    default:
      throw new Error(`Tipo de evento não suportado: ${event_type}`);
  }
}

async function processInvoiceStatusChanged(supabase: any, payload: any, intentId?: string) {
  if (!intentId) {
    throw new Error('Intent ID é obrigatório para processar mudança de status da fatura');
  }

  const invoiceStatus = payload.status;
  
  if (invoiceStatus === 'paid') {
    // Atualizar intent para completed
    await supabase
      .from('subscription_intents')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', intentId);

    // Ativar assinatura se necessário
    await activateSubscriptionFromIntent(supabase, intentId);
  }

  return { status: 'processed', invoice_status: invoiceStatus };
}

async function processSubscriptionActivated(supabase: any, payload: any, intentId?: string) {
  if (intentId) {
    await supabase
      .from('subscription_intents')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', intentId);
  }

  return { status: 'processed', action: 'subscription_activated' };
}

async function processSubscriptionSuspended(supabase: any, payload: any, intentId?: string) {
  // Lógica para suspensão de assinatura
  return { status: 'processed', action: 'subscription_suspended' };
}

async function processPaymentConfirmed(supabase: any, payload: any, intentId?: string) {
  if (intentId) {
    await supabase
      .from('subscription_intents')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', intentId);

    await activateSubscriptionFromIntent(supabase, intentId);
  }

  return { status: 'processed', action: 'payment_confirmed' };
}

async function activateSubscriptionFromIntent(supabase: any, intentId: string) {
  // Buscar dados do intent
  const { data: intent } = await supabase
    .from('subscription_intents')
    .select('*')
    .eq('id', intentId)
    .single();

  if (!intent || !intent.user_id) {
    return;
  }

  // Verificar se já existe assinatura ativa
  const { data: existingSubscription } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('user_id', intent.user_id)
    .eq('status', 'active')
    .single();

  if (existingSubscription) {
    return; // Já existe assinatura ativa
  }

  // Criar nova assinatura
  const startDate = new Date();
  const endDate = new Date();
  
  if (intent.billing_cycle === 'annual') {
    endDate.setFullYear(endDate.getFullYear() + 1);
  } else {
    endDate.setMonth(endDate.getMonth() + 1);
  }

  await supabase
    .from('subscriptions')
    .insert({
      user_id: intent.user_id,
      plan_id: intent.plan_id,
      status: 'active',
      billing_cycle: intent.billing_cycle,
      current_period_start: startDate.toISOString(),
      current_period_end: endDate.toISOString(),
      created_at: new Date().toISOString(),
      metadata: {
        created_from_intent: intentId,
        webhook_reprocessed: true
      }
    });
}
