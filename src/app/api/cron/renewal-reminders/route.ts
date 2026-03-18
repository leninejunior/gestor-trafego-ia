import { NextRequest, NextResponse } from 'next/server';
import { SubscriptionNotificationIntegration } from '@/lib/services/subscription-notification-integration';

/**
 * Cron job endpoint for processing renewal reminders
 * This should be called daily to send renewal reminders for subscriptions expiring in 3 days
 */
export async function POST(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Starting renewal reminders processing...');
    
    const notificationIntegration = new SubscriptionNotificationIntegration();
    const result = await notificationIntegration.processRenewalReminders();

    console.log('Renewal reminders processing completed:', result);

    return NextResponse.json({
      success: true,
      message: 'Renewal reminders processed successfully',
      stats: {
        processed: result.processed,
        sent: result.sent,
        failed: result.errors.length,
        errors: result.errors
      }
    });

  } catch (error) {
    console.error('Error processing renewal reminders:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to process renewal reminders',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Allow GET for testing purposes (remove in production)
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Method not allowed in production' }, { status: 405 });
  }

  return POST(request);
}