import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organization
    const { data: membership } = await supabase
      .from('organization_memberships')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'No active organization found' }, { status: 404 });
    }

    // Get notification preferences
    const { data: preferences, error } = await supabase
      .from('email_notification_preferences')
      .select('*')
      .eq('organization_id', membership.organization_id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching notification preferences:', error);
      return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 });
    }

    // Default preferences for all notification types
    const defaultPreferences = [
      { notification_type: 'subscription_confirmation', enabled: true },
      { notification_type: 'payment_failure', enabled: true },
      { notification_type: 'renewal_reminder', enabled: true },
      { notification_type: 'subscription_cancelled', enabled: true },
      { notification_type: 'plan_upgrade', enabled: true }
    ];

    // Merge with existing preferences
    const mergedPreferences = defaultPreferences.map(defaultPref => {
      const existingPref = preferences?.find((p: any) => p.notification_type === defaultPref.notification_type);
      return existingPref || {
        ...defaultPref,
        organization_id: membership.organization_id,
        user_id: user.id,
        email_address: null
      };
    });

    return NextResponse.json({
      success: true,
      preferences: mergedPreferences
    });

  } catch (error) {
    console.error('Error in GET /api/notifications/preferences:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organization
    const { data: membership } = await supabase
      .from('organization_memberships')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'No active organization found' }, { status: 404 });
    }

    const body = await request.json();
    const { preferences } = body;

    if (!Array.isArray(preferences)) {
      return NextResponse.json({ error: 'Invalid preferences format' }, { status: 400 });
    }

    // Update preferences
    const results = [];
    for (const pref of preferences) {
      const { notification_type, enabled, email_address } = pref;

      if (!notification_type || typeof enabled !== 'boolean') {
        continue;
      }

      const { data, error } = await supabase
        .from('email_notification_preferences')
        .upsert({
          organization_id: membership.organization_id,
          user_id: user.id,
          notification_type,
          enabled,
          email_address: email_address || null
        })
        .select()
        .single();

      if (error) {
        console.error(`Error updating preference for ${notification_type}:`, error);
        results.push({ notification_type, success: false, error: error.message });
      } else {
        results.push({ notification_type, success: true, data });
      }
    }

    return NextResponse.json({
      success: true,
      results
    });

  } catch (error) {
    console.error('Error in PUT /api/notifications/preferences:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}