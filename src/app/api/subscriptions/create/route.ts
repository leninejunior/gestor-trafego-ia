import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SubscriptionService } from '@/lib/services/subscription-service';
import { CreateSubscriptionRequest } from '@/lib/types/subscription';
import { z } from 'zod';

// Validation schema for subscription creation
const createSubscriptionSchema = z.object({
  organization_id: z.string().uuid('Invalid organization ID'),
  plan_id: z.string().uuid('Invalid plan ID'),
  billing_cycle: z.enum(['monthly', 'annual'], {
    errorMap: () => ({ message: 'Billing cycle must be monthly or annual' })
  }),
  payment_method_id: z.string().optional(),
  trial_days: z.number().min(0).max(90).optional()
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
    const validationResult = createSubscriptionSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: validationResult.error.errors
        },
        { status: 400 }
      );
    }

    const subscriptionRequest: CreateSubscriptionRequest = validationResult.data;

    // Verify user has access to the organization
    const { data: membership, error: membershipError } = await supabase
      .from('organization_memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', subscriptionRequest.organization_id)
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

    // Create subscription
    const subscriptionService = new SubscriptionService();
    const subscription = await subscriptionService.createSubscription(subscriptionRequest);

    return NextResponse.json({
      success: true,
      data: subscription
    });

  } catch (error) {
    console.error('Subscription creation error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    // Handle specific error cases
    if (errorMessage.includes('already has an active subscription')) {
      return NextResponse.json(
        { error: 'Organization already has an active subscription' },
        { status: 409 }
      );
    }
    
    if (errorMessage.includes('Invalid or inactive subscription plan')) {
      return NextResponse.json(
        { error: 'Selected plan is not available' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create subscription' },
      { status: 500 }
    );
  }
}