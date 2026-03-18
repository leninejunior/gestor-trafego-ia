import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { checkAdminAuth, createAdminAuthErrorResponse } from '@/lib/middleware/admin-auth-improved';

type RouteParams = { params: Promise<{ id: string }> };

// Helper to get service role client for admin operations (bypasses RLS)
function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

/**
 * GET /api/admin/plans/[id]
 * Get a specific subscription plan
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    
    const authResult = await checkAdminAuth();
    if (!authResult.success) {
      return createAdminAuthErrorResponse(authResult);
    }

    // Use service role to bypass RLS for admin operations
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Plan not found' },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error fetching plan:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch plan',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/plans/[id]
 * Update a subscription plan
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    
    const authResult = await checkAdminAuth();
    if (!authResult.success) {
      return createAdminAuthErrorResponse(authResult);
    }

    // Use service role to bypass RLS for admin operations
    const supabase = getServiceClient();
    const body = await request.json();

    console.log('📝 PUT /api/admin/plans/[id] - Received body:', JSON.stringify(body, null, 2));

    // Validate required fields
    if (body.name !== undefined && !body.name.trim()) {
      return NextResponse.json(
        { success: false, error: 'Plan name cannot be empty' },
        { status: 400 }
      );
    }

    if (body.description !== undefined && !body.description.trim()) {
      return NextResponse.json(
        { success: false, error: 'Plan description cannot be empty' },
        { status: 400 }
      );
    }

    // Validate prices
    if (body.monthly_price !== undefined && (typeof body.monthly_price !== 'number' || body.monthly_price < 0)) {
      return NextResponse.json(
        { success: false, error: 'Monthly price must be a non-negative number' },
        { status: 400 }
      );
    }

    if (body.annual_price !== undefined && (typeof body.annual_price !== 'number' || body.annual_price < 0)) {
      return NextResponse.json(
        { success: false, error: 'Annual price must be a non-negative number' },
        { status: 400 }
      );
    }

    // Validate features
    if (body.features !== undefined) {
      if (!Array.isArray(body.features)) {
        return NextResponse.json(
          { success: false, error: 'Features must be an array' },
          { status: 400 }
        );
      }
      if (body.features.length === 0) {
        return NextResponse.json(
          { success: false, error: 'At least one feature is required' },
          { status: 400 }
        );
      }
    }

    // Build update object
    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.monthly_price !== undefined) updateData.monthly_price = body.monthly_price;
    if (body.annual_price !== undefined) updateData.annual_price = body.annual_price;
    if (body.features !== undefined) updateData.features = body.features;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;
    if (body.is_popular !== undefined) updateData.is_popular = body.is_popular;
    
    // Update limits if provided
    if (body.limits) {
      if (body.limits.clients !== undefined) updateData.max_clients = body.limits.clients;
      if (body.limits.campaigns !== undefined) updateData.max_campaigns = body.limits.campaigns;
      if (body.limits.max_clients !== undefined) updateData.max_clients = body.limits.max_clients;
      if (body.limits.max_campaigns_per_client !== undefined) updateData.max_campaigns = body.limits.max_campaigns_per_client;
    }

    updateData.updated_at = new Date().toISOString();

    console.log('📝 Updating plan with data:', JSON.stringify(updateData, null, 2));

    const { data, error } = await supabase
      .from('subscription_plans')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ Database error:', error);
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Plan not found' },
          { status: 404 }
        );
      }
      throw error;
    }

    // Update plan_limits if limits are provided
    if (body.limits) {
      const limitsData: Record<string, unknown> = {};
      if (body.limits.max_clients !== undefined) limitsData.max_clients = body.limits.max_clients;
      if (body.limits.max_campaigns_per_client !== undefined) limitsData.max_campaigns_per_client = body.limits.max_campaigns_per_client;
      if (body.limits.data_retention_days !== undefined) limitsData.data_retention_days = body.limits.data_retention_days;
      if (body.limits.sync_interval_hours !== undefined) limitsData.sync_interval_hours = body.limits.sync_interval_hours;
      if (body.limits.allow_csv_export !== undefined) limitsData.allow_csv_export = body.limits.allow_csv_export ? true : false;
      if (body.limits.allow_json_export !== undefined) limitsData.allow_json_export = body.limits.allow_json_export ? true : false;

      if (Object.keys(limitsData).length > 0) {
        limitsData.updated_at = new Date().toISOString();
        
        const { error: limitsError } = await supabase
          .from('plan_limits')
          .upsert({
            plan_id: id,
            ...limitsData
          }, {
            onConflict: 'plan_id'
          });

        if (limitsError) {
          console.error('Warning: Failed to update plan_limits:', limitsError);
        }
      }
    }

    console.log('✅ Plan updated successfully:', data);

    return NextResponse.json({
      success: true,
      data,
      message: 'Plan updated successfully',
    });
  } catch (error) {
    console.error('❌ Error updating plan:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update plan',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/plans/[id]
 * Partially update a subscription plan (e.g., toggle status)
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    
    const authResult = await checkAdminAuth();
    if (!authResult.success) {
      return createAdminAuthErrorResponse(authResult);
    }

    // Use service role to bypass RLS for admin operations
    const supabase = getServiceClient();
    const body = await request.json();

    const updateData: Record<string, unknown> = {};
    if (body.is_active !== undefined) updateData.is_active = body.is_active;
    if (body.is_popular !== undefined) updateData.is_popular = body.is_popular;
    
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('subscription_plans')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Plan not found' },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'Plan updated successfully',
    });
  } catch (error) {
    console.error('Error updating plan:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update plan',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/plans/[id]
 * Delete a subscription plan
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    
    const authResult = await checkAdminAuth();
    if (!authResult.success) {
      return createAdminAuthErrorResponse(authResult);
    }

    // Use service role to bypass RLS for admin operations
    const supabase = getServiceClient();

    // First, check if plan exists
    const { data: existingPlan, error: fetchError } = await supabase
      .from('subscription_plans')
      .select('id, name')
      .eq('id', id)
      .single();

    if (fetchError || !existingPlan) {
      return NextResponse.json(
        { success: false, error: 'Plan not found' },
        { status: 404 }
      );
    }

    // Delete plan_limits first (foreign key constraint)
    const { error: limitsError } = await supabase
      .from('plan_limits')
      .delete()
      .eq('plan_id', id);

    if (limitsError) {
      console.error('Warning: Failed to delete plan_limits:', limitsError);
    }

    // Delete the plan
    const { error } = await supabase
      .from('subscription_plans')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: `Plan "${existingPlan.name}" deleted successfully`,
    });
  } catch (error) {
    console.error('Error deleting plan:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete plan',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
