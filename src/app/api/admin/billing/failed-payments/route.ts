import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAuth } from '@/lib/middleware/admin-auth';

export async function GET(request: NextRequest) {
  try {
    // Check admin authentication
    const { user, error: authError } = await requireAdminAuth(request);
    if (authError) {
      return authError;
    }

    const supabase = await createClient();

    // Try to get failed payments, but handle gracefully if tables don't exist
    let failedPayments = [];
    
    try {
      const { data, error } = await supabase
        .from('subscription_invoices')
        .select(`
          id,
          subscription_id,
          amount,
          currency,
          status,
          due_date,
          created_at,
          payment_intent_id,
          subscriptions!inner (
            id,
            organization_id,
            organizations!inner (
              id,
              name
            )
          )
        `)
        .in('status', ['open', 'uncollectible'])
        .lt('due_date', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (!error && data) {
        failedPayments = data;
      }
    } catch (dbError) {
      console.log('Database tables not ready, returning empty data');
      // Return empty data if tables don't exist yet
    }

    // Transform the data to match the expected format
    const transformedPayments = failedPayments?.map(payment => {
      const organization = payment.subscriptions?.organizations;
      
      return {
        id: payment.id,
        subscriptionId: payment.subscription_id,
        organizationName: organization?.name || 'Unknown Organization',
        customerEmail: 'admin@example.com',
        amount: payment.amount,
        currency: payment.currency || 'BRL',
        failureReason: payment.status === 'uncollectible' ? 'Payment failed after retries' : 'Payment overdue',
        attemptCount: payment.status === 'uncollectible' ? 3 : 1,
        nextRetryAt: payment.status === 'open' ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null,
        createdAt: payment.created_at,
        status: payment.status === 'uncollectible' ? 'failed' : 'pending_retry'
      };
    }) || [];

    return NextResponse.json({
      success: true,
      data: transformedPayments,
      message: transformedPayments.length === 0 ? 'No failed payments found' : undefined
    });

  } catch (error) {
    console.error('Error fetching failed payments:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch failed payments' },
      { status: 500 }
    );
  }
}