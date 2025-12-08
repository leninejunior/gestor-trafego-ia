import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAuth } from '@/lib/middleware/admin-auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    // Check admin authentication
    const { user, error: authError } = await requireAdminAuth(request);
    if (authError) {
      return authError;
    }

    const { paymentId } = await params;
    const supabase = await createClient();

    // Get the invoice details
    const { data: invoice, error: invoiceError } = await supabase
      .from('subscription_invoices')
      .select(`
        id,
        subscription_id,
        amount,
        currency,
        status,
        payment_intent_id,
        subscriptions!inner (
          id,
          organization_id,
          payment_method_id
        )
      `)
      .eq('id', paymentId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json(
        { success: false, error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // In a real implementation, this would integrate with Stripe or another payment processor
    // For now, we'll simulate a retry attempt
    
    // Simulate payment processing (in real implementation, this would call Stripe API)
    const paymentSuccess = Math.random() > 0.3; // 70% success rate for simulation

    if (paymentSuccess) {
      // Update invoice status to paid
      const { error: updateError } = await supabase
        .from('subscription_invoices')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString()
        })
        .eq('id', paymentId);

      if (updateError) {
        throw updateError;
      }

      // Update subscription status if it was past_due
      const { error: subscriptionError } = await supabase
        .from('subscriptions')
        .update({ status: 'active' })
        .eq('id', invoice.subscription_id)
        .eq('status', 'past_due');

      if (subscriptionError) {
        console.error('Error updating subscription status:', subscriptionError);
      }

      return NextResponse.json({
        success: true,
        message: 'Payment retry successful'
      });
    } else {
      // Payment failed again - in real implementation, you might want to:
      // 1. Increment retry count
      // 2. Schedule next retry
      // 3. Send notification to customer
      
      return NextResponse.json({
        success: false,
        error: 'Payment retry failed. Customer will be notified.'
      });
    }

  } catch (error) {
    console.error('Error retrying payment:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retry payment' },
      { status: 500 }
    );
  }
}