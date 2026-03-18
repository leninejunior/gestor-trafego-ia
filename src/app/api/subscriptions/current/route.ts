import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SubscriptionService } from '@/lib/services/subscription-service';

export async function GET(request: NextRequest) {
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

    // Get organization_id from query parameters
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organization_id');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organization_id parameter is required' },
        { status: 400 }
      );
    }

    // Verify user has access to the organization
    const { data: membership, error: membershipError } = await supabase
      .from('organization_memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: 'Access denied to organization' },
        { status: 403 }
      );
    }

    // Get current subscription
    const subscriptionService = new SubscriptionService();
    const subscription = await subscriptionService.getActiveSubscription(organizationId);

    if (!subscription) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'No active subscription found'
      });
    }

    // Get billing cycle information
    const billingInfo = await subscriptionService.getBillingCycleInfo(subscription.id);

    return NextResponse.json({
      success: true,
      data: {
        subscription,
        billing_info: billingInfo
      }
    });

  } catch (error) {
    console.error('Get current subscription error:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch subscription information' },
      { status: 500 }
    );
  }
}

// Alternative endpoint to get subscription by subscription ID
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

    // Parse request body
    const body = await request.json();
    const { subscription_id } = body;

    if (!subscription_id) {
      return NextResponse.json(
        { error: 'subscription_id is required' },
        { status: 400 }
      );
    }

    // Verify user has access to the subscription
    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select(`
        *,
        plan:subscription_plans(*),
        organization:organizations!inner(
          memberships!inner(
            user_id,
            role
          )
        )
      `)
      .eq('id', subscription_id)
      .eq('organization.memberships.user_id', user.id)
      .single();

    if (subscriptionError || !subscription) {
      return NextResponse.json(
        { error: 'Subscription not found or access denied' },
        { status: 404 }
      );
    }

    // Get billing cycle information
    const subscriptionService = new SubscriptionService();
    const billingInfo = await subscriptionService.getBillingCycleInfo(subscription_id);

    // Format response
    const subscriptionWithPlan = {
      id: subscription.id,
      organization_id: subscription.organization_id,
      plan_id: subscription.plan_id,
      status: subscription.status,
      billing_cycle: subscription.billing_cycle,
      current_period_start: subscription.current_period_start,
      current_period_end: subscription.current_period_end,
      trial_end: subscription.trial_end,
      payment_method_id: subscription.payment_method_id,
      stripe_subscription_id: subscription.stripe_subscription_id,
      stripe_customer_id: subscription.stripe_customer_id,
      created_at: subscription.created_at,
      updated_at: subscription.updated_at,
      plan: subscription.plan
    };

    return NextResponse.json({
      success: true,
      data: {
        subscription: subscriptionWithPlan,
        billing_info: billingInfo
      }
    });

  } catch (error) {
    console.error('Get subscription by ID error:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch subscription information' },
      { status: 500 }
    );
  }
}