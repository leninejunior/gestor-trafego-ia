import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { FeatureGateService } from '@/lib/services/feature-gate';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const featureGate = new FeatureGateService();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get request body
    const { feature } = await request.json();

    if (!feature) {
      return NextResponse.json(
        { error: 'Feature parameter is required' },
        { status: 400 }
      );
    }

    // Default usage for when tables don't exist
    let usage = {
      withinLimit: true,
      feature,
      currentUsage: 0,
      limit: 1000,
      remaining: 1000
    };

    try {
      // Get user's organization
      const { data: membership, error: membershipError } = await supabase
        .from('memberships')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (!membershipError && membership) {
        // Check usage limit
        usage = await featureGate.checkUsageLimit(membership.organization_id, feature);
      }
    } catch (dbError) {
      console.log('Database tables not ready, returning default usage');
      // Return default usage if tables don't exist
    }

    return NextResponse.json({
      success: true,
      data: usage
    });

  } catch (error) {
    console.error('Error checking usage limit:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}