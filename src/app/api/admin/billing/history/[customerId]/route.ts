import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAuth } from '@/lib/middleware/admin-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { customerId: string } }
) {
  try {
    // Check admin authentication
    const { user, error: authError } = await requireAdminAuth(request);
    if (authError) {
      return authError;
    }

    const { customerId } = params;
    const supabase = await createClient();

    // Get billing history for the customer (subscription)
    const { data: billingHistory, error } = await supabase
      .from('subscription_invoices')
      .select(`
        id,
        invoice_number,
        amount,
        currency,
        status,
        line_items,
        due_date,
        paid_at,
        created_at,
        payment_intent_id
      `)
      .eq('subscription_id', customerId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    // Transform the data to include description from line items
    const transformedHistory = billingHistory?.map(invoice => ({
      id: invoice.id,
      created_at: invoice.created_at,
      description: invoice.line_items?.[0]?.description || `Invoice ${invoice.invoice_number}`,
      amount: invoice.amount,
      currency: invoice.currency || 'BRL',
      status: invoice.status,
      due_date: invoice.due_date,
      paid_at: invoice.paid_at,
      invoice_number: invoice.invoice_number,
      payment_intent_id: invoice.payment_intent_id
    })) || [];

    return NextResponse.json({
      success: true,
      data: transformedHistory
    });

  } catch (error) {
    console.error('Error fetching billing history:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch billing history' },
      { status: 500 }
    );
  }
}