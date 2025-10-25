import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PlanManager } from '@/lib/services/plan-manager';
import { UpdatePlanRequestSchema } from '@/lib/types/subscription-plans';
import { checkAdminAuth, createAdminAuthErrorResponse } from '@/lib/middleware/admin-auth-improved';

/**
 * Helper function to extract plan ID from params or URL
 */
async function extractPlanId(params: Promise<{ id?: string }>, request: NextRequest): Promise<string | null> {
  // Await params in Next.js 15
  const resolvedParams = await params;
  
  // Try to get from params first
  let planId = resolvedParams?.id;
  
  // Fallback: extract from URL if params.id is not available
  if (!planId) {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    planId = pathParts[pathParts.length - 1];
  }
  
  // Return null if invalid
  if (!planId || planId === '[id]') {
    return null;
  }
  
  return planId;
}

/**
 * PUT /api/admin/plans/[id]
 * Admin-only endpoint to update a subscription plan
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('🔍 PUT /api/admin/plans/[id] called');
    console.log('🔍 Request URL:', request.url);
    
    // Check authentication and admin role
    const authResult = await checkAdminAuth();
    if (!authResult.success) {
      return createAdminAuthErrorResponse(authResult);
    }

    // Extract plan ID (await params in Next.js 15)
    const planId = await extractPlanId(params, request);
    if (!planId) {
      console.error('❌ Plan ID is missing or invalid:', { params, url: request.url });
      return NextResponse.json(
        { success: false, error: 'Plan ID is required' },
        { status: 400 }
      );
    }
    
    console.log('✅ Plan ID found:', planId);

    // Parse and validate request body
    const body = await request.json();
    console.log('🔍 Request body:', JSON.stringify(body, null, 2));
    
    // Validate the data
    const validationResult = UpdatePlanRequestSchema.safeParse(body);
    if (!validationResult.success) {
      console.error('❌ Validation failed:', validationResult.error);
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }
    
    const validatedData = validationResult.data;
    console.log('✅ Data validated successfully:', JSON.stringify(validatedData, null, 2));

    // Update the plan
    const planManager = new PlanManager();
    const updatedPlan = await planManager.updatePlan(planId, validatedData);
    console.log('✅ Plan updated successfully');

    return NextResponse.json({
      success: true,
      data: updatedPlan,
      message: 'Subscription plan updated successfully',
    });
  } catch (error) {
    console.error('❌ Error updating subscription plan:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update subscription plan',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/plans/[id]
 * Admin-only endpoint to get a specific subscription plan
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication and admin role
    const authResult = await checkAdminAuth();
    if (!authResult.success) {
      return createAdminAuthErrorResponse(authResult);
    }

    // Extract plan ID (await params in Next.js 15)
    const planId = await extractPlanId(params, request);
    if (!planId) {
      return NextResponse.json(
        { success: false, error: 'Plan ID is required' },
        { status: 400 }
      );
    }

    // Get the plan
    const planManager = new PlanManager();
    const plan = await planManager.getPlanById(planId);

    if (!plan) {
      return NextResponse.json(
        { success: false, error: 'Plan not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: plan,
    });
  } catch (error) {
    console.error('Error fetching subscription plan:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch subscription plan',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/plans/[id]
 * Admin-only endpoint to delete a subscription plan
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication and admin role
    const authResult = await checkAdminAuth();
    if (!authResult.success) {
      return createAdminAuthErrorResponse(authResult);
    }
    
    const supabase = await createClient();

    // Extract plan ID (await params in Next.js 15)
    const planId = await extractPlanId(params, request);
    if (!planId) {
      return NextResponse.json(
        { success: false, error: 'Plan ID is required' },
        { status: 400 }
      );
    }

    // Check if plan has active subscriptions
    const { data: activeSubscriptions, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('plan_id', planId)
      .eq('status', 'active')
      .limit(1);

    if (subscriptionError) {
      throw new Error(`Failed to check active subscriptions: ${subscriptionError.message}`);
    }

    if (activeSubscriptions && activeSubscriptions.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Cannot delete plan with active subscriptions. Please cancel or migrate all active subscriptions first.' 
        },
        { status: 400 }
      );
    }

    // Delete the plan
    const { error: deleteError } = await supabase
      .from('subscription_plans')
      .delete()
      .eq('id', planId);

    if (deleteError) {
      throw new Error(`Failed to delete plan: ${deleteError.message}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Subscription plan deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting subscription plan:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete subscription plan',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}