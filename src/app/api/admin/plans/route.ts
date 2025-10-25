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
        monthly_price: plan.monthly_price,
        annual_price: plan.annual_price,
        max_clients: plan.max_clients,
        features_type: typeof plan.features,
        features_is_array: Array.isArray(plan.features)
      });
      
      // Normalize features to array
      let featuresArray: string[] = [];
      if (Array.isArray(plan.features)) {
        featuresArray = plan.features;
      } else if (plan.features && typeof plan.features === 'object') {
        // If features is an object, convert to array of strings
        featuresArray = Object.entries(plan.features).map(([key, value]) => 
          typeof value === 'boolean' ? key : `${key}: ${value}`
        );
      } else if (typeof plan.features === 'string') {
        // If features is a string, try to parse it
        try {
          const parsed = JSON.parse(plan.features);
          featuresArray = Array.isArray(parsed) ? parsed : [];
        } catch {
          featuresArray = [plan.features];
        }
      }
      
      return {
        ...plan,
        // Ensure prices are numbers (they're already correctly named in DB)
        monthly_price: parseFloat(plan.monthly_price) || 0,
        annual_price: parseFloat(plan.annual_price) || 0,
        features: featuresArray, // Ensure features is always an array
        limits: {
          clients: plan.max_clients || 0,
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
        monthly_price: body.monthly_price || 0,
        annual_price: body.annual_price || 0,
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