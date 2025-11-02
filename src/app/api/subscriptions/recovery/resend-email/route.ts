import { NextRequest, NextResponse } from 'next/server';
import { getSubscriptionIntentService } from '@/lib/services/subscription-intent-service';
import { 
  SubscriptionIntentError,
  SubscriptionIntentNotFoundError,
} from '@/lib/types/subscription-intent';
import { z } from 'zod';

// Validation schema for resend email request
const resendEmailSchema = z.object({
  intent_id: z.string().uuid('Intent ID deve ser um UUID válido'),
  email_type: z.enum(['checkout', 'confirmation', 'reminder']).optional().default('checkout'),
  reason: z.string().optional(),
});

/**
 * POST /api/subscriptions/recovery/resend-email
 * Resend confirmation email for subscription intent
 * Requirements: 5.1, 5.2
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Parse and validate request body
    const body = await request.json();
    const validationResult = resendEmailSchema.safeParse(body);
    
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

    const { intent_id, email_type, reason } = validationResult.data;
    
    console.log('Resending email for intent:', intent_id, 'type:', email_type);
    const subscriptionIntentService = getSubscriptionIntentService();
    
    // Get current intent
    const intent = await subscriptionIntentService.getIntent(intent_id);
    
    // Check if intent exists and is in valid state for email resend
    if (intent.status === 'expired') {
      return NextResponse.json(
        {
          success: false,
          error: 'Assinatura expirada',
          message: 'Esta assinatura expirou. Gere uma nova cobrança antes de reenviar o email.',
          code: 'INTENT_EXPIRED',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Determine email content based on type and status
    let emailSubject = '';
    let emailContent = '';
    let shouldIncludeCheckoutUrl = false;

    switch (email_type) {
      case 'checkout':
        emailSubject = `Complete sua assinatura - ${intent.plan.name}`;
        emailContent = `
          Olá ${intent.user_name},
          
          Sua assinatura do plano ${intent.plan.name} está aguardando pagamento.
          
          Complete o pagamento através do link abaixo:
          ${intent.checkout_url || 'Link será enviado em breve'}
          
          Detalhes da assinatura:
          - Plano: ${intent.plan.name}
          - Valor: R$ ${intent.billing_cycle === 'annual' ? intent.plan.annual_price : intent.plan.monthly_price}
          - Ciclo: ${intent.billing_cycle === 'annual' ? 'Anual' : 'Mensal'}
          - Organização: ${intent.organization_name}
          
          Este link expira em: ${new Date(intent.expires_at).toLocaleString('pt-BR')}
          
          Se você tiver dúvidas, entre em contato conosco.
          
          Atenciosamente,
          Equipe de Suporte
        `;
        shouldIncludeCheckoutUrl = true;
        break;

      case 'confirmation':
        if (intent.status !== 'completed') {
          return NextResponse.json(
            {
              success: false,
              error: 'Pagamento não confirmado',
              message: 'Só é possível reenviar email de confirmação para assinaturas pagas.',
              code: 'NOT_COMPLETED',
              timestamp: new Date().toISOString(),
            },
            { status: 400 }
          );
        }
        emailSubject = `Pagamento confirmado - ${intent.plan.name}`;
        emailContent = `
          Olá ${intent.user_name},
          
          Seu pagamento foi confirmado com sucesso!
          
          Detalhes da assinatura:
          - Plano: ${intent.plan.name}
          - Valor pago: R$ ${intent.billing_cycle === 'annual' ? intent.plan.annual_price : intent.plan.monthly_price}
          - Ciclo: ${intent.billing_cycle === 'annual' ? 'Anual' : 'Mensal'}
          - Organização: ${intent.organization_name}
          - Data de confirmação: ${intent.completed_at ? new Date(intent.completed_at).toLocaleString('pt-BR') : 'Agora'}
          
          Você já pode acessar sua conta e começar a usar nossos serviços.
          
          Acesse: ${process.env.NEXT_PUBLIC_APP_URL}/dashboard
          
          Atenciosamente,
          Equipe de Suporte
        `;
        break;

      case 'reminder':
        if (intent.status !== 'pending') {
          return NextResponse.json(
            {
              success: false,
              error: 'Status inválido para lembrete',
              message: 'Lembretes só podem ser enviados para assinaturas pendentes.',
              code: 'INVALID_STATUS_FOR_REMINDER',
              timestamp: new Date().toISOString(),
            },
            { status: 400 }
          );
        }
        
        const expiresAt = new Date(intent.expires_at);
        const now = new Date();
        const hoursRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60));
        
        emailSubject = `Lembrete: Complete sua assinatura - ${intent.plan.name}`;
        emailContent = `
          Olá ${intent.user_name},
          
          Este é um lembrete sobre sua assinatura pendente do plano ${intent.plan.name}.
          
          ${hoursRemaining > 0 
            ? `Você ainda tem ${hoursRemaining} horas para completar o pagamento.`
            : 'Sua assinatura está prestes a expirar!'
          }
          
          Complete o pagamento através do link abaixo:
          ${intent.checkout_url || 'Link será enviado em breve'}
          
          Não perca esta oportunidade!
          
          Atenciosamente,
          Equipe de Suporte
        `;
        shouldIncludeCheckoutUrl = true;
        break;
    }

    // Validate checkout URL if needed
    if (shouldIncludeCheckoutUrl && !intent.checkout_url) {
      return NextResponse.json(
        {
          success: false,
          error: 'URL de checkout não disponível',
          message: 'Gere uma nova cobrança antes de reenviar o email.',
          code: 'NO_CHECKOUT_URL',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // TODO: Integrate with actual email service (SendGrid, AWS SES, etc.)
    // For now, we'll simulate email sending and log the content
    console.log('Email would be sent:', {
      to: intent.user_email,
      subject: emailSubject,
      content: emailContent,
      type: email_type,
    });

    // Update intent metadata to track email sends
    const emailHistory = intent.metadata.email_history || [];
    emailHistory.push({
      type: email_type,
      sent_at: new Date().toISOString(),
      reason: reason || 'User requested resend',
      subject: emailSubject,
    });

    await subscriptionIntentService.updateIntent(
      intent_id,
      {
        metadata: {
          ...intent.metadata,
          email_history: emailHistory,
          last_email_sent: new Date().toISOString(),
          last_email_type: email_type,
        },
      },
      {
        reason: `Email resent: ${email_type}`,
        triggeredBy: 'recovery_api',
      }
    );

    console.log('Email resend completed in', Date.now() - startTime, 'ms');

    return NextResponse.json({
      success: true,
      intent_id: intent_id,
      email: {
        type: email_type,
        recipient: intent.user_email,
        subject: emailSubject,
        sent_at: new Date().toISOString(),
        includes_checkout_url: shouldIncludeCheckoutUrl,
      },
      intent_status: intent.status,
      resend_count: emailHistory.filter(e => e.type === email_type).length,
      metadata: {
        processing_time_ms: Date.now() - startTime,
        reason: reason || 'User requested resend',
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('Error resending email:', error);

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
          error: 'Erro ao reenviar email',
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
        error: 'Falha ao reenviar email',
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