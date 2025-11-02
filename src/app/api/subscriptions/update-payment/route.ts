import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { StripeService } from '@/lib/stripe/stripe-service';
import { z } from 'zod';

const updatePaymentSchema = z.object({
  payment_method_id: z.string().min(1, 'Payment method ID is required'),
  set_as_default: z.boolean().optional().default(true)
});

/**
 * POST /api/subscriptions/update-payment
 * Update payment method for the current organization's subscription
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

    // Parse and validate request body
    const body = await request.json();
    const validatedData = updatePaymentSchema.parse(body);

    // Get user's organization
    const { data: membership, error: membershipError } = await supabase
      .from('organization_memberships')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Get organization's active subscription
    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('organization_id', membership.organization_id)
      .eq('status', 'active')
      .single();

    if (subscriptionError || !subscription) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 404 }
      );
    }

    const stripeService = new StripeService();

    // If subscription has Stripe integration
    if (subscription.stripe_subscription_id && subscription.stripe_customer_id) {
      try {
        // Update the default payment method for the customer
        if (validatedData.set_as_default) {
          await stripeService.updateDefaultPaymentMethod(
            subscription.stripe_customer_id,
            validatedData.payment_method_id
          );
        }

        // Update the subscription's default payment method
        await stripeService.updateSubscription(subscription.stripe_subscription_id, {
          paymentMethodId: validatedData.payment_method_id
        });

        // Update our database record
        const { error: updateError } = await supabase
          .from('subscriptions')
          .update({
            payment_method_id: validatedData.payment_method_id,
            updated_at: new Date().toISOString()
          })
          .eq('id', subscription.id);

        if (updateError) {
          throw new Error(`Failed to update subscription record: ${updateError.message}`);
        }

        return NextResponse.json({
          success: true,
          message: 'Payment method updated successfully'
        });

      } catch (stripeError) {
        console.error('Stripe payment method update error:', stripeError);
        return NextResponse.json(
          { error: 'Failed to update payment method with payment provider' },
          { status: 400 }
        );
      }
    } else {
      // For subscriptions without Stripe integration, just update our record
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({
          payment_method_id: validatedData.payment_method_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', subscription.id);

      if (updateError) {
        return NextResponse.json(
          { error: 'Failed to update payment method' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Payment method updated successfully'
      });
    }

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error updating payment method:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/subscriptions/update-payment
 * Get current payment methods for the organization's subscription
 */
export async function GET(request: NextRequest) {
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

    // Get user's organization
    const { data: membership, error: membershipError } = await supabase
      .from('organization_memberships')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Get organization's active subscription
    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('organization_id', membership.organization_id)
      .eq('status', 'active')
      .single();

    if (subscriptionError || !subscription) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 404 }
      );
    }

    // If subscription has Stripe integration, get payment methods from Stripe
    if (subscription.stripe_customer_id) {
      try {
        const stripeService = new StripeService();
        const paymentMethods = await stripeService.getCustomerPaymentMethods(
          subscription.stripe_customer_id
        );

        return NextResponse.json({
          payment_methods: paymentMethods.map(pm => ({
            id: pm.id,
            type: pm.type,
            card: pm.card ? {
              brand: pm.card.brand,
              last4: pm.card.last4,
              exp_month: pm.card.exp_month,
              exp_year: pm.card.exp_year
            } : null,
            is_default: pm.id === subscription.payment_method_id
          })),
          current_payment_method_id: subscription.payment_method_id
        });

      } catch (stripeError) {
        console.error('Error fetching Stripe payment methods:', stripeError);
        return NextResponse.json(
          { error: 'Failed to fetch payment methods' },
          { status: 500 }
        );
      }
    } else {
      // For subscriptions without Stripe integration
      return NextResponse.json({
        payment_methods: [],
        current_payment_method_id: subscription.payment_method_id,
        message: 'No payment provider configured'
      });
    }

  } catch (error) {
    console.error('Error fetching payment methods:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}