import { NextRequest, NextResponse } from 'next/server';
import { getSubscriptionIntentService } from '@/lib/services/subscription-intent-service';
import { 
  SubscriptionIntentError,
  SubscriptionIntentNotFoundError,
} from '@/lib/types/subscription-intent';
import { z } from 'zod';

// Validation schema for cancel request
const cancelSchema = z.object({
  intent_id: z.string().uuid('Intent ID deve ser um UUID válido'),
  reason: z.string().min(1, 'Motivo do cancelamento é obrigatório').max(500, 'Motivo deve ter no máximo 500 caracteres'),
  cancel_type: z.enum(['user_request', 'admin_action', 'system_timeout']).optional().default('user_request'),
});

/**
 * POST /api/subscriptions/recovery/cancel
 * Cancel subscription intent
 * Requirements: 5.1, 5.2
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Parse and validate request body
    const body = await request.json();
    const validationResult = cancelSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Dados de entrada inválidos',
          details: validationResult.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
          })),
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const { intent_id, reason, cancel_type } = validationResult.data;
    
    console.log('Canceling subscription intent:', intent_id, 'reason:', reason);
    const subscriptionIntentService = getSubscriptionIntentService();
    
    // Get current intent
    const intent = await subscriptionIntentService.getIntent(intent_id);
    
    // Check if intent can be canceled
    if (intent.status === 'completed') {
      return NextResponse.json(
        {
          success: false,
          error: 'Assinatura já foi completada',
          message: 'Esta assinatura já foi paga e ativada. Não é possível cancelar.',
          code: 'ALREADY_COMPLETED',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    if (intent.status === 'expired') {
      return NextResponse.json(
        {
          success: false,
          error: 'Assinatura já expirada',
          message: 'Esta assinatura já expirou automaticamente.',
          code: 'ALREADY_EXPIRED',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Determine if this is a valid cancellation state
    const validCancelStates = ['pending', 'processing', 'failed'];
    if (!validCancelStates.includes(intent.status)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Status inválido para cancelamento',
          message: `Não é possível cancelar assinatura com status: ${intent.status}`,
          code: 'INVALID_STATUS_FOR_CANCEL',
          current_status: intent.status,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Prepare cancellation metadata
    const cancellationData = {
      canceled_at: new Date().toISOString(),
      cancellation_reason: reason,
      cancellation_type: cancel_type,
      canceled_by: 'api_request',
      previous_status: intent.status,
      processing_time_ms: Date.now() - startTime,
    };

    // Execute state transition to expired (which serves as canceled)
    await subscriptionIntentService.executeStateTransition(
      intent_id,
      'expired',
      {
        reason: `Canceled: ${reason}`,
        triggeredBy: 'recovery_api',
        metadata: {
          ...intent.metadata,
          cancellation: cancellationData,
        },
      }
    );

    // TODO: If there's an active Iugu subscription or invoice, cancel it here
    // This would require integration with Iugu's cancellation API
    if (intent.iugu_subscription_id) {
      console.log('TODO: Cancel Iugu subscription:', intent.iugu_subscription_id);
      // await iuguService.cancelSubscription(intent.iugu_subscription_id);
    }

    // TODO: Send cancellation confirmation email
    console.log('TODO: Send cancellation email to:', intent.user_email);

    console.log('Subscription intent canceled successfully in', Date.now() - startTime, 'ms');

    return NextResponse.json({
      success: true,
      intent_id: intent_id,
      status: 'expired', // Using expired as canceled status
      cancellation: {
        canceled_at: cancellationData.canceled_at,
        reason: reason,
        type: cancel_type,
        previous_status: intent.status,
      },
      plan: {
        id: intent.plan.id,
        name: intent.plan.name,
        price: intent.billing_cycle === 'annual' 
          ? intent.plan.annual_price 
          : intent.plan.monthly_price,
        billing_cycle: intent.billing_cycle,
      },
      customer: {
        email: intent.user_email,
        name: intent.user_name,
        organization: intent.organization_name,
      },
      refund_info: {
        eligible: intent.status === 'processing', // Only processing payments might be refundable
        message: intent.status === 'processing' 
          ? 'Se o pagamento foi processado, entre em contato para solicitar reembolso.'
          : 'Nenhum pagamento foi processado, não há necessidade de reembolso.',
      },
      metadata: {
        processing_time_ms: Date.now() - startTime,
        canceled_at: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('Error canceling subscription intent:', error);

    if (error instanceof SubscriptionIntentNotFoundError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Intenção de assinatura não encontrada',
          code: 'INTENT_NOT_FOUND',
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    if (error instanceof SubscriptionIntentError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Erro ao cancelar assinatura',
          details: error.message,
          code: error.code,
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';
    
    return NextResponse.json(
      {
        success: false,
        error: 'Falha ao cancelar assinatura',
        details: errorMessage,
        code: 'INTERNAL_ERROR',
        metadata: {
          processing_time_ms: processingTime,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}