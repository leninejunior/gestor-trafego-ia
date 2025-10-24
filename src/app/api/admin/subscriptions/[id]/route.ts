import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { adminAuthMiddleware } from '@/lib/middleware/admin-auth';
import { SubscriptionService } from '@/lib/services/subscription-service';

const subscriptionService = new SubscriptionService();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check admin authentication
    const authResult = await adminAuthMiddleware(request);
    if (!authResult.isAuthorized) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const supabase = await createClient();
    const subscriptionId = params.id;

    // Get subscription with related data
    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select(`
        *,
        subscription_plans!subscriptions_plan_id_fkey (*),
        organizations!subscriptions_organization_id_fkey (
          id,
          name,
          slug,
          created_at
        )
      `)
      .eq('id', subscriptionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
      }
      throw new Error(`Failed to fetch subscription: ${error.message}`);
    }

    // Get billing history
    const { data: invoices } = await supabase
      .from('subscription_invoices')
      .select('*')
      .eq('subscription_id', subscriptionId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Get feature usage for the organization
    const { data: featureUsage } = await supabase
      .from('feature_usage')
      .select('*')
      .eq('organization_id', subscription.organization_id)
      .gte('usage_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]) // Last 30 days
      .order('usage_date', { ascending: false });

    // Calculate subscription metrics
    const now = new Date();
    const periodEnd = new Date(subscription.current_period_end);
    const daysUntilRenewal = Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    const currentPrice = subscription.billing_cycle === 'annual' 
      ? subscription.subscription_plans?.annual_price 
      : subscription.subscription_plans?.monthly_price;

    const totalRevenue = invoices?.reduce((sum, invoice) => 
      invoice.status === 'paid' ? sum + invoice.amount : sum, 0) || 0;

    const result = {
      subscription: {
        ...subscription,
        current_price: currentPrice,
        days_until_renewal: Math.max(0, daysUntilRenewal),
        total_revenue: totalRevenue
      },
      billing_history: invoices || [],
      feature_usage: featureUsage || [],
      organization: subscription.organizations,
      plan: subscription.subscription_plans
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error('Admin subscription detail error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription details' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check admin authentication
    const authResult = await adminAuthMiddleware(request);
    if (!authResult.isAuthorized) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const subscriptionId = params.id;
    const body = await request.json();
    const { status, plan_id, billing_cycle, notes } = body;

    const supabase = await createClient();

    // Validate subscription exists
    const { data: existingSubscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .single();

    if (!existingSubscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (status) {
      updateData.status = status;
      
      // Handle status-specific logic
      if (status === 'canceled') {
        updateData.canceled_at = new Date().toISOString();
      } else if (status === 'active' && existingSubscription.status === 'canceled') {
        // Reactivating - clear cancellation data
        updateData.canceled_at = null;
        updateData.cancel_at_period_end = false;
      }
    }

    if (plan_id && plan_id !== existingSubscription.plan_id) {
      // Validate new plan exists
      const { data: newPlan } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('id', plan_id)
        .eq('is_active', true)
        .single();

      if (!newPlan) {
        return NextResponse.json({ error: 'Invalid plan ID' }, { status: 400 });
      }

      updateData.plan_id = plan_id;
    }

    if (billing_cycle && billing_cycle !== existingSubscription.billing_cycle) {
      updateData.billing_cycle = billing_cycle;
      
      // Recalculate period end based on new billing cycle
      const periodStart = new Date(existingSubscription.current_period_start);
      let newPeriodEnd: Date;
      
      if (billing_cycle === 'annual') {
        newPeriodEnd = new Date(periodStart.getFullYear() + 1, periodStart.getMonth(), periodStart.getDate());
      } else {
        newPeriodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, periodStart.getDate());
      }
      
      updateData.current_period_end = newPeriodEnd.toISOString();
    }

    // Add admin notes if provided
    if (notes) {
      updateData.admin_notes = notes;
    }

    // Update subscription
    const { data: updatedSubscription, error } = await supabase
      .from('subscriptions')
      .update(updateData)
      .eq('id', subscriptionId)
      .select(`
        *,
        subscription_plans!subscriptions_plan_id_fkey (*),
        organizations!subscriptions_organization_id_fkey (*)
      `)
      .single();

    if (error) {
      throw new Error(`Failed to update subscription: ${error.message}`);
    }

    // Log the admin action
    await supabase
      .from('admin_audit_log')
      .insert({
        admin_user_id: authResult.user.id,
        action: 'subscription_updated',
        resource_type: 'subscription',
        resource_id: subscriptionId,
        details: {
          changes: updateData,
          previous_status: existingSubscription.status,
          new_status: status || existingSubscription.status
        }
      });

    return NextResponse.json({
      subscription: updatedSubscription,
      message: 'Subscription updated successfully'
    });

  } catch (error) {
    console.error('Admin subscription update error:', error);
    return NextResponse.json(
      { error: 'Failed to update subscription' },
      { status: 500 }
    );
  }
}