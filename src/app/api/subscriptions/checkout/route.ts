import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { StripeService } from '@/lib/stripe/stripe-service';
import { PlanManager } from '@/lib/services/plan-manager';
import { z } from 'zod';

// Validation schema for checkout session creation
const createCheckoutSchema = z.object({
  organization_id: z.string().uuid('Invalid organization ID'),
  plan_id: z.string().uuid('Invalid plan ID'),
  billing_cycle: z.enum(['monthly', 'annual'], {
    errorMap: () => ({ message: 'Billing cycle must be monthly or annual' })
  }),
  trial_days: z.number().min(0).max(90).optional(),
  success_url: z.string().url().optional(),
  cancel_url: z.string().url().optional()
});

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = createCheckoutSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: validationResult.error.errors
        },
        { status: 400 }
      );
    }

    const { organization_id, plan_id, billing_cycle, trial_days } = validationResult.data;

    // Verify user has access to the organization
    const { data: membership, error: membershipError } = await supabase
      .from('organization_memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', organization_id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: 'Access denied to organization' },
        { status: 403 }
      );
    }

    // Only owners and admins can create subscriptions
    if (!['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to create subscription' },
        { status: 403 }
      );
    }

    // Get organization details
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('name, email')
      .eq('id', organization_id)
      .single();

    if (orgError || !organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Check if organization already has an active subscription
    const { data: existingSubscription } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('organization_id', organization_id)
      .eq('status', 'active')
      .single();

    if (existingSubscription) {
      return NextResponse.json(
        { error: 'Organization already has an active subscription' },
        { status: 409 }
      );
    }

    // Get plan details
    const planManager = new PlanManager();
    const plan = await planManager.getPlanById(plan_id);
    
    if (!plan || !plan.is_active) {
      return NextResponse.json(
        { error: 'Selected plan is not available' },
        { status: 400 }
      );
    }

    // Create or get Stripe customer
    const stripeService = new StripeService();
    const customer = await stripeService.createOrGetCustomer(
      organization_id,
      organization.email || user.email!,
      organization.name,
      {
        user_id: user.id,
        organization_name: organization.name
      }
    );

    // Get the appropriate price ID (this would need to be stored in the plan or configured)
    // For now, we'll create prices on-demand
    const { monthlyPriceId, annualPriceId } = await stripeService.createOrUpdatePlanPrices(plan);
    const priceId = billing_cycle === 'annual' ? annualPriceId : monthlyPriceId;

    // Create checkout session
    const session = await stripeService.createCheckoutSession(
      customer.id,
      priceId,
      organization_id,
      plan_id,
      billing_cycle,
      trial_days
    );

    return NextResponse.json({
      success: true,
      data: {
        checkout_url: session.url,
        session_id: session.id
      }
    });

  } catch (error) {
    console.error('Checkout session creation error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    // Handle specific Stripe errors
    if (errorMessage.includes('No such price')) {
      return NextResponse.json(
        { error: 'Plan pricing not configured' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}