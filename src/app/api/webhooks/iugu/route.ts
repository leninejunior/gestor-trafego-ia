import { NextRequest, NextResponse } from 'next/server';
import { getWebhookProcessor } from '@/lib/webhooks/webhook-processor';
import { WebhookEvent } from '@/lib/types/webhook';

/**
 * Webhook do Iugu para processar eventos de pagamento
 * 
 * Usa o novo WebhookProcessor robusto com retry logic, validação,
 * deduplicação e error handling completo.
 * 
 * Eventos suportados:
 * - invoice.status_changed: Mudança de status de fatura
 * - subscription.suspended: Assinatura suspensa
 * - subscription.activated: Assinatura ativada
 * - subscription.expired: Assinatura expirada
 * - subscription.canceled: Assinatura cancelada
 * - customer.created: Cliente criado
 */

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Get raw body for signature validation
    const rawBody = await request.text();
    const body = JSON.parse(rawBody);
    
    // Extract headers for signature validation
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    console.log('[Webhook] Iugu webhook received:', {
      event: body.event,
      id: body.data?.id,
      timestamp: new Date().toISOString(),
    });

    // Transform Iugu webhook format to our internal format
    const webhookEvent: WebhookEvent = {
      id: body.data?.id || `iugu_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: body.event as any,
      data: body.data || {},
      created_at: new Date().toISOString(),
      source: 'iugu',
      version: '1.0',
      metadata: {
        original_event: body.event,
        received_at: new Date().toISOString(),
        user_agent: headers['user-agent'],
        ip_address: headers['x-forwarded-for'] || headers['x-real-ip'],
      },
    };

    // Get webhook processor instance
    const processor = getWebhookProcessor();

    // Process event with retry logic
    const result = await processor.processEventWithRetry(webhookEvent);

    const processingTime = Date.now() - startTime;

    if (result.success) {
      console.log('[Webhook] Event processed successfully:', {
        eventId: webhookEvent.id,
        eventType: webhookEvent.type,
        processingTime,
        status: result.status,
      });

      return NextResponse.json({
        received: true,
        processed: true,
        event_id: webhookEvent.id,
        processing_time: processingTime,
        status: result.status,
      });
    } else {
      console.error('[Webhook] Event processing failed:', {
        eventId: webhookEvent.id,
        eventType: webhookEvent.type,
        processingTime,
        error: result.message,
        retryable: result.retryable,
      });

      // Return 200 for non-retryable errors to prevent webhook retries
      // Return 500 for retryable errors to trigger webhook provider retries
      const statusCode = result.retryable ? 500 : 200;

      return NextResponse.json({
        received: true,
        processed: false,
        event_id: webhookEvent.id,
        processing_time: processingTime,
        error: result.message,
        retryable: result.retryable,
      }, { status: statusCode });
    }

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    console.error('[Webhook] Unexpected error processing webhook:', {
      error: (error as Error).message,
      stack: (error as Error).stack,
      processingTime,
    });

    return NextResponse.json({
      received: true,
      processed: false,
      error: 'Internal server error',
      processing_time: processingTime,
    }, { status: 500 });
  }
}


