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

    return NextResponse.json(
      {
        success: false,
        error: 'Retry de pagamento não implementado sem integração real com gateway.',
        invoiceId: invoice.id,
        subscriptionId: invoice.subscription_id,
      },
      { status: 501 }
    );

  } catch (error) {
    console.error('Error retrying payment:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retry payment' },
      { status: 500 }
    );
  }
}
