/**
 * Dead Letter Queue Processor Cron Job
 * 
 * Automatically processes retryable items from the webhook dead letter queue
 * and cleans up old items to prevent unbounded growth.
 * 
 * Requirements: 4.2, 8.1, 8.4
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWebhookProcessor } from '@/lib/webhooks/webhook-processor';

/**
 * POST /api/cron/webhook-dlq-processor
 * Process dead letter queue items and cleanup old entries
 */
export async function POST(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const processor = getWebhookProcessor();
    const startTime = Date.now();
    
    console.log('[WebhookDLQProcessor] Starting dead letter queue processing...');

    // Get current DLQ stats
    const initialStats = await processor.getDeadLetterQueueStats();
    console.log('[WebhookDLQProcessor] Initial DLQ stats:', initialStats);

    // Process retryable items (batch of 20)
    const processResult = await processor.processDeadLetterQueue(20);
    console.log('[WebhookDLQProcessor] Process result:', processResult);

    // Cleanup old items (older than 30 days)
    const cleanupResult = await processor.cleanupDeadLetterQueue(30);
    console.log('[WebhookDLQProcessor] Cleanup result:', cleanupResult);

    // Get final stats
    const finalStats = await processor.getDeadLetterQueueStats();
    console.log('[WebhookDLQProcessor] Final DLQ stats:', finalStats);

    const processingTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: 'Dead letter queue processing completed',
      data: {
        processing_time_ms: processingTime,
        initial_stats: initialStats,
        final_stats: finalStats,
        process_result: processResult,
        cleanup_result: {
          deleted_count: cleanupResult,
        },
        summary: {
          items_processed: processResult.processed,
          items_failed: processResult.failed,
          items_skipped: processResult.skipped,
          old_items_cleaned: cleanupResult,
          queue_size_change: initialStats.total - finalStats.total,
        },
      },
    });

  } catch (error) {
    console.error('[WebhookDLQProcessor] Error processing dead letter queue:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process dead letter queue',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/webhook-dlq-processor
 * Get information about the DLQ processor
 */
export async function GET() {
  try {
    const processor = getWebhookProcessor();
    const stats = await processor.getDeadLetterQueueStats();
    const circuitBreakerStatus = processor.getCircuitBreakerStatus();

    return NextResponse.json({
      success: true,
      data: {
        dead_letter_queue_stats: stats,
        circuit_breaker_status: circuitBreakerStatus,
        processor_metrics: processor.getMetrics(),
        last_check: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('[WebhookDLQProcessor] Error getting DLQ info:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get DLQ processor info',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}