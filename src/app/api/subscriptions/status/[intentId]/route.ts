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
 * GET /api/subscriptions/status/[intentId]
 * Get subscription intent status by ID
 * Requirements: 2.5, 5.3
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { intentId } = params;

    if (!intentId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Intent ID é obrigatório',
          code: 'MISSING_INTENT_ID',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    console.log('Getting subscription intent status:', intentId);
    const subscriptionIntentService = getSubscriptionIntentService();
    
    // Get intent with plan details
    const intent = await subscriptionIntentService.getIntent(intentId);
    
    // Get transition history for detailed status tracking
    const transitionHistory = await subscriptionIntentService.getTransitionHistory(intentId);
    
    // Calculate time remaining until expiration
    const expiresAt = new Date(intent.expires_at);
    const now = new Date();
    const timeRemaining = expiresAt.getTime() - now.getTime();
    const isExpired = timeRemaining <= 0;
    
    // Determine next possible actions based on current status
    const nextStates = subscriptionIntentService.getNextStates(intent.status);
    const isFinalState = subscriptionIntentService.isFinalState(intent.status);
    
    return NextResponse.json({
      success: true,
      intent_id: intent.id,
      status: intent.status,
      is_final: isFinalState,
      is_expired: isExpired,
      plan: {
        id: intent.plan.id,
        name: intent.plan.name,
        description: intent.plan.description,
        price: intent.billing_cycle === 'annual' 
          ? intent.plan.annual_price 
          : intent.plan.monthly_price,
        billing_cycle: intent.billing_cycle,
      },
      customer: {
        email: intent.user_email,
        name: intent.user_name,
        organization: intent.organization_name,
        phone: intent.phone,
        cpf_cnpj: intent.cpf_cnpj,
      },
      payment: {
        checkout_url: intent.checkout_url,
        iugu_customer_id: intent.iugu_customer_id,
        iugu_subscription_id: intent.iugu_subscription_id,
      },
      timeline: {
        created_at: intent.created_at,
        updated_at: intent.updated_at,
        expires_at: intent.expires_at,
        completed_at: intent.completed_at,
        time_remaining_ms: Math.max(0, timeRemaining),
        transitions: transitionHistory,
      },
      actions: {
        next_possible_states: nextStates,
        can_retry: intent.status === 'failed' && !isExpired,
        can_cancel: ['pending', 'processing'].includes(intent.status) && !isExpired,
        needs_payment: intent.status === 'pending' && !isExpired,
      },
      metadata: intent.metadata,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error getting subscription intent status:', error);

    if (error instanceof SubscriptionIntentNotFoundError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Intenção de assinatura não encontrada',
          code: 'INTENT_NOT_FOUND',
          intent_id: params.intentId,
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    if (error instanceof SubscriptionIntentError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Erro ao consultar status da assinatura',
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
        error: 'Falha ao consultar status',
        details: errorMessage,
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}