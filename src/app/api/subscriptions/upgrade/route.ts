import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe/config';
import { resolveAdminAccessContext } from '@/lib/access/admin-rbac';

type PlanRow = {
  id: string;
  name: string;
  description?: string | null;
  monthly_price: number;
  annual_price: number;
  features?: unknown;
  is_active?: boolean | null;
  max_clients?: number | null;
  max_campaigns?: number | null;
};

type MembershipLike = {
  organization_id?: string | null;
  org_id?: string | null;
};

const PLAN_IDENTIFIER_ALIASES: Record<string, string[]> = {
  basic: ['basic', 'basico', 'básico', 'plano basico', 'plano básico'],
  pro: ['pro', 'pro plan', 'plano pro'],
  enterprise: ['enterprise', 'enterprise plan', 'plano enterprise'],
};

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => typeof value === 'string' && value.length > 0)));
}

function normalizePlanCandidates(planId: string): string[] {
  const base = normalizeText(planId);
  const candidates = new Set<string>([base]);

  for (const candidate of PLAN_IDENTIFIER_ALIASES[base] ?? []) {
    candidates.add(normalizeText(candidate));
  }

  return Array.from(candidates).filter(Boolean);
}

function resolvePlanFromRows(planId: string, plans: PlanRow[]): PlanRow | null {
  const trimmedPlanId = planId.trim();
  const normalizedCandidates = normalizePlanCandidates(trimmedPlanId);

  const exactIdMatch = plans.find((plan) => plan.id === trimmedPlanId);
  if (exactIdMatch) {
    return exactIdMatch;
  }

  let bestMatch: PlanRow | null = null;
  let bestScore = -1;

  for (const plan of plans) {
    const normalizedName = normalizeText(plan.name);
    const normalizedDescription = normalizeText(plan.description ?? '');

    for (const candidate of normalizedCandidates) {
      let score = 0;

      if (normalizedName === candidate) {
        score = 100;
      } else if (normalizedName.includes(candidate) || candidate.includes(normalizedName)) {
        score = 75;
      } else if (normalizedDescription.includes(candidate)) {
        score = 25;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = plan;
      }
    }
  }

  return bestMatch;
}

function getMembershipOrganizationId(membership: MembershipLike | null | undefined): string | null {
  if (!membership) {
    return null;
  }

  return membership.organization_id?.trim() || membership.org_id?.trim() || null;
}

async function resolveOrganizationName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string | null
): Promise<string> {
  if (!organizationId) {
    return 'Minha Organização';
  }

  const { data, error } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', organizationId)
    .limit(1);

  if (!error && Array.isArray(data) && data.length > 0) {
    const name = data[0]?.name;
    if (typeof name === 'string' && name.trim()) {
      return name.trim();
    }
  }

  return 'Minha Organização';
}

async function resolvePlanByIdentifier(
  supabase: Awaited<ReturnType<typeof createClient>>,
  planId: string
): Promise<PlanRow | null> {
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('id,name,description,monthly_price,annual_price,features,is_active,max_clients,max_campaigns')
    .eq('is_active', true);

  if (error || !Array.isArray(data)) {
    return null;
  }

  return resolvePlanFromRows(planId, data as PlanRow[]);
}

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
    const requestedPlanId = typeof body?.planId === 'string' ? body.planId.trim() : '';
    const billingCycle = body?.billingCycle === 'annual' ? 'annual' : 'monthly';

    if (!requestedPlanId) {
      return NextResponse.json(
        { error: 'Plan ID is required' },
        { status: 400 }
      );
    }

    const accessContext = await resolveAdminAccessContext(user);
    const organizationId = uniqueStrings(accessContext.memberships.map(getMembershipOrganizationId))[0] ?? null;

    // Get user profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('first_name, last_name')
      .eq('user_id', user.id)
      .limit(1);

    const plan = await resolvePlanByIdentifier(supabase, requestedPlanId);

    if (!plan) {
      console.error('Plan not found or inactive:', requestedPlanId);
      return NextResponse.json(
        { error: 'Plano não encontrado ou inativo' },
        { status: 404 }
      );
    }

    // Build user name
    const userName = Array.isArray(profile) && profile.length > 0
      ? `${profile[0]?.first_name || ''} ${profile[0]?.last_name || ''}`.trim() || user.email?.split('@')[0] || 'Usuário'
      : user.email?.split('@')[0] || 'Usuário';

    // Get organization name
    const orgName = await resolveOrganizationName(supabase, organizationId);

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
          original_plan_id: requestedPlanId,
        },
      })
      .select()
      .limit(1);

    if (error || !Array.isArray(intent) || intent.length === 0) {
      console.error('Error creating subscription intent:', error);
      return NextResponse.json(
        { error: 'Failed to create subscription intent', details: error?.message ?? 'Unknown error' },
        { status: 500 }
      );
    }

    const intentRow = intent[0];

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
          intent_id: intentRow.id,
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
      success_url: `${appUrl}/checkout/status/${intentRow.id}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/dashboard/billing?canceled=true`,
      metadata: {
        intent_id: intentRow.id,
        plan_id: plan.id,
        billing_cycle: billingCycle,
        organization_name: orgName,
        user_id: user.id,
      },
      subscription_data: {
        metadata: {
          intent_id: intentRow.id,
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
      .eq('id', intentRow.id);

    return NextResponse.json({
      success: true,
      intentId: intentRow.id,
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
