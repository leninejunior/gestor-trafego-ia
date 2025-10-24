import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SubscriptionService } from '@/lib/services/subscription-service';

/**
 * POST /api/subscriptions/calculate-proration
 * Calculate proration costs for subscription plan changes
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { subscription_id, new_plan_id, billing_cycle } = body;

    if (!subscription_id || !new_plan_id) {
      return NextResponse.json(
        { error: 'subscription_id and new_plan_id are required' },
        { status: 400 }
      );
    }

    // Verify user has access to the subscription
    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select(`
        *,
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

    // Calculate proration
    const subscriptionService = new SubscriptionService();
    const currentSubscription = await subscriptionService.getSubscriptionById(subscription_id);
    
    if (!currentSubscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }

    // If billing cycle is changing, we need to update the subscription first
    let targetSubscription = currentSubscription;
    if (billing_cycle && billing_cycle !== currentSubscription.billing_cycle) {
      // For calculation purposes, create a temporary subscription object
      targetSubscription = {
        ...currentSubscription,
        billing_cycle: billing_cycle as 'monthly' | 'annual'
      };
    }

    // Calculate proration using private method (we'll need to make it public or create a wrapper)
    const proration = await (subscriptionService as any).calculateProration(
      targetSubscription,
      new_plan_id
    );

    return NextResponse.json({
      success: true,
      proration
    });

  } catch (error) {
    console.error('Calculate proration error:', error);
    
    return NextResponse.json(
      { error: 'Failed to calculate proration' },
      { status: 500 }
    );
  }
}