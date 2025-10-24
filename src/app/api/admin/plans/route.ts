import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkAdminAuth, createAdminAuthErrorResponse } from '@/lib/middleware/admin-auth-improved';

/**
 * GET /api/admin/plans
 * Admin-only endpoint to list all subscription plans (including inactive)
 */
export async function GET(request: NextRequest) {
  console.log('🔍 API /api/admin/plans GET called');
  try {
    // Check authentication and admin role
    console.log('🔐 Checking admin auth...');
    const authResult = await checkAdminAuth();
    console.log('🔐 Auth result:', { success: authResult.success, hasUser: !!authResult.user });
    
    if (!authResult.success) {
      console.log('❌ Auth failed, returning error response');
      return createAdminAuthErrorResponse(authResult);
    }

    console.log('✅ Creating Supabase client...');
    const supabase = await createClient();
    console.log('Admin access granted - User:', authResult.user?.id);

    // Check if subscription_plans table exists, if not return empty array
    console.log('📊 Fetching plans from database...');
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .order('created_at', { ascending: false });

    console.log('📊 Query result:', { hasData: !!data, dataLength: data?.length, error: error?.message });

    if (error) {
      console.error('❌ Database error:', error);
      // If table doesn't exist, return empty plans array
      if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
        return NextResponse.json({
          success: true,
          plans: [],
          message: 'Subscription plans table not found - returning empty list'
        });
      }
      throw new Error(`Failed to fetch plans: ${error.message}`);
    }

    // Transform data to match component expectations
    console.log('🔄 Transforming plans data...');
    const transformedPlans = (data || []).map(plan => {
      console.log('📝 Transforming plan:', plan.name, {
        price_monthly: plan.price_monthly,
        price_yearly: plan.price_yearly,
        max_clients: plan.max_clients
      });
      
      return {
        ...plan,
        // Map database column names to frontend expected names
        monthly_price: plan.price_monthly,
        annual_price: plan.price_yearly,
        limits: {
          clients: plan.max_clients,
          campaigns: plan.max_campaigns || 0,
          users: plan.max_users || 1,
          ad_accounts: plan.max_ad_accounts || 1,
          api_calls: 10000,
          storage_gb: 10
        },
        is_popular: false // This field doesn't exist in the current schema
      };
    });

    console.log('✅ Returning', transformedPlans.length, 'plans');
    return NextResponse.json({
      success: true,
      plans: transformedPlans,
    });
  } catch (error) {
    console.error('❌ Error fetching subscription plans:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch subscription plans',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/plans
 * Admin-only endpoint to create new subscription plans
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication and admin role
    const authResult = await checkAdminAuth();
    if (!authResult.success) {
      return createAdminAuthErrorResponse(authResult);
    }

    const supabase = await createClient();
    console.log('Admin access granted - User:', authResult.user?.id);

    // Parse request body
    const body = await request.json();

    // Basic validation
    if (!body.name || !body.description) {
      return NextResponse.json(
        { success: false, error: 'Name and description are required' },
        { status: 400 }
      );
    }

    // Create the plan
    const { data: newPlan, error: createError } = await supabase
      .from('subscription_plans')
      .insert({
        name: body.name,
        description: body.description,
        price_monthly: body.monthly_price || body.price_monthly || 0,
        price_yearly: body.annual_price || body.price_yearly || 0,
        max_ad_accounts: body.limits?.ad_accounts || 1,
        max_users: body.limits?.users || 1,
        max_clients: body.limits?.clients || 5,
        features: body.features || [],
        is_active: body.is_active !== undefined ? body.is_active : true
      })
      .select()
      .single();

    if (createError) {
      throw new Error(`Failed to create plan: ${createError.message}`);
    }

    return NextResponse.json({
      success: true,
      data: newPlan,
      message: 'Subscription plan created successfully',
    });
  } catch (error) {
    console.error('Error creating subscription plan:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create subscription plan',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}