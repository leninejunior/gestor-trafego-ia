import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { BillingEngine } from '@/lib/services/billing-engine';

/**
 * GET /api/subscriptions/billing-history
 * Get billing history for the current organization's subscription
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

    // Get organization_id from query parameters or user's membership
    const { searchParams } = new URL(request.url);
    let organizationId = searchParams.get('organization_id');

    if (!organizationId) {
      // Fallback to user's default organization
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
      
      organizationId = membership.organization_id;
    } else {
      // Verify user has access to the specified organization
      const { data: membership, error: membershipError } = await supabase
        .from('organization_memberships')
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
    }

    // Get organization's active subscription
    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .single();

    if (subscriptionError || !subscription) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 404 }
      );
    }

    // Parse query parameters for pagination
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get billing history
    const billingEngine = new BillingEngine();
    const invoices = await billingEngine.getBillingHistory(subscription.id, limit, offset);

    return NextResponse.json({
      invoices,
      pagination: {
        limit,
        offset,
        hasMore: invoices.length === limit
      }
    });

  } catch (error) {
    console.error('Error fetching billing history:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}