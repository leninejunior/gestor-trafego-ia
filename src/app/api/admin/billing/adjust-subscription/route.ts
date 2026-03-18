import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAuth } from '@/lib/middleware/admin-auth';
import { z } from 'zod';

const adjustmentSchema = z.object({
  subscriptionId: z.string().uuid(),
  adjustmentType: z.enum(['credit', 'charge', 'plan_change', 'pause', 'resume']),
  amount: z.number().optional(),
  description: z.string().min(1),
  newPlanId: z.string().uuid().optional()
});

export async function POST(request: NextRequest) {
  try {
    // Check admin authentication
    const { user, error: authError } = await requireAdminAuth(request);
    if (authError) {
      return authError;
    }

    const body = await request.json();
    const validatedData = adjustmentSchema.parse(body);

    const supabase = await createClient();

    // Get subscription details
    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select(`
        id,
        organization_id,
        plan_id,
        status,
        current_period_start,
        current_period_end,
        subscription_plans!inner (
          id,
          name,
          monthly_price
        )
      `)
      .eq('id', validatedData.subscriptionId)
      .single();

    if (subscriptionError || !subscription) {
      return NextResponse.json(
        { success: false, error: 'Subscription not found' },
        { status: 404 }
      );
    }

    switch (validatedData.adjustmentType) {
      case 'credit':
      case 'charge':
        // Create an adjustment invoice
        const adjustmentAmount = validatedData.adjustmentType === 'credit' 
          ? -(validatedData.amount || 0) 
          : (validatedData.amount || 0);

        const { error: invoiceError } = await supabase
          .from('subscription_invoices')
          .insert({
            subscription_id: validatedData.subscriptionId,
            invoice_number: `ADJ-${Date.now()}`,
            amount: adjustmentAmount,
            currency: 'BRL',
            status: 'paid',
            line_items: [{
              description: validatedData.description,
              amount: adjustmentAmount,
              type: 'adjustment'
            }],
            due_date: new Date().toISOString(),
            paid_at: new Date().toISOString()
          });

        if (invoiceError) {
          throw invoiceError;
        }
        break;

      case 'plan_change':
        if (!validatedData.newPlanId) {
          return NextResponse.json(
            { success: false, error: 'New plan ID is required for plan changes' },
            { status: 400 }
          );
        }

        // Update subscription plan
        const { error: planChangeError } = await supabase
          .from('subscriptions')
          .update({
            plan_id: validatedData.newPlanId,
            updated_at: new Date().toISOString()
          })
          .eq('id', validatedData.subscriptionId);

        if (planChangeError) {
          throw planChangeError;
        }

        // Create a note about the plan change
        const { error: noteError } = await supabase
          .from('subscription_invoices')
          .insert({
            subscription_id: validatedData.subscriptionId,
            invoice_number: `NOTE-${Date.now()}`,
            amount: 0,
            currency: 'BRL',
            status: 'paid',
            line_items: [{
              description: `Plan change: ${validatedData.description}`,
              amount: 0,
              type: 'note'
            }],
            due_date: new Date().toISOString(),
            paid_at: new Date().toISOString()
          });

        if (noteError) {
          console.error('Error creating plan change note:', noteError);
        }
        break;

      case 'pause':
        // Pause subscription
        const { error: pauseError } = await supabase
          .from('subscriptions')
          .update({
            status: 'paused',
            updated_at: new Date().toISOString()
          })
          .eq('id', validatedData.subscriptionId);

        if (pauseError) {
          throw pauseError;
        }
        break;

      case 'resume':
        // Resume subscription
        const { error: resumeError } = await supabase
          .from('subscriptions')
          .update({
            status: 'active',
            updated_at: new Date().toISOString()
          })
          .eq('id', validatedData.subscriptionId);

        if (resumeError) {
          throw resumeError;
        }
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid adjustment type' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      message: 'Subscription adjustment applied successfully'
    });

  } catch (error) {
    console.error('Error adjusting subscription:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to adjust subscription' },
      { status: 500 }
    );
  }
}