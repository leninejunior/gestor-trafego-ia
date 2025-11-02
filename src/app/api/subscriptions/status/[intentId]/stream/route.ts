import { NextRequest, NextResponse } from 'next/server';
import { getSubscriptionIntentService } from '@/lib/services/subscription-intent-service';
import { 
  SubscriptionIntentError,
  SubscriptionIntentNotFoundError,
} from '@/lib/types/subscription-intent';

interface RouteParams {
  params: {
    intentId: string;
  };
}

/**
 * GET /api/subscriptions/status/[intentId]/stream
 * Server-Sent Events endpoint for real-time status updates
 * Requirements: 2.5, 5.3
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const { intentId } = params;

  if (!intentId) {
    return NextResponse.json(
      {
        success: false,
        error: 'Intent ID é obrigatório',
        code: 'MISSING_INTENT_ID',
      },
      { status: 400 }
    );
  }

  try {
    const subscriptionIntentService = getSubscriptionIntentService();
    
    // Verify intent exists before starting stream
    await subscriptionIntentService.getIntent(intentId);
    
    console.log('Starting SSE stream for intent:', intentId);

    // Create readable stream for SSE
    const stream = new ReadableStream({
      start(controller) {
        // Send initial connection message
        const initialMessage = `data: ${JSON.stringify({
          type: 'connected',
          intent_id: intentId,
          timestamp: new Date().toISOString(),
          message: 'Conectado ao stream de status',
        })}\n\n`;
        
        controller.enqueue(new TextEncoder().encode(initialMessage));

        // Set up polling interval to check for status changes
        let lastStatus = '';
        let lastUpdated = '';
        
        const pollInterval = setInterval(async () => {
          try {
            const intent = await subscriptionIntentService.getIntent(intentId);
            
            // Check if status or update time changed
            if (intent.status !== lastStatus || intent.updated_at !== lastUpdated) {
              lastStatus = intent.status;
              lastUpdated = intent.updated_at;
              
              // Calculate time remaining
              const expiresAt = new Date(intent.expires_at);
              const now = new Date();
              const timeRemaining = expiresAt.getTime() - now.getTime();
              const isExpired = timeRemaining <= 0;
              
              const statusUpdate = {
                type: 'status_update',
                intent_id: intentId,
                status: intent.status,
                is_final: subscriptionIntentService.isFinalState(intent.status),
                is_expired: isExpired,
                updated_at: intent.updated_at,
                time_remaining_ms: Math.max(0, timeRemaining),
                timestamp: new Date().toISOString(),
              };
              
              const message = `data: ${JSON.stringify(statusUpdate)}\n\n`;
              controller.enqueue(new TextEncoder().encode(message));
              
              // Close stream if final state reached
              if (subscriptionIntentService.isFinalState(intent.status) || isExpired) {
                const finalMessage = `data: ${JSON.stringify({
                  type: 'stream_complete',
                  intent_id: intentId,
                  final_status: intent.status,
                  reason: isExpired ? 'expired' : 'completed',
                  timestamp: new Date().toISOString(),
                })}\n\n`;
                
                controller.enqueue(new TextEncoder().encode(finalMessage));
                clearInterval(pollInterval);
                controller.close();
              }
            }
          } catch (error) {
            console.error('Error in SSE polling:', error);
            
            const errorMessage = `data: ${JSON.stringify({
              type: 'error',
              intent_id: intentId,
              error: 'Erro ao consultar status',
              timestamp: new Date().toISOString(),
            })}\n\n`;
            
            controller.enqueue(new TextEncoder().encode(errorMessage));
            clearInterval(pollInterval);
            controller.close();
          }
        }, 2000); // Poll every 2 seconds

        // Send heartbeat every 30 seconds to keep connection alive
        const heartbeatInterval = setInterval(() => {
          const heartbeat = `data: ${JSON.stringify({
            type: 'heartbeat',
            intent_id: intentId,
            timestamp: new Date().toISOString(),
          })}\n\n`;
          
          controller.enqueue(new TextEncoder().encode(heartbeat));
        }, 30000);

        // Cleanup on stream close
        const cleanup = () => {
          clearInterval(pollInterval);
          clearInterval(heartbeatInterval);
          console.log('SSE stream closed for intent:', intentId);
        };

        // Handle client disconnect
        request.signal.addEventListener('abort', cleanup);
        
        // Auto-close after 10 minutes to prevent resource leaks
        setTimeout(() => {
          const timeoutMessage = `data: ${JSON.stringify({
            type: 'timeout',
            intent_id: intentId,
            message: 'Stream encerrado por timeout',
            timestamp: new Date().toISOString(),
          })}\n\n`;
          
          controller.enqueue(new TextEncoder().encode(timeoutMessage));
          cleanup();
          controller.close();
        }, 10 * 60 * 1000); // 10 minutes
      },
    });

    // Return SSE response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Cache-Control',
      },
    });

  } catch (error) {
    console.error('Error starting SSE stream:', error);

    if (error instanceof SubscriptionIntentNotFoundError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Intenção de assinatura não encontrada',
          code: 'INTENT_NOT_FOUND',
          intent_id: intentId,
        },
        { status: 404 }
      );
    }

    if (error instanceof SubscriptionIntentError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Erro ao iniciar stream de status',
          details: error.message,
          code: error.code,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Falha ao iniciar stream',
        details: error instanceof Error ? error.message : 'Erro interno',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}