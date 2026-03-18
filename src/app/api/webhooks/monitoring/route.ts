/**
 * Webhook Monitoring API
 * 
 * Provides monitoring and management endpoints for webhook processing,
 * including circuit breaker status and dead letter queue management.
 * 
 * Requirements: 4.2, 8.1, 8.4
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWebhookProcessor } from '@/lib/webhooks/webhook-processor';
import { getCircuitBreakerManager } from '@/lib/webhooks/circuit-breaker';

/**
 * GET /api/webhooks/monitoring
 * Get webhook processing monitoring data
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    const processor = getWebhookProcessor();
    const circuitBreakerManager = getCircuitBreakerManager();

    switch (action) {
      case 'status':
        return NextResponse.json({
          success: true,
          data: {
            processor_metrics: processor.getMetrics(),
            circuit_breaker_status: processor.getCircuitBreakerStatus(),
            circuit_breaker_health: circuitBreakerManager.getHealthStatus(),
            dead_letter_queue_stats: await processor.getDeadLetterQueueStats(),
          },
        });

      case 'circuit-breaker':
        return NextResponse.json({
          success: true,
          data: {
            status: processor.getCircuitBreakerStatus(),
            all_services: circuitBreakerManager.getAllMetrics(),
            health: circuitBreakerManager.getHealthStatus(),
          },
        });

      case 'dead-letter-queue':
        return NextResponse.json({
          success: true,
          data: await processor.getDeadLetterQueueStats(),
        });

      case 'metrics':
        return NextResponse.json({
          success: true,
          data: processor.getMetrics(),
        });

      default:
        // Return comprehensive monitoring data
        return NextResponse.json({
          success: true,
          data: {
            processor_metrics: processor.getMetrics(),
            circuit_breaker: {
              status: processor.getCircuitBreakerStatus(),
              all_services: circuitBreakerManager.getAllMetrics(),
              health: circuitBreakerManager.getHealthStatus(),
            },
            dead_letter_queue: await processor.getDeadLetterQueueStats(),
            timestamp: new Date().toISOString(),
          },
        });
    }
  } catch (error) {
    console.error('[WebhookMonitoring] Error getting monitoring data:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get monitoring data',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/webhooks/monitoring
 * Perform monitoring actions (reset, cleanup, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    const processor = getWebhookProcessor();
    const circuitBreakerManager = getCircuitBreakerManager();

    switch (action) {
      case 'reset-metrics':
        processor.resetMetrics();
        return NextResponse.json({
          success: true,
          message: 'Processor metrics reset successfully',
        });

      case 'reset-circuit-breaker':
        processor.resetCircuitBreaker();
        return NextResponse.json({
          success: true,
          message: 'Circuit breaker reset successfully',
        });

      case 'reset-all-circuit-breakers':
        circuitBreakerManager.resetAll();
        return NextResponse.json({
          success: true,
          message: 'All circuit breakers reset successfully',
        });

      case 'force-open-circuit-breaker':
        processor.forceOpenCircuitBreaker();
        return NextResponse.json({
          success: true,
          message: 'Circuit breaker forced open',
        });

      case 'process-dead-letter-queue':
        const batchSize = params.batchSize || 10;
        const result = await processor.processDeadLetterQueue(batchSize);
        return NextResponse.json({
          success: true,
          message: 'Dead letter queue processed',
          data: result,
        });

      case 'cleanup-dead-letter-queue':
        const olderThanDays = params.olderThanDays || 30;
        const deletedCount = await processor.cleanupDeadLetterQueue(olderThanDays);
        return NextResponse.json({
          success: true,
          message: `Cleaned up ${deletedCount} old dead letter queue items`,
          data: { deletedCount },
        });

      default:
        return NextResponse.json(
          {
            success: false,
            error: 'Unknown action',
            availableActions: [
              'reset-metrics',
              'reset-circuit-breaker',
              'reset-all-circuit-breakers',
              'force-open-circuit-breaker',
              'process-dead-letter-queue',
              'cleanup-dead-letter-queue',
            ],
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[WebhookMonitoring] Error performing action:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to perform monitoring action',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}