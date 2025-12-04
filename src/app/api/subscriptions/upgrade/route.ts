import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { planId, billingCycle = 'monthly' } = body;

    if (!planId) {
      return NextResponse.json(
        { error: 'Plan ID is required' },
        { status: 400 }
      );
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('first_name, last_name')
      .eq('user_id', user.id)
      .single();

    // Get user's organization
    const { data: membership } = await supabase
      .from('memberships')
      .select('organization_id, organizations(name)')
      .eq('user_id', user.id)
      .single();

    // Get plan details - support both UUID and plan name, only active plans
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(planId);
    
    let planQuery = supabase.from('subscription_plans').select('*').eq('is_active', true);
    if (isUUID) {
      planQuery = planQuery.eq('id', planId);
    } else {
      planQuery = planQuery.ilike('name', planId);
    }
    
    const { data: plan, error: planError } = await planQuery.single();

    if (planError || !plan) {
      console.error('Plan not found or inactive:', planId, planError);
      return NextResponse.json(
        { error: 'Plano não encontrado ou inativo' },
        { status: 404 }
      );
    }

    // Build user name
    const userName = profile 
      ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || user.email?.split('@')[0] || 'Usuário'
      : user.email?.split('@')[0] || 'Usuário';

    // Get organization name
    const orgName = (membership?.organizations as { name?: string })?.name || 'Minha Organização';

    // Create subscription intent for upgrade
    const { data: intent, error } = await supabase
      .from('subscription_intents')
      .insert({
        user_id: user.id,
        plan_id: plan.id,
        billing_cycle: billingCycle,
        status: 'pending',
        user_email: user.email || '',
        user_name: userName,
        organization_name: orgName,
        metadata: {
          upgrade_from: 'billing_page',
          original_plan_id: planId,
        },
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating subscription intent:', error);
      return NextResponse.json(
        { error: 'Failed to create subscription intent', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      intentId: intent.id,
      redirectUrl: `/checkout?intentId=${intent.id}`,
    });
  } catch (error) {
    console.error('Upgrade error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
