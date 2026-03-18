import { NextRequest, NextResponse } from 'next/server';
import { getSubscriptionIntentService } from '@/lib/services/subscription-intent-service';
import { 
  SubscriptionIntentError,
} from '@/lib/types/subscription-intent';
import { z } from 'zod';

// Validation schema for public status query
const publicStatusSchema = z.object({
  email: z.string().email('Email deve ter formato válido').toLowerCase(),
  cpf_cnpj: z.string().optional().refine(
    (val) => !val || /^[\d]{11}$|^[\d]{14}$/.test(val.replace(/\D/g, '')),
    'CPF deve ter 11 dígitos ou CNPJ deve ter 14 dígitos'
  ),
});

/**
 * POST /api/subscriptions/status/public
 * Get subscription intent status by email and optional CPF/CNPJ
 * This is a public endpoint for customers to check their payment status
 * Requirements: 2.5, 5.3
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validationResult = publicStatusSchema.safeParse(body);
    
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

    const { email, cpf_cnpj } = validationResult.data;
    
    console.log('Public status query for email:', email);
    const subscriptionIntentService = getSubscriptionIntentService();
    
    // Get intent by email and optional CPF
    const intent = await subscriptionIntentService.getIntentByIdentifier(
      email,
      cpf_cnpj?.replace(/\D/g, '')
    );
    
    if (!intent) {
      return NextResponse.json(
        {
          success: false,
          error: 'Nenhuma assinatura encontrada',
          message: 'Não encontramos nenhuma assinatura com os dados informados.',
          code: 'NO_SUBSCRIPTION_FOUND',
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }
    
    // Calculate time remaining until expiration
    const expiresAt = new Date(intent.expires_at);
    const now = new Date();
    const timeRemaining = expiresAt.getTime() - now.getTime();
    const isExpired = timeRemaining <= 0;
    
    // Determine status message for customer
    let statusMessage = '';
    let actionRequired = '';
    
    switch (intent.status) {
      case 'pending':
        if (isExpired) {
          statusMessage = 'Sua solicitação de assinatura expirou.';
          actionRequired = 'Você pode solicitar uma nova cobrança ou entrar em contato conosco.';
        } else {
          statusMessage = 'Aguardando pagamento.';
          actionRequired = 'Complete o pagamento através do link enviado por email.';
        }
        break;
      case 'processing':
        statusMessage = 'Processando pagamento.';
        actionRequired = 'Aguarde a confirmação do pagamento.';
        break;
      case 'completed':
        statusMessage = 'Pagamento confirmado! Sua assinatura está ativa.';
        actionRequired = 'Você pode acessar sua conta e começar a usar nossos serviços.';
        break;
      case 'failed':
        statusMessage = 'Falha no pagamento.';
        actionRequired = 'Verifique os dados do cartão e tente novamente, ou entre em contato conosco.';
        break;
      case 'expired':
        statusMessage = 'Solicitação de assinatura expirada.';
        actionRequired = 'Faça uma nova solicitação de assinatura.';
        break;
    }
    
    // Return limited information for public access (no sensitive data)
    return NextResponse.json({
      success: true,
      subscription: {
        id: intent.id,
        status: intent.status,
        status_message: statusMessage,
        action_required: actionRequired,
        is_expired: isExpired,
        plan: {
          name: intent.plan.name,
          billing_cycle: intent.billing_cycle,
          price: intent.billing_cycle === 'annual' 
            ? intent.plan.annual_price 
            : intent.plan.monthly_price,
        },
        customer: {
          name: intent.user_name,
          organization: intent.organization_name,
        },
        timeline: {
          created_at: intent.created_at,
          expires_at: intent.expires_at,
          completed_at: intent.completed_at,
          time_remaining_ms: Math.max(0, timeRemaining),
        },
        actions: {
          can_retry: intent.status === 'failed' && !isExpired,
          needs_payment: intent.status === 'pending' && !isExpired,
          has_checkout_url: !!intent.checkout_url && intent.status === 'pending' && !isExpired,
        },
      },
      support: {
        email: 'suporte@exemplo.com',
        phone: '+55 11 99999-9999',
        message: 'Entre em contato conosco se precisar de ajuda.',
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error in public status query:', error);

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

/**
 * GET /api/subscriptions/status/public
 * Return information about how to use this endpoint
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/subscriptions/status/public',
    method: 'POST',
    description: 'Consulte o status da sua assinatura usando email e CPF/CNPJ',
    required_fields: {
      email: 'string (formato de email válido)',
    },
    optional_fields: {
      cpf_cnpj: 'string (11 dígitos para CPF ou 14 para CNPJ)',
    },
    example_request: {
      email: 'cliente@exemplo.com',
      cpf_cnpj: '12345678901',
    },
    response_fields: {
      success: 'boolean',
      subscription: {
        id: 'string',
        status: 'pending | processing | completed | failed | expired',
        status_message: 'string',
        action_required: 'string',
        plan: 'object',
        timeline: 'object',
        actions: 'object',
      },
    },
    timestamp: new Date().toISOString(),
  });
}