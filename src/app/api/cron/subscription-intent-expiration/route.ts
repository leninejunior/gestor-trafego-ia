/**
 * Subscription Intent Expiration Cron Job API
 * 
 * Handles automated expiration processing, warnings, and cleanup.
 * This endpoint should be called by a cron service (e.g., Vercel Cron, GitHub Actions).
 * 
 * Requirements: 5.1, 6.3
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSubscriptionIntentExpirationService } from '@/lib/services/subscription-intent-expiration-service';

// =============================================
// CRON JOB HANDLER
// =============================================

export async function POST(request: NextRequest) {
  try {
    // Verify cron authorization (in production, use proper auth)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get job type from query params or body
    const url = new URL(request.url);
    const jobType = url.searchParams.get('type') || 'all';

    const expirationService = getSubscriptionIntentExpirationService();
    const results: any = {};

    // Execute requested job types
    switch (jobType) {
      case 'expire':
        results.expiration = await expirationService.processExpiredIntents();
        break;

      case 'warning':
        results.warnings = await expirationService.processExpirationWarnings();
        break;

      case 'cleanup':
        results.cleanup = await expirationService.processExpiredIntentCleanup();
        break;

      case 'all':
      default:
        // Run all jobs in sequence
        results.warnings = await expirationService.processExpirationWarnings();
        results.expiration = await expirationService.processExpiredIntents();
        results.cleanup = await expirationService.processExpiredIntentCleanup();
        break;
    }

    // Get metrics after processing
    const metrics = await expirationService.getExpirationMetrics();

    return NextResponse.json({
      success: true,
      job_type: jobType,
      results,
      metrics,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Subscription intent expiration cron job failed:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// =============================================
// GET HANDLER FOR STATUS/METRICS
// =============================================

export async function GET(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const expirationService = getSubscriptionIntentExpirationService();
    
    // Get current metrics
    const metrics = await expirationService.getExpirationMetrics();
    const config = expirationService.getConfig();

    return NextResponse.json({
      success: true,
      metrics,
      config,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Failed to get expiration metrics:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}