import { NextRequest, NextResponse } from 'next/server';
import { PlanManager } from '@/lib/services/plan-manager';

/**
 * GET /api/subscriptions/plans
 * Public endpoint to list all available subscription plans
 */
export async function GET(request: NextRequest) {
  try {
    const planManager = new PlanManager();
    const plans = await planManager.getAvailablePlans();

    return NextResponse.json({
      success: true,
      data: plans,
    });
  } catch (error) {
    console.error('Error fetching subscription plans:', error);
    
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