import { NextRequest, NextResponse } from 'next/server';
import { IuguService } from '@/lib/iugu/iugu-service';
import { getSubscriptionIntentService } from '@/lib/services/subscription-intent-service';
import { 
  CreateSubscriptionIntentRequest,
  SubscriptionIntentError,
  SubscriptionIntentValidationError,
} from '@/lib/types/subscription-intent';
import { z } from 'zod';

// Schema para user_data aninhado (formato do frontend)
const userDataSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100, 'Nome deve ter no máximo 100 caracteres'),
  email: z.string().email('Email deve ter formato válido').toLowerCase(),
  organization_name: z.string().min(2, 'Nome da organização deve ter pelo menos 2 caracteres').max(100, 'Nome da organização deve ter no máximo 100 caracteres'),
  cpf_cnpj: z.string().optional().refine(
    (val) => !val || /^[\d]{11}$|^[\d]{14}$/.test(val.replace(/\D/g, '')),
    'CPF deve ter 11 dígitos ou CNPJ deve ter 14 dígitos'
  ),
  phone: z.string().optional().refine(
    (val) => !val || /^[\+]?[1-9][\d]{8,15}$/.test(val.replace(/\D/g, '')),
    'Telefone deve ter formato válido'
  ),
});

// Enhanced validation schema with better error messages - suporta ambos os formatos
const createCheckoutSchema = z.object({
  plan_id: z.string().uuid('Plan ID deve ser um UUID válido'),
  billing_cycle: z.enum(['monthly', 'annual'], {
    errorMap: () => ({ message: 'Ciclo de cobrança deve ser "monthly" ou "annual"' })
  }),
  // Formato direto (legado)
  user_email: z.string().email('Email deve ter formato válido').toLowerCase().optional(),
  user_name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100, 'Nome deve ter no máximo 100 caracteres').optional(),
  organization_name: z.string().min(2, 'Nome da organização deve ter pelo menos 2 caracteres').max(100, 'Nome da organização deve ter no máximo 100 caracteres').optional(),
  cpf_cnpj: z.string().optional().refine(
    (val) => !val || /^[\d]{11}$|^[\d]{14}$/.test(val.replace(/\D/g, '')),
    'CPF deve ter 11 dígitos ou CNPJ deve ter 14 dígitos'
  ),
  phone: z.string().optional().refine(
    (val) => !val || /^[\+]?[1-9][\d]{8,15}$/.test(val.replace(/\D/g, '')),
    'Telefone deve ter formato válido'
  ),
  // Formato aninhado (frontend atual)
  user_data: userDataSchema.optional(),
  metadata: z.record(z.any()).optional(),
});

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Parse and validate request body
    const body = await request.json();
    const validationResult = createCheckoutSchema.safeParse(body);
    
    if (!validationResult.success) {
      console.warn('Checkout validation failed:', validationResult.error.errors);
      return NextResponse.json(
        { 
          success: false,
          error: 'Dados de entrada inválidos',
          details: validationResult.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
          })),
          timestamp: new Date().toISOString()
        },
        { status: 400 }
      );
    }

    const rawData = validationResult.data;
    
    // Normalizar dados - suporta ambos os formatos (direto ou aninhado em user_data)
    const requestData = {
      plan_id: rawData.plan_id,
      billing_cycle: rawData.billing_cycle,
      user_email: rawData.user_data?.email || rawData.user_email || '',
      user_name: rawData.user_data?.name || rawData.user_name || '',
      organization_name: rawData.user_data?.organization_name || rawData.organization_name || '',
      cpf_cnpj: rawData.user_data?.cpf_cnpj || rawData.cpf_cnpj,
      phone: rawData.user_data?.phone || rawData.phone,
      metadata: rawData.metadata,
    };
    
    // Validar campos obrigatórios após normalização
    if (!requestData.user_email || !requestData.user_name || !requestData.organization_name) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Dados obrigatórios faltando',
          details: [
            !requestData.user_email && { field: 'email', message: 'Email é obrigatório' },
            !requestData.user_name && { field: 'name', message: 'Nome é obrigatório' },
            !requestData.organization_name && { field: 'organization_name', message: 'Nome da organização é obrigatório' },
          ].filter(Boolean),
          timestamp: new Date().toISOString()
        },
        { status: 400 }
      );
    }
    
    console.log('Processing checkout request for:', requestData.user_email);

    // Initialize services
    const subscriptionIntentService = getSubscriptionIntentService();
    const iuguService = new IuguService();

    // Create subscription intent first
    const intentRequest: CreateSubscriptionIntentRequest = {
      plan_id: requestData.plan_id,
      billing_cycle: requestData.billing_cycle,
      user_email: requestData.user_email,
      user_name: requestData.user_name,
      organization_name: requestData.organization_name,
      cpf_cnpj: requestData.cpf_cnpj,
      phone: requestData.phone,
      metadata: {
        ...requestData.metadata,
        request_ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown',
        created_via: 'checkout_api',
      },
    };

    const intentResponse = await subscriptionIntentService.createIntent(intentRequest);
    console.log('Subscription intent created:', intentResponse.intent_id);

    // Get the created intent with plan details
    const intent = await subscriptionIntentService.getIntent(intentResponse.intent_id);
    
    // Calculate price in cents for Iugu
    const priceInReais = requestData.billing_cycle === 'annual' 
      ? intent.plan.annual_price 
      : intent.plan.monthly_price;
    const priceCents = Math.round(priceInReais * 100);

    // Create or get customer in Iugu
    console.log('Creating/getting Iugu customer for:', requestData.user_email);
    const customer = await iuguService.createOrGetCustomer(
      intentResponse.intent_id, // Use intent ID as reference
      requestData.user_email,
      requestData.user_name,
      {
        organization_name: requestData.organization_name,
        cpf_cnpj: requestData.cpf_cnpj || '',
        phone: requestData.phone || '',
      }
    );

    // Create or update plan in Iugu
    console.log('Creating/updating Iugu plan:', requestData.plan_id);
    const iuguPlan = await iuguService.createOrUpdatePlan(
      requestData.plan_id,
      intent.plan.name,
      priceCents,
      requestData.billing_cycle
    );

    // Create checkout URL
    console.log('Creating Iugu checkout URL...');
    const checkoutUrl = await iuguService.createCheckoutUrl(
      customer.id,
      iuguPlan.identifier,
      intentResponse.intent_id, // Use intent ID as reference
      requestData.plan_id
    );

    // Update subscription intent with Iugu data
    await subscriptionIntentService.updateIntent(
      intentResponse.intent_id,
      {
        iugu_customer_id: customer.id,
        checkout_url: checkoutUrl,
        metadata: {
          ...intent.metadata,
          iugu_plan_identifier: iuguPlan.identifier,
          checkout_created_at: new Date().toISOString(),
          processing_time_ms: Date.now() - startTime,
        },
      },
      {
        reason: 'Checkout URL created successfully',
        triggeredBy: 'checkout_api',
      }
    );

    console.log('Checkout process completed successfully in', Date.now() - startTime, 'ms');

    // Return enhanced response with all necessary URLs and data
    return NextResponse.json({
      success: true,
      intent_id: intentResponse.intent_id,
      checkout_url: checkoutUrl,
      status_url: intentResponse.status_url,
      expires_at: intentResponse.expires_at,
      plan: {
        id: intent.plan.id,
        name: intent.plan.name,
        price: priceInReais,
        billing_cycle: requestData.billing_cycle,
      },
      customer: {
        id: customer.id,
        email: requestData.user_email,
        name: requestData.user_name,
      },
      metadata: {
        processing_time_ms: Date.now() - startTime,
        created_at: new Date().toISOString(),
      },
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('Checkout creation error:', error);
    
    // Enhanced error logging
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        processingTime,
      });
    }

    // Handle specific subscription intent errors
    if (error instanceof SubscriptionIntentValidationError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Erro de validação',
          details: error.message,
          field: error.field,
          code: error.code,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    if (error instanceof SubscriptionIntentError) {
      const statusCode = error.code === 'INVALID_PLAN' ? 400 : 500;
      return NextResponse.json(
        {
          success: false,
          error: 'Erro no processamento da assinatura',
          details: error.message,
          code: error.code,
          timestamp: new Date().toISOString(),
        },
        { status: statusCode }
      );
    }

    // Handle Iugu service errors
    if (error instanceof Error && error.message.includes('Iugu')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Erro no gateway de pagamento',
          details: 'Não foi possível processar o pagamento no momento. Tente novamente.',
          code: 'PAYMENT_GATEWAY_ERROR',
          timestamp: new Date().toISOString(),
        },
        { status: 502 }
      );
    }

    // Generic error response
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';
    
    return NextResponse.json(
      {
        success: false,
        error: 'Falha ao criar sessão de checkout',
        details: errorMessage,
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString(),
        metadata: {
          processing_time_ms: processingTime,
        },
      },
      { status: 500 }
    );
  }
}
