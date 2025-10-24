import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SubscriptionService } from '@/lib/services/subscription-service';
import { z } from 'zod';

// Validation schema for subscription cancellation
const cancelSubscriptionSchema = z.object({
  subscription_id: z.string().uuid('Invalid subscription ID'),
  cancel_at_period_end: z.boolean().default(true),
  reason: z.string().max(500).optional()
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
    const validationResult = cancelSubscriptionSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: validationResult.error.errors
        },
        { status: 400 }
      );
    }

    const { subscription_id, cancel_at_period_end, reason } = validationResult.data;

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

    // Check user permissions - only owners can cancel subscriptions
    const userMembership = subscription.organization.memberships[0];
    if (userMembership.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only organization owners can cancel subscriptions' },
        { status: 403 }
      );
    }

    // Cancel subscription
    const subscriptionService = new SubscriptionService();
    const canceledSubscription = await subscriptionService.cancelSubscription(
      subscription_id,
      cancel_at_period_end,
      reason
    );

    return NextResponse.json({
      success: true,
      data: canceledSubscription,
      message: cancel_at_period_end 
        ? 'Subscription will be canceled at the end of the current billing period'
        : 'Subscription has been canceled immediately'
    });

  } catch (error) {
    console.error('Subscription cancellation error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    // Handle specific error cases
    if (errorMessage.includes('Subscription not found')) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
}