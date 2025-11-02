import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkAdminAuth, createAdminAuthErrorResponse } from '@/lib/middleware/admin-auth-improved';

/**
 * GET /api/admin/plans
 * Admin-only endpoint to list all subscription plans (including inactive)
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'development') {
    console.log('🔍 API /api/admin/plans GET called');
  }
  try {
    // Check authentication and admin role
    const authResult = await checkAdminAuth();
    
    if (!authResult.success) {
      if (process.env.NODE_ENV === 'development') {
        console.log('❌ Auth failed:', authResult.error);
        // In development, log but continue for testing
        console.log('🔧 Development mode: Continuing despite auth failure for testing');
      } else {
        return createAdminAuthErrorResponse(authResult);
      }
    }

    const supabase = await createClient();
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 Development mode: Using supabase client');
    }

    // Buscar planos sem JOIN (temporário até criar plan_limits)
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .order('created_at', { ascending: false });

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
    const transformedPlans = (data || []).map(plan => {
      if (process.env.NODE_ENV === 'development') {
        console.log('📝 Transforming plan:', plan.name, 'count:', data?.length);
      }
      
      // Enforce features as array - assume JSONB array at storage level
      let featuresArray: string[] = [];
      if (Array.isArray(plan.features)) {
        featuresArray = plan.features;
      } else {
        // Log unexpected data type for debugging
        console.warn('Unexpected features data type:', typeof plan.features, plan.features);
        // Fallback to empty array for safety
        featuresArray = [];
      }
      
      return {
        ...plan,
        // Ensure prices are numbers (they're already correctly named in DB)
        monthly_price: parseFloat(plan.monthly_price) || 0,
        annual_price: parseFloat(plan.annual_price) || 0,
        features: featuresArray, // Ensure features is always an array
        limits: {
          // Legacy fields
          clients: plan.max_clients || 0,
          campaigns: plan.max_campaigns || 0,
          users: 1,
          ad_accounts: 1,
          api_calls: 10000,
          storage_gb: 10,
          // Cache & Resource limits (usando valores padrão até criar plan_limits)
          max_clients: plan.max_clients || 5,
          max_campaigns_per_client: plan.max_campaigns || 25,
          data_retention_days: 90,
          sync_interval_hours: 24,
          allow_csv_export: false,
          allow_json_export: false
        },
        is_popular: false // This field doesn't exist in the current schema
      };
    });

    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Returning', transformedPlans.length, 'plans');
    }
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

    // Validate service role key presence
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Service role key not configured');
    }

    // Create Supabase client with service role for admin operations
    const supabase = createClient({
      supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY
    });
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

    // Validate features as array
    if (body.features && !Array.isArray(body.features)) {
      return NextResponse.json(
        { success: false, error: 'Features must be an array of strings' },
        { status: 400 }
      );
    }

    // Ensure features is always an array
    const features = Array.isArray(body.features) ? body.features : [];

    // Create the plan
    const { data: newPlan, error: createError } = await supabase
      .from('subscription_plans')
      .insert({
        name: body.name,
        description: body.description,
        monthly_price: body.monthly_price || 0,
        annual_price: body.annual_price || 0,
        max_clients: body.limits?.clients || body.limits?.max_clients || 5,
        max_campaigns: body.limits?.campaigns || body.limits?.max_campaigns_per_client || 50,
        features: features,
        is_active: body.is_active !== undefined ? body.is_active : true
      })
      .select()
      .single();

    if (createError) {
      throw new Error(`Failed to create plan: ${createError.message}`);
    }

    // Create plan_limits record
    const { error: limitsError } = await supabase
      .from('plan_limits')
      .insert({
        plan_id: newPlan.id,
        max_clients: body.limits?.max_clients || 5,
        max_campaigns_per_client: body.limits?.max_campaigns_per_client || 25,
        data_retention_days: body.limits?.data_retention_days || 90,
        sync_interval_hours: body.limits?.sync_interval_hours || 24,
        allow_csv_export: body.limits?.allow_csv_export ? true : false,
        allow_json_export: body.limits?.allow_json_export ? true : false
      });

    if (limitsError) {
      console.error('Warning: Failed to create plan_limits:', limitsError);
      // Don't fail the whole operation, just log the warning
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