import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();

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
      // Return default statistics for users without organization
      return NextResponse.json({
        clients: { used: 0, limit: 10 },
        campaigns: { used: 0, limit: 100 },
        reports: { used: 0, limit: 50 },
        storage: { used: 0, limit: 1000 }
      });
    }

    // Return mock statistics for now
    const statistics = {
      clients: { used: 3, limit: 10 },
      campaigns: { used: 0, limit: 100 },
      reports: { used: 0, limit: 50 },
      storage: { used: 0, limit: 1000 }
    };

    return NextResponse.json(statistics);

  } catch (error) {
    console.error('Error getting usage statistics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}