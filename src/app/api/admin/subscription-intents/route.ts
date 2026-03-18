/**
 * API para gestão administrativa de subscription intents
 * Permite listar, filtrar e gerenciar intenções de assinatura
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { 
  SubscriptionIntentSearchParams, 
  SubscriptionIntentSearchResult,
  SubscriptionIntentFilters 
} from '@/lib/types/subscription-intent';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Verificar se é admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verificar permissões de admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const sortField = searchParams.get('sort_field') || 'created_at';
    const sortDirection = searchParams.get('sort_direction') || 'desc';

    // Build filters
    const filters: SubscriptionIntentFilters = {};
    
    const status = searchParams.get('status');
    if (status) {
      filters.status = status.split(',') as any[];
    }

    const planId = searchParams.get('plan_id');
    if (planId) {
      filters.plan_id = planId;
    }

    const userEmail = searchParams.get('user_email');
    if (userEmail) {
      filters.user_email = userEmail;
    }

    const createdAfter = searchParams.get('created_after');
    if (createdAfter) {
      filters.created_after = createdAfter;
    }

    const createdBefore = searchParams.get('created_before');
    if (createdBefore) {
      filters.created_before = createdBefore;
    }

    // Build query
    let query = supabase
      .from('subscription_intents')
      .select(`
        *,
        plan:subscription_plans(
          id,
          name,
          description,
          monthly_price,
          annual_price,
          features
        )
      `);

    // Apply filters
    if (filters.status && filters.status.length > 0) {
      query = query.in('status', filters.status);
    }

    if (filters.plan_id) {
      query = query.eq('plan_id', filters.plan_id);
    }

    if (filters.user_email) {
      query = query.ilike('user_email', `%${filters.user_email}%`);
    }

    if (filters.created_after) {
      query = query.gte('created_at', filters.created_after);
    }

    if (filters.created_before) {
      query = query.lte('created_at', filters.created_before);
    }

    // Apply sorting
    query = query.order(sortField, { ascending: sortDirection === 'asc' });

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: intents, error, count } = await query;

    if (error) {
      console.error('Error fetching subscription intents:', error);
      return NextResponse.json(
        { error: 'Failed to fetch subscription intents' },
        { status: 500 }
      );
    }

    // Get total count for pagination
    const { count: totalCount } = await supabase
      .from('subscription_intents')
      .select('*', { count: 'exact', head: true });

    const result: SubscriptionIntentSearchResult = {
      intents: intents || [],
      total: totalCount || 0,
      page,
      limit,
      hasMore: (totalCount || 0) > page * limit
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error in subscription intents API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
