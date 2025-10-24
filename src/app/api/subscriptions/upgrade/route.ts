import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SubscriptionService } from '@/lib/services/subscription-service';
import { z } from 'zod';

// Validation schema for subscription upgrade
const upgradeSubscriptionSchema = z.object({
  subscription_id: z.string().uuid('Invalid subscription ID'),
  new_plan_id: z.string().uuid('Invalid plan ID'),
  effective_date: z.string().datetime().optional()
});

export async function PUT(request: NextRequest) {
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
    const validationResult = upgradeSubscriptionSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: validationResult.error.errors
        },
        { status: 400 }
      );
    }

    const { subscription_id, new_plan_id, effective_date } = validationResult.data;

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

    // Check user permissions
    const userMembership = subscription.organization.memberships[0];
    if (!['owner', 'admin'].includes(userMembership.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to modify subscription' },
        { status: 403 }
      );
    }

    // Perform upgrade
    const subscriptionService = new SubscriptionService();
    const effectiveDateObj = effective_date ? new Date(effective_date) : undefined;
    
    const result = await subscriptionService.upgradeSubscription(
      subscription_id,
      new_plan_id,
      effectiveDateObj
    );

    return NextResponse.json({
      success: true,
      data: {
        subscription: result.subscription,
        proration: result.proration
      }
    });

  } catch (error) {
    console.error('Subscription upgrade error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    // Handle specific error cases
    if (errorMessage.includes('Subscription not found')) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }
    
    if (errorMessage.includes('Invalid or inactive target plan')) {
      return NextResponse.json(
        { error: 'Selected plan is not available' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to upgrade subscription' },
      { status: 500 }
    );
  }
}