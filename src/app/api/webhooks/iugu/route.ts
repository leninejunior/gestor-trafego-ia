import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { IuguService } from '@/lib/iugu/iugu-service';
import { SubscriptionService } from '@/lib/services/subscription-service';

/**
 * Webhook do Iugu para processar eventos de pagamento
 * 
 * Eventos suportados:
 * - invoice.status_changed: Mudança de status de fatura
 * - subscription.suspended: Assinatura suspensa
 * - subscription.activated: Assinatura ativada
 * - subscription.expired: Assinatura expirada
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const event = body.event;
    const data = body.data;

    console.log('Iugu Webhook received:', event, data);

    const supabase = await createClient();
    const iuguService = new IuguService();
    const subscriptionService = new SubscriptionService();

    switch (event) {
      case 'invoice.status_changed':
        await handleInvoiceStatusChanged(data, supabase, subscriptionService);
        break;

      case 'subscription.suspended':
        await handleSubscriptionSuspended(data, supabase, subscriptionService);
        break;

      case 'subscription.activated':
        await handleSubscriptionActivated(data, supabase, subscriptionService);
        break;

      case 'subscription.expired':
        await handleSubscriptionExpired(data, supabase, subscriptionService);
        break;

      default:
        console.log('Unhandled Iugu event:', event);
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Iugu webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * Processar mudança de status de fatura
 */
async function handleInvoiceStatusChanged(
  data: any,
  supabase: any,
  subscriptionService: SubscriptionService
) {
  const invoiceId = data.id;
  const status = data.status;
  const subscriptionId = data.subscription_id;

  console.log(`Invoice ${invoiceId} status changed to ${status}`);

  // Buscar assinatura relacionada
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('iugu_subscription_id', subscriptionId)
    .single();

  if (!subscription) {
    console.log('Subscription not found for invoice:', invoiceId);
    return;
  }

  // Atualizar status da fatura no banco
  await supabase
    .from('subscription_invoices')
    .upsert({
      subscription_id: subscription.id,
      iugu_invoice_id: invoiceId,
      invoice_number: data.invoice_number || `IUGU-${invoiceId}`,
      amount: data.total_cents / 100,
      currency: 'BRL',
      status: mapIuguStatusToInternal(status),
      due_date: data.due_date,
      paid_at: status === 'paid' ? new Date().toISOString() : null,
    });

  // Se fatura foi paga, ativar assinatura
  if (status === 'paid') {
    await subscriptionService.updateSubscriptionStatus(
      subscription.id,
      'active',
      {
        last_payment_date: new Date().toISOString(),
      }
    );

    // Se era a primeira fatura, criar organização se necessário
    if (data.is_first_invoice) {
      await handleFirstPayment(subscription, supabase);
    }
  }

  // Se fatura expirou ou foi cancelada
  if (status === 'expired' || status === 'canceled') {
    await subscriptionService.updateSubscriptionStatus(
      subscription.id,
      'past_due'
    );
  }
}

/**
 * Processar suspensão de assinatura
 */
async function handleSubscriptionSuspended(
  data: any,
  supabase: any,
  subscriptionService: SubscriptionService
) {
  const iuguSubscriptionId = data.id;

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('iugu_subscription_id', iuguSubscriptionId)
    .single();

  if (subscription) {
    await subscriptionService.updateSubscriptionStatus(
      subscription.id,
      'past_due'
    );
  }
}

/**
 * Processar ativação de assinatura
 */
async function handleSubscriptionActivated(
  data: any,
  supabase: any,
  subscriptionService: SubscriptionService
) {
  const iuguSubscriptionId = data.id;

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('iugu_subscription_id', iuguSubscriptionId)
    .single();

  if (subscription) {
    await subscriptionService.updateSubscriptionStatus(
      subscription.id,
      'active'
    );
  }
}

/**
 * Processar expiração de assinatura
 */
