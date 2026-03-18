import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe/config';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { planId, billingCycle = 'monthly' } = body;

    if (!planId) {
      return NextResponse.json(
        { error: 'Plan ID is required' },
        { status: 400 }
      );
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('first_name, last_name')
      .eq('user_id', user.id)
      .single();

    // Get user's organization
    const { data: membership } = await supabase
      .from('memberships')
      .select('organization_id, organizations(name)')
      .eq('user_id', user.id)
      .single();

    // Get plan details - support both UUID and plan name, only active plans
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(planId);
    
    let planQuery = supabase.from('subscription_plans').select('*').eq('is_active', true);
    if (isUUID) {
      planQuery = planQuery.eq('id', planId);
    } else {
      planQuery = planQuery.ilike('name', planId);
    }
    
    const { data: plan, error: planError } = await planQuery.single();

    if (planError || !plan) {
      console.error('Plan not found or inactive:', planId, planError);
      return NextResponse.json(
        { error: 'Plano não encontrado ou inativo' },
        { status: 404 }
      );
    }

    // Build user name
    const userName = profile 
      ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || user.email?.split('@')[0] || 'Usuário'
      : user.email?.split('@')[0] || 'Usuário';

    // Get organization name
    const orgName = (membership?.organizations as { name?: string })?.name || 'Minha Organização';

    // Create subscription intent for upgrade
    const { data: intent, error } = await supabase
      .from('subscription_intents')
      .insert({
        user_id: user.id,
        plan_id: plan.id,
        billing_cycle: billingCycle,
        status: 'pending',
        user_email: user.email || '',
        user_name: userName,
        organization_name: orgName,
        metadata: {
          upgrade_from: 'billing_page',
          original_plan_id: planId,
        },
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating subscription intent:', error);
      return NextResponse.json(
        { error: 'Failed to create subscription intent', details: error.message },
        { status: 500 }
      );
    }

    // Create Stripe Checkout Session
    const stripe = getStripe();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Get or create Stripe customer
    const existingCustomers = await stripe.customers.list({
      email: user.email || '',
      limit: 1
    });

    let customer;
    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
    } else {
      customer = await stripe.customers.create({
        email: user.email || '',
        name: userName,
        metadata: {
          user_id: user.id,
          organization_name: orgName,
          intent_id: intent.id,
        }
      });
    }

    // Always use dynamic price in BRL to ensure correct currency
    const priceInReais = billingCycle === 'annual' ? plan.annual_price : plan.monthly_price;
    const priceCents = Math.round(priceInReais * 100);

    const lineItems = [{
      price_data: {
        currency: 'brl' as const,
        product_data: {
          name: plan.name,
          description: plan.description || `Plano ${plan.name} - ${billingCycle === 'annual' ? 'Anual' : 'Mensal'}`,
          metadata: { plan_id: plan.id },
        },
        unit_amount: priceCents,
        recurring: {
          interval: (billingCycle === 'annual' ? 'year' : 'month') as 'year' | 'month',
          interval_count: 1,
        },
      },
      quantity: 1,
    }];

    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      billing_address_collection: 'required',
      line_items: lineItems,
      mode: 'subscription',
      success_url: `${appUrl}/checkout/status/${intent.id}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/dashboard/billing?canceled=true`,
      metadata: {
        intent_id: intent.id,
        plan_id: plan.id,
        billing_cycle: billingCycle,
        organization_name: orgName,
        user_id: user.id,
      },
      subscription_data: {
        metadata: {
          intent_id: intent.id,
          plan_id: plan.id,
          billing_cycle: billingCycle,
          organization_name: orgName,
          user_id: user.id,
        }
      },
      allow_promotion_codes: true,
      locale: 'pt-BR',
    });

    // Update intent with Stripe data
    await supabase
      .from('subscription_intents')
      .update({
        stripe_customer_id: customer.id,
        stripe_session_id: session.id,
        checkout_url: session.url,
      })
      .eq('id', intent.id);

    return NextResponse.json({
      success: true,
      intentId: intent.id,
      checkoutUrl: session.url,
      redirectUrl: session.url, // Redirecionar para Stripe, não para status
    });
  } catch (error) {
    console.error('Upgrade error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
