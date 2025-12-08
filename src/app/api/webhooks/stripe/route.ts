import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { getStripe, STRIPE_WEBHOOK_SECRET } from '@/lib/stripe/config';
import { StripeService } from '@/lib/stripe/stripe-service';
import { SubscriptionService } from '@/lib/services/subscription-service';
import { getSubscriptionIntentService } from '@/lib/services/subscription-intent-service';
import { createClient } from '@/lib/supabase/server';

const stripeService = new StripeService();
const subscriptionService = new SubscriptionService();

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headersList = await headers();
    const signature = headersList.get('stripe-signature');

    if (!signature || !STRIPE_WEBHOOK_SECRET) {
      console.error('Missing Stripe signature or webhook secret');
      return NextResponse.json(
        { error: 'Missing signature or webhook secret' },
        { status: 400 }
      );
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripeService.constructWebhookEvent(body, signature, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    console.log(`Received Stripe webhook: ${event.type}`);

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'customer.subscription.trial_will_end':
        await handleTrialWillEnd(event.data.object as Stripe.Subscription);
        break;

      case 'payment_method.attached':
        await handlePaymentMethodAttached(event.data.object as Stripe.PaymentMethod);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle successful checkout session completion
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  try {
    const stripe = getStripe();
    const intentId = session.metadata?.intent_id;
    const organizationId = session.metadata?.organization_id;
    const planId = session.metadata?.plan_id;
    const billingCycle = session.metadata?.billing_cycle as 'monthly' | 'annual';

    console.log('Checkout session completed:', {
      sessionId: session.id,
      intentId,
      organizationId,
      planId,
      billingCycle
    });

    // Handle subscription_intent flow (new checkout)
    if (intentId) {
      const subscriptionIntentService = getSubscriptionIntentService();
      
      // Get the subscription from Stripe
      const stripeSubscription = session.subscription 
        ? await stripe.subscriptions.retrieve(session.subscription as string)
        : null;

      // Update subscription intent to completed
      await subscriptionIntentService.updateIntent(
        intentId,
        {
          status: 'completed',
          stripe_subscription_id: stripeSubscription?.id,
          metadata: {
            stripe_session_id: session.id,
            stripe_subscription_status: stripeSubscription?.status,
            completed_at: new Date().toISOString(),
            payment_status: session.payment_status,
          }
        },
        {
          reason: 'Stripe checkout session completed',
          triggeredBy: 'stripe_webhook',
        }
      );

      console.log(`Subscription intent ${intentId} marked as completed`);
      return;
    }

    // Handle legacy flow (direct organization subscription)
    if (!organizationId || !planId || !billingCycle) {
      console.error('Missing required metadata in checkout session');
      return;
    }

    // Get the subscription from Stripe
    const stripeSubscription = await stripe.subscriptions.retrieve(session.subscription as string);

    // Update our database subscription with Stripe IDs
    const supabase = await createClient();
    const { error } = await supabase
      .from('subscriptions')
      .update({
        stripe_subscription_id: stripeSubscription.id,
        stripe_customer_id: stripeSubscription.customer as string,
        status: stripeSubscription.status === 'trialing' ? 'trialing' : 'active',
        updated_at: new Date().toISOString()
      })
      .eq('organization_id', organizationId)
      .eq('plan_id', planId);

    if (error) {
      console.error('Failed to update subscription with Stripe IDs:', error);
    } else {
      console.log(`Subscription updated for organization ${organizationId}`);
    }

  } catch (error) {
    console.error('Error handling checkout session completed:', error);
  }
}

/**
 * Handle subscription creation
 */
async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  try {
    const organizationId = subscription.metadata?.organization_id;
    
    if (!organizationId) {
      console.error('Missing organization_id in subscription metadata');
      return;
    }

    // Update subscription status in our database
    await subscriptionService.updateSubscriptionStatus(
      subscription.metadata?.subscription_id || '',
      subscription.status as any,
      {
        stripe_subscription_id: subscription.id,
        stripe_customer_id: subscription.customer as string
      }
    );

    console.log(`Subscription created for organization ${organizationId}`);

  } catch (error) {
    console.error('Error handling subscription created:', error);
  }
}

