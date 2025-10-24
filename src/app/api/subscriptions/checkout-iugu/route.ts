import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { IuguService } from '@/lib/iugu/iugu-service';
import { PlanManager } from '@/lib/services/plan-manager';
import { z } from 'zod';

const createCheckoutSchema = z.object({
  plan_id: z.string().uuid('Invalid plan ID'),
  billing_cycle: z.enum(['monthly', 'annual']),
  user_email: z.string().email(),
  user_name: z.string().min(1),
  organization_name: z.string().min(1),
  cpf_cnpj: z.string().optional(),
  phone: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const validationResult = createCheckoutSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: validationResult.error.errors
        },
        { status: 400 }
      );
    }

    const { 
      plan_id, 
      billing_cycle, 
      user_email, 
      user_name,
      organization_name,
      cpf_cnpj,
      phone
    } = validationResult.data;

    // Get plan details
    const planManager = new PlanManager();
    const plan = await planManager.getPlanById(plan_id);
    
    if (!plan || !plan.is_active) {
      return NextResponse.json(
        { error: 'Selected plan is not available' },
        { status: 400 }
      );
    }

    // Calculate price in cents
    const priceInReais = billing_cycle === 'annual' ? plan.annual_price : plan.monthly_price;
    const priceCents = Math.round(priceInReais * 100);

    // Initialize Iugu service
    console.log('Initializing Iugu service...');
    const iuguService = new IuguService();

    // Create temporary ID for tracking
    const tempId = `temp_${Date.now()}_${user_email.split('@')[0]}`;
    
    // Create or get customer
    console.log('Creating/getting customer:', user_email);
    const customer = await iuguService.createOrGetCustomer(
      tempId,
      user_email,
      user_name,
      {
        organization_name,
        cpf_cnpj: cpf_cnpj || '',
        phone: phone || '',
      }
    );
    console.log('Customer created/found:', customer.id);

    // Create or update plan in Iugu
    console.log('Creating/updating plan:', plan_id, 'with price:', priceCents);
    const iuguPlan = await iuguService.createOrUpdatePlan(
      plan_id,
      plan.name,
      priceCents,
      billing_cycle
    );
    console.log('Plan created/updated:', iuguPlan.identifier);

    // Create checkout URL
    console.log('Creating checkout URL...');
    const checkoutUrl = await iuguService.createCheckoutUrl(
      customer.id,
      iuguPlan.identifier,
      tempId,
      plan_id
    );
    console.log('Checkout URL created:', checkoutUrl);

    // Store pending subscription info in database (without user_id yet)
    const supabase = await createClient();
    
    await supabase.from('subscription_intents').insert({
      plan_id,
      billing_cycle,
      iugu_customer_id: customer.id,
      iugu_plan_identifier: iuguPlan.identifier,
      status: 'pending',
      user_email,
      user_name,
      organization_name,
      cpf_cnpj,
      phone,
      metadata: {
        temp_id: tempId,
        created_at: new Date().toISOString(),
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        checkout_url: checkoutUrl,
        customer_id: customer.id,
        plan_identifier: iuguPlan.identifier,
      }
    });

  } catch (error) {
    console.error('Iugu checkout creation error:', error);
    
    // Log detalhado do erro
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      { 
        error: 'Failed to create checkout session',
        details: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
