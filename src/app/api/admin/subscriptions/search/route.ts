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
    const { searchParams } = new URL(request.url);
    
    const query = searchParams.get('query') || '';
    const status = searchParams.get('status') || '';
    const plan = searchParams.get('plan') || '';
    const billingCycle = searchParams.get('billing_cycle') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    // Build query
    let supabaseQuery = supabase
      .from('subscriptions')
      .select(`
        *,
        subscription_plans!subscriptions_plan_id_fkey (
          id,
          name,
          monthly_price,
          annual_price
        ),
        organizations!subscriptions_organization_id_fkey (
          id,
          name,
          slug
        )
      `, { count: 'exact' });

    // Apply filters
    if (status) {
      supabaseQuery = supabaseQuery.eq('status', status);
    }

    if (plan) {
      supabaseQuery = supabaseQuery.eq('subscription_plans.name', plan);
    }

    if (billingCycle) {
      supabaseQuery = supabaseQuery.eq('billing_cycle', billingCycle);
    }

    // Apply search query (search in organization name)
    if (query) {
      supabaseQuery = supabaseQuery.ilike('organizations.name', `%${query}%`);
    }

    // Apply pagination and ordering
    const { data: subscriptions, error: queryError, count } = await supabaseQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (queryError) {
      throw new Error(`Failed to search subscriptions: ${queryError.message}`);
    }

    // Calculate pagination info
    const totalPages = Math.ceil((count || 0) / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    // Format results
    const formattedSubscriptions = subscriptions?.map(sub => ({
      id: sub.id,
      organization: {
        id: sub.organizations?.id,
        name: sub.organizations?.name || 'Unknown',
        slug: sub.organizations?.slug
      },
      plan: {
        id: sub.subscription_plans?.id,
        name: sub.subscription_plans?.name || 'Unknown',
        monthly_price: sub.subscription_plans?.monthly_price,
        annual_price: sub.subscription_plans?.annual_price
      },
      status: sub.status,
      billing_cycle: sub.billing_cycle,
      current_period_start: sub.current_period_start,
      current_period_end: sub.current_period_end,
      trial_end: sub.trial_end,
      created_at: sub.created_at,
      updated_at: sub.updated_at,
      // Calculate current price
      current_price: sub.billing_cycle === 'annual' 
        ? sub.subscription_plans?.annual_price 
        : sub.subscription_plans?.monthly_price
    })) || [];

    return NextResponse.json({
      subscriptions: formattedSubscriptions,
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: totalPages,
        has_next_page: hasNextPage,
        has_prev_page: hasPrevPage
      }
    });

  } catch (err) {
    console.error('Admin subscription search error:', err);
    return NextResponse.json(
      { error: 'Failed to search subscriptions' },
      { status: 500 }
    );
  }
}