/**
 * Handle subscription updates
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  try {
    const organizationId = subscription.metadata?.organization_id;
    
    if (!organizationId) {
      console.error('Missing organization_id in subscription metadata');
      return;
    }

    // Find our subscription by Stripe subscription ID
    const supabase = await createClient();
    const { data: ourSubscription, error } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('stripe_subscription_id', subscription.id)
      .single();

    if (error || !ourSubscription) {
      console.error('Could not find subscription in database:', error);
      return;
    }

    // Update subscription status
    await subscriptionService.updateSubscriptionStatus(
      ourSubscription.id,
      subscription.status as any
    );

    console.log(`Subscription updated for organization ${organizationId}`);

  } catch (error) {
    console.error('Error handling subscription updated:', error);
  }
}

/**
 * Handle subscription deletion/cancellation
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  try {
    const organizationId = subscription.metadata?.organization_id;
    
    if (!organizationId) {
      console.error('Missing organization_id in subscription metadata');
      return;
    }

    // Find our subscription by Stripe subscription ID
    const supabase = await createClient();
    const { data: ourSubscription, error } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('stripe_subscription_id', subscription.id)
      .single();

    if (error || !ourSubscription) {
      console.error('Could not find subscription in database:', error);
      return;
    }

    // Update subscription status to canceled
    await subscriptionService.updateSubscriptionStatus(
      ourSubscription.id,
      'canceled'
    );

    console.log(`Subscription canceled for organization ${organizationId}`);

  } catch (error) {
    console.error('Error handling subscription deleted:', error);
  }
}

/**
 * Handle successful invoice payment
 */
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  try {
    if (!invoice.subscription) return;

    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
    const organizationId = subscription.metadata?.organization_id;
    
    if (!organizationId) {
      console.error('Missing organization_id in subscription metadata');
      return;
    }

    // Create invoice record in our database
    const supabase = await createClient();
    const { data: ourSubscription } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('stripe_subscription_id', subscription.id)
      .single();

    if (ourSubscription) {
      await supabase
        .from('subscription_invoices')
        .insert({
          subscription_id: ourSubscription.id,
          amount: invoice.amount_paid / 100, // Convert from cents
          currency: invoice.currency,
          status: 'paid',
          due_date: new Date(invoice.due_date! * 1000).toISOString(),
          paid_at: new Date(invoice.status_transitions.paid_at! * 1000).toISOString(),
          stripe_invoice_id: invoice.id,
          line_items: invoice.lines.data.map(line => ({
            id: line.id,
            description: line.description || '',
            quantity: line.quantity || 1,
            unit_price: (line.amount || 0) / 100,
            total: (line.amount || 0) / 100
          }))
        });
    }

    console.log(`Invoice payment succeeded for organization ${organizationId}`);

  } catch (error) {
    console.error('Error handling invoice payment succeeded:', error);
  }
}

/**
 * Handle failed invoice payment
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  try {
    if (!invoice.subscription) return;

    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
    const organizationId = subscription.metadata?.organization_id;
    
    if (!organizationId) {
      console.error('Missing organization_id in subscription metadata');
      return;
    }

    // Update subscription status to past_due
    const supabase = await createClient();
    const { data: ourSubscription } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('stripe_subscription_id', subscription.id)
      .single();

    if (ourSubscription) {
      await subscriptionService.updateSubscriptionStatus(
        ourSubscription.id,
        'past_due'
      );

      // Create failed invoice record
      await supabase
        .from('subscription_invoices')
        .insert({
          subscription_id: ourSubscription.id,
          amount: invoice.amount_due / 100, // Convert from cents
          currency: invoice.currency,
          status: 'uncollectible',
          due_date: new Date(invoice.due_date! * 1000).toISOString(),
          stripe_invoice_id: invoice.id,
          line_items: invoice.lines.data.map(line => ({
            id: line.id,
            description: line.description || '',
            quantity: line.quantity || 1,
            unit_price: (line.amount || 0) / 100,
            total: (line.amount || 0) / 100
          }))
        });
    }

    console.log(`Invoice payment failed for organization ${organizationId}`);

  } catch (error) {
    console.error('Error handling invoice payment failed:', error);
  }
}

/**
 * Handle trial ending soon
 */
async function handleTrialWillEnd(subscription: Stripe.Subscription) {
  try {
    const organizationId = subscription.metadata?.organization_id;
    
    if (!organizationId) {
      console.error('Missing organization_id in subscription metadata');
      return;
    }

    // Here you could send notification emails or update UI notifications
    console.log(`Trial will end soon for organization ${organizationId}`);

  } catch (error) {
    console.error('Error handling trial will end:', error);
  }
}

/**
 * Handle payment method attachment
 */
async function handlePaymentMethodAttached(paymentMethod: Stripe.PaymentMethod) {
  try {
    // Update customer's default payment method if this is their first one
    if (paymentMethod.customer) {
      const stripe = getStripe();
      const customer = await stripe.customers.retrieve(paymentMethod.customer as string);
      
      if (customer && !customer.deleted && !customer.invoice_settings.default_payment_method) {
        await stripeService.updateDefaultPaymentMethod(
          paymentMethod.customer as string,
          paymentMethod.id
        );
      }
    }

    console.log(`Payment method attached: ${paymentMethod.id}`);

  } catch (error) {
    console.error('Error handling payment method attached:', error);
  }
}