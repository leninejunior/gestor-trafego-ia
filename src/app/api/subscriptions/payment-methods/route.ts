import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { StripeService } from '@/lib/stripe/stripe-service';
import { z } from 'zod';

const stripeService = new StripeService();

// Validation schema for payment method operations
const paymentMethodSchema = z.object({
  organization_id: z.string().uuid('Invalid organization ID'),
  payment_method_id: z.string().optional()
});

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
      .from('memberships')
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

    // Get subscription to find Stripe customer ID
    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('organization_id', organizationId)
      .single();

    if (subscriptionError || !subscription?.stripe_customer_id) {
      return NextResponse.json({
        success: true,
        data: []
      });
    }

    // Get payment methods from Stripe
    const paymentMethods = await stripeService.getCustomerPaymentMethods(
      subscription.stripe_customer_id
    );

    return NextResponse.json({
      success: true,
      data: paymentMethods.map(pm => ({
        id: pm.id,
        type: pm.type,
        card: pm.card ? {
          brand: pm.card.brand,
          last4: pm.card.last4,
          exp_month: pm.card.exp_month,
          exp_year: pm.card.exp_year
        } : null,
        created: pm.created
      }))
    });

  } catch (error) {
    console.error('Get payment methods error:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch payment methods' },
      { status: 500 }
    );
  }
}

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
    const validationResult = paymentMethodSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: validationResult.error.errors
        },
        { status: 400 }
      );
    }

    const { organization_id, payment_method_id } = validationResult.data;

    // Verify user has access to the organization
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
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

    // Only owners and admins can manage payment methods
    if (!['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to manage payment methods' },
        { status: 403 }
      );
    }

    // Get subscription to find Stripe customer ID
    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('organization_id', organization_id)
      .single();

    if (subscriptionError || !subscription?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 404 }
      );
    }

    if (payment_method_id) {
      // Update default payment method
      await stripeService.updateDefaultPaymentMethod(
        subscription.stripe_customer_id,
        payment_method_id
      );

      return NextResponse.json({
        success: true,
        message: 'Default payment method updated'
      });
    } else {
      // Create setup intent for adding new payment method
      const setupIntent = await stripeService.createSetupIntent(
        subscription.stripe_customer_id
      );

      return NextResponse.json({
        success: true,
        data: {
          client_secret: setupIntent.client_secret,
          setup_intent_id: setupIntent.id
        }
      });
    }

  } catch (error) {
    console.error('Payment method operation error:', error);
    
    return NextResponse.json(
      { error: 'Failed to process payment method operation' },
      { status: 500 }
    );
  }
}