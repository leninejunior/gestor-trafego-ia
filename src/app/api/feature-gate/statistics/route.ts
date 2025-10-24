import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { FeatureGateService } from '@/lib/services/feature-gate';

export async function GET() {
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

    // Get user's organization
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: 'Organization membership required' },
        { status: 403 }
      );
    }

    // Get usage statistics
    const statistics = await featureGate.getUsageStatistics(membership.organization_id);

    return NextResponse.json(statistics);

  } catch (error) {
    console.error('Error getting usage statistics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}