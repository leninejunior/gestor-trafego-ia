/**
 * Google Ads Monitoring Alerts API
 * 
 * Manages alerts for Google Ads integration issues
 * Requirements: 10.3, 10.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { googleAdsMonitoring } from '@/lib/google/monitoring';
import { googleAdsLogger } from '@/lib/google/logger';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isActive = searchParams.get('active') !== 'false'; // Default to active alerts
    const severity = searchParams.get('severity') as 'low' | 'medium' | 'high' | 'critical' | null;
    const alertType = searchParams.get('type') as string | null;
    const limit = parseInt(searchParams.get('limit') || '50');

    // Verify authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    googleAdsLogger.info('Alerts request started', {
      userId: user.id,
      operation: 'alerts_api',
      metadata: { isActive, severity, alertType, limit }
    });

    // Build query
    let query = supabase
      .from('google_ads_alerts')
      .select('*')
      .eq('is_active', isActive)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (severity) {
      query = query.eq('severity', severity);
    }

    if (alertType) {
      query = query.eq('alert_type', alertType);
    }

    const { data: alerts, error } = await query;

    if (error) {
      throw error;
    }

    googleAdsLogger.info('Alerts request completed', {
      userId: user.id,
      operation: 'alerts_api',
      metadata: { 
        alertsReturned: alerts?.length || 0,
        filters: { isActive, severity, alertType }
      }
    });

    return NextResponse.json({
      alerts: alerts || [],
      total: alerts?.length || 0,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    googleAdsLogger.error('Failed to get alerts', error as Error, {
      operation: 'alerts_api'
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    googleAdsLogger.info('Manual alert check started', {
      userId: user.id,
      operation: 'alerts_api',
      metadata: { trigger: 'manual' }
    });

    // Check for new alerts
    const alerts = await googleAdsMonitoring.checkAlerts();

    googleAdsLogger.info('Manual alert check completed', {
      userId: user.id,
      operation: 'alerts_api',
      metadata: { 
        alertsGenerated: alerts.length,
        alertTypes: alerts.map(a => a.type)
      }
    });

    return NextResponse.json({
      success: true,
      alerts,
      alertsGenerated: alerts.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    googleAdsLogger.error('Failed to check alerts manually', error as Error, {
      operation: 'alerts_api'
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Verify authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { alertId, action, resolutionNotes } = body;

    if (!alertId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: alertId, action' },
        { status: 400 }
      );
    }

    googleAdsLogger.info('Alert action started', {
      userId: user.id,
      operation: 'alerts_api',
      metadata: { alertId, action, hasNotes: !!resolutionNotes }
    });

    let updateData: any = {};

    switch (action) {
      case 'resolve':
        updateData = {
          is_active: false,
          resolved_at: new Date().toISOString(),
          resolved_by: user.id,
          resolution_notes: resolutionNotes || null
        };
        break;
      
      case 'reactivate':
        updateData = {
          is_active: true,
          resolved_at: null,
          resolved_by: null,
          resolution_notes: null
        };
        break;
      
      default:
        return NextResponse.json(
          { error: 'Invalid action. Use "resolve" or "reactivate"' },
          { status: 400 }
        );
    }

    const { data: updatedAlert, error } = await supabase
      .from('google_ads_alerts')
      .update(updateData)
      .eq('id', alertId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    googleAdsLogger.info('Alert action completed', {
      userId: user.id,
      operation: 'alerts_api',
      metadata: { 
        alertId, 
        action, 
        success: true,
        newStatus: updatedAlert.is_active ? 'active' : 'resolved'
      }
    });

    return NextResponse.json({
      success: true,
      alert: updatedAlert,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    googleAdsLogger.error('Failed to update alert', error as Error, {
      operation: 'alerts_api'
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}