async function handleSubscriptionExpired(
  data: any,
  supabase: any,
  subscriptionService: SubscriptionService
) {
  const iuguSubscriptionId = data.id;

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('iugu_subscription_id', iuguSubscriptionId)
    .single();

  if (subscription) {
    await subscriptionService.updateSubscriptionStatus(
      subscription.id,
      'canceled'
    );
  }
}

/**
 * Processar primeiro pagamento (criar conta do usuário e organização)
 */
async function handleFirstPayment(subscription: any, supabase: any) {
  console.log('[Webhook] Processing first payment for subscription:', subscription.id);

  // Buscar dados do intent de assinatura
  const { data: intent } = await supabase
    .from('subscription_intents')
    .select('*')
    .or(`iugu_subscription_id.eq.${subscription.iugu_subscription_id},iugu_customer_id.eq.${subscription.iugu_customer_id}`)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!intent) {
    console.log('[Webhook] No pending subscription intent found');
    return;
  }

  console.log('[Webhook] Found intent:', intent.id, 'for email:', intent.user_email);

  try {
    // 1. Criar usuário no Supabase Auth (se não existir)
    let userId = intent.user_id;
    
    if (!userId) {
      console.log('[Webhook] Creating new user account...');
      
      // Gerar senha temporária
      const tempPassword = `Temp${Math.random().toString(36).slice(-8)}!`;
      
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: intent.user_email,
        password: tempPassword,
        email_confirm: true, // Auto-confirmar email
        user_metadata: {
          name: intent.user_name,
          organization_name: intent.organization_name,
        }
      });

      if (authError) {
        console.error('[Webhook] Error creating user:', authError);
        throw authError;
      }

      userId = authData.user.id;
      console.log('[Webhook] User created:', userId);

      // Enviar email de boas-vindas com link para definir senha
      // TODO: Implementar envio de email
    }

    // 2. Criar organização
    console.log('[Webhook] Creating organization...');
    
    const orgSlug = intent.organization_name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      + `-${Date.now().toString().slice(-6)}`;

    const { data: newOrg, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: intent.organization_name,
        slug: orgSlug,
        created_by: userId,
      })
      .select()
      .single();

    if (orgError) {
      console.error('[Webhook] Error creating organization:', orgError);
      throw orgError;
    }

    console.log('[Webhook] Organization created:', newOrg.id);

    // 3. Criar membership (owner)
    const { error: memberError } = await supabase
      .from('memberships')
      .insert({
        user_id: userId,
        organization_id: newOrg.id,
        role: 'owner',
      });

    if (memberError) {
      console.error('[Webhook] Error creating membership:', memberError);
      throw memberError;
    }

    console.log('[Webhook] Membership created');

    // 4. Atualizar assinatura com organização
    const { error: subError } = await supabase
      .from('subscriptions')
      .update({
        user_id: userId,
        organization_id: newOrg.id,
      })
      .eq('id', subscription.id);

    if (subError) {
      console.error('[Webhook] Error updating subscription:', subError);
    }

    // 5. Atualizar intent como completo
    await supabase
      .from('subscription_intents')
      .update({
        status: 'completed',
        user_id: userId,
        completed_at: new Date().toISOString(),
      })
      .eq('id', intent.id);

    console.log('[Webhook] First payment processed successfully!');
    console.log('[Webhook] User:', userId, 'Organization:', newOrg.id);

  } catch (error) {
    console.error('[Webhook] Error processing first payment:', error);
    
    // Marcar intent como failed
    await supabase
      .from('subscription_intents')
      .update({
        status: 'failed',
        metadata: {
          ...intent.metadata,
          error: error instanceof Error ? error.message : 'Unknown error',
          failed_at: new Date().toISOString(),
        }
      })
      .eq('id', intent.id);
    
    throw error;
  }
}

/**
 * Mapear status do Iugu para status interno
 */
function mapIuguStatusToInternal(iuguStatus: string): string {
  const statusMap: Record<string, string> = {
    'pending': 'open',
    'paid': 'paid',
    'canceled': 'void',
    'partially_paid': 'open',
    'refunded': 'void',
    'expired': 'uncollectible',
  };

  return statusMap[iuguStatus] || 'draft';
}
