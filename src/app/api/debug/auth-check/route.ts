import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      return NextResponse.json({
        status: 'error',
        message: 'Failed to get user',
        error: userError.message,
      }, { status: 401 });
    }

    if (!user) {
      return NextResponse.json({
        status: 'not_authenticated',
        message: 'No user session found. Please login first.',
        userId: null,
      }, { status: 401 });
    }

    // Get user's memberships
    const { data: memberships, error: membershipError } = await supabase
      .from('memberships')
      .select('*')
      .eq('user_id', user.id);

    if (membershipError) {
      return NextResponse.json({
        status: 'error',
        message: 'Failed to fetch memberships',
        error: membershipError.message,
      }, { status: 500 });
    }

    // Get user's clients
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('*');

    if (clientError) {
      return NextResponse.json({
        status: 'error',
        message: 'Failed to fetch clients',
        error: clientError.message,
      }, { status: 500 });
    }

    // Get Google Ads connections (with RLS applied)
    const { data: connections, error: connError } = await supabase
      .from('google_ads_connections')
      .select('*');

    if (connError) {
      return NextResponse.json({
        status: 'error',
        message: 'Failed to fetch Google Ads connections',
        error: connError.message,
      }, { status: 500 });
    }

    return NextResponse.json({
      status: 'authenticated',
      user: {
        id: user.id,
        email: user.email,
      },
      memberships: memberships?.length || 0,
      clients: clients?.length || 0,
      googleAdsConnections: connections?.length || 0,
      details: {
        memberships,
        clients,
        connections,
      },
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
