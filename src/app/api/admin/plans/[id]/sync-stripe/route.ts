import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe/config';
import { isSuperAdmin } from '@/lib/auth/super-admin';

/**
 * POST /api/admin/plans/[id]/sync-stripe
 * Sincroniza um plano com o Stripe (cria/atualiza produto e preços)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !(await isSuperAdmin(user.id))) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { id: planId } = await params;
    const stripe = getStripe();

    // Buscar plano
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError || !plan) {
      return NextResponse.json(
        { error: 'Plano não encontrado' },
        { status: 404 }
      );
    }

    let productId = plan.stripe_product_id;
    let monthlyPriceId = plan.stripe_price_id_monthly;
    let annualPriceId = plan.stripe_price_id_annual;

    // Criar ou atualizar produto no Stripe
    if (productId) {
      await stripe.products.update(productId, {
        name: plan.name,
        description: plan.description || undefined,
        metadata: {
          plan_id: plan.id,
          max_clients: String(plan.max_clients),
          max_campaigns: String(plan.max_campaigns),
        },
      });
    } else {
      const product = await stripe.products.create({
        name: plan.name,
        description: plan.description || undefined,
        metadata: {
          plan_id: plan.id,
          max_clients: String(plan.max_clients),
          max_campaigns: String(plan.max_campaigns),
        },
      });
      productId = product.id;
    }

    // Converter preços para centavos (BRL)
    const monthlyPriceCents = Math.round(plan.monthly_price * 100);
    const annualPriceCents = Math.round(plan.annual_price * 100);

    // Verificar se precisa criar novos preços
    if (monthlyPriceId) {
      const existingPrice = await stripe.prices.retrieve(monthlyPriceId);
      if (existingPrice.unit_amount !== monthlyPriceCents) {
        await stripe.prices.update(monthlyPriceId, { active: false });
        const newPrice = await stripe.prices.create({
          product: productId,
          unit_amount: monthlyPriceCents,
          currency: 'brl',
          recurring: { interval: 'month' },
          metadata: { plan_id: plan.id, billing_cycle: 'monthly' },
        });
        monthlyPriceId = newPrice.id;
      }
    } else {
      const price = await stripe.prices.create({
        product: productId,
        unit_amount: monthlyPriceCents,
        currency: 'brl',
        recurring: { interval: 'month' },
        metadata: { plan_id: plan.id, billing_cycle: 'monthly' },
      });
      monthlyPriceId = price.id;
    }

    if (annualPriceId) {
      const existingPrice = await stripe.prices.retrieve(annualPriceId);
      if (existingPrice.unit_amount !== annualPriceCents) {
        await stripe.prices.update(annualPriceId, { active: false });
        const newPrice = await stripe.prices.create({
          product: productId,
          unit_amount: annualPriceCents,
          currency: 'brl',
          recurring: { interval: 'year' },
          metadata: { plan_id: plan.id, billing_cycle: 'annual' },
        });
        annualPriceId = newPrice.id;
      }
    } else {
      const price = await stripe.prices.create({
        product: productId,
        unit_amount: annualPriceCents,
        currency: 'brl',
        recurring: { interval: 'year' },
        metadata: { plan_id: plan.id, billing_cycle: 'annual' },
      });
      annualPriceId = price.id;
    }

    // Atualizar plano no banco com IDs do Stripe
    const { error: updateError } = await supabase
      .from('subscription_plans')
      .update({
        stripe_product_id: productId,
        stripe_price_id_monthly: monthlyPriceId,
        stripe_price_id_annual: annualPriceId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', planId);

    if (updateError) {
      console.error('Erro ao atualizar plano:', updateError);
      return NextResponse.json(
        { error: 'Erro ao salvar IDs do Stripe' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      plan_id: planId,
      stripe: {
        product_id: productId,
        price_id_monthly: monthlyPriceId,
        price_id_annual: annualPriceId,
      },
    });
  } catch (error) {
    console.error('Erro ao sincronizar com Stripe:', error);
    return NextResponse.json(
      { error: 'Erro interno ao sincronizar com Stripe' },
      { status: 500 }
    );
  }
}
