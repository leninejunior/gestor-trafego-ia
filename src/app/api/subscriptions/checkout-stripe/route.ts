import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe/config';
import { createClient } from '@/lib/supabase/server';
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
  cpf_cnpj: z.string().optional(),
  phone: z.string().optional(),
});

// Validation schema - suporta ambos os formatos
const createCheckoutSchema = z.object({
  plan_id: z.string().uuid('Plan ID deve ser um UUID válido'),
  billing_cycle: z.enum(['monthly', 'annual'], {
    errorMap: () => ({ message: 'Ciclo de cobrança deve ser "monthly" ou "annual"' })
  }),
  // Formato direto (legado)
  user_email: z.string().email().toLowerCase().optional(),
  user_name: z.string().min(2).max(100).optional(),
  organization_name: z.string().min(2).max(100).optional(),
  cpf_cnpj: z.string().optional(),
  phone: z.string().optional(),
  // Formato aninhado (frontend atual)
  user_data: userDataSchema.optional(),
  metadata: z.record(z.any()).optional(),
});

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Verificar se Stripe está configurado
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Stripe não configurado',
          details: 'Configure STRIPE_SECRET_KEY nas variáveis de ambiente',
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      );
    }

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
    
    // Normalizar dados - suporta ambos os formatos
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
    
    // Validar campos obrigatórios
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
    
    console.log('Processing Stripe checkout for:', requestData.user_email);

    // Initialize services
    const subscriptionIntentService = getSubscriptionIntentService();
    const stripe = getStripe();

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
        created_via: 'stripe_checkout_api',
        payment_provider: 'stripe',
      },
    };

    const intentResponse = await subscriptionIntentService.createIntent(intentRequest);
    console.log('Subscription intent created:', intentResponse.intent_id);

    // Get the created intent with plan details
    const intent = await subscriptionIntentService.getIntent(intentResponse.intent_id);
    
    // Buscar plano com IDs do Stripe
    const supabase = await createClient();
    const { data: planWithStripe } = await supabase
      .from('subscription_plans')
      .select('stripe_product_id, stripe_price_id_monthly, stripe_price_id_annual')
      .eq('id', requestData.plan_id)
      .single();
    
    // Usar preço do Stripe se disponível, senão criar dinamicamente
    const stripePriceId = requestData.billing_cycle === 'annual'
      ? planWithStripe?.stripe_price_id_annual
      : planWithStripe?.stripe_price_id_monthly;
    
    // Calculate price for Stripe (in cents) - usado se não tiver preço cadastrado
    const priceInReais = requestData.billing_cycle === 'annual' 
      ? intent.plan.annual_price 
      : intent.plan.monthly_price;
    const priceCents = Math.round(priceInReais * 100);

    // Create or get Stripe customer
    console.log('Creating/getting Stripe customer for:', requestData.user_email);
    
    // Check if customer already exists
    const existingCustomers = await stripe.customers.list({
      email: requestData.user_email,
      limit: 1
    });

    let customer;
    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
      // Update customer metadata
      customer = await stripe.customers.update(customer.id, {
        name: requestData.user_name,
        metadata: {
          organization_name: requestData.organization_name,
          intent_id: intentResponse.intent_id,
          cpf_cnpj: requestData.cpf_cnpj || '',
          phone: requestData.phone || '',
        }
      });
    } else {
      customer = await stripe.customers.create({
        email: requestData.user_email,
        name: requestData.user_name,
        metadata: {
          organization_name: requestData.organization_name,
          intent_id: intentResponse.intent_id,
          cpf_cnpj: requestData.cpf_cnpj || '',
          phone: requestData.phone || '',
        }
      });
    }

    // Create Stripe Checkout Session
    console.log('Creating Stripe Checkout Session...');
    
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    // Usar preço cadastrado no Stripe ou criar dinamicamente
    const lineItems = stripePriceId
      ? [{ price: stripePriceId, quantity: 1 }]
      : [{
          price_data: {
            currency: 'brl' as const,
            product_data: {
              name: intent.plan.name,
              description: intent.plan.description || `Plano ${intent.plan.name} - ${requestData.billing_cycle === 'annual' ? 'Anual' : 'Mensal'}`,
              metadata: { plan_id: requestData.plan_id },
            },
            unit_amount: priceCents,
            recurring: {
              interval: (requestData.billing_cycle === 'annual' ? 'year' : 'month') as 'year' | 'month',
              interval_count: 1,
            },
          },
          quantity: 1,
        }];

    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      billing_address_collection: 'required',
      line_items: lineItems,
      mode: 'subscription',
      success_url: `${appUrl}/checkout/status/${intentResponse.intent_id}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/checkout/status/${intentResponse.intent_id}?canceled=true`,
      metadata: {
        intent_id: intentResponse.intent_id,
        plan_id: requestData.plan_id,
        billing_cycle: requestData.billing_cycle,
        organization_name: requestData.organization_name,
      },
      subscription_data: {
        metadata: {
          intent_id: intentResponse.intent_id,
          plan_id: requestData.plan_id,
          billing_cycle: requestData.billing_cycle,
          organization_name: requestData.organization_name,
        }
      },
      allow_promotion_codes: true,
      locale: 'pt-BR',
    });

    // Update subscription intent with Stripe data
    await subscriptionIntentService.updateIntent(
      intentResponse.intent_id,
      {
        stripe_customer_id: customer.id,
        stripe_session_id: session.id,
        checkout_url: session.url || '',
        metadata: {
          ...intent.metadata,
          stripe_session_id: session.id,
          checkout_created_at: new Date().toISOString(),
          processing_time_ms: Date.now() - startTime,
          payment_provider: 'stripe',
        },
      },
      {
        reason: 'Stripe Checkout Session created successfully',
        triggeredBy: 'stripe_checkout_api',
      }
    );

    console.log('Stripe checkout process completed in', Date.now() - startTime, 'ms');

    return NextResponse.json({
      success: true,
      intent_id: intentResponse.intent_id,
      checkout_url: session.url,
      session_id: session.id,
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
        payment_provider: 'stripe',
      },
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('Stripe checkout creation error:', error);
    
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

    // Handle Stripe errors
    if (error instanceof Error && error.message.includes('Stripe')) {
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
