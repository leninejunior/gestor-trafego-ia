const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugPlanLimitsIssue() {
  console.log('🔍 Diagnosticando problema com limites de planos...\n');

  try {
    // 1. Verificar se existem planos
    console.log('1. Verificando planos existentes:');
    const { data: plans, error: plansError } = await supabase
      .from('subscription_plans')
      .select('*');

    if (plansError) {
      console.error('❌ Erro ao buscar planos:', plansError);
      return;
    }

    console.log(`✅ Encontrados ${plans.length} planos:`);
    plans.forEach(plan => {
      console.log(`   - ${plan.name} (${plan.id}): R$ ${plan.price}`);
    });

    // 2. Verificar se existem plan_limits
    console.log('\n2. Verificando limites de planos:');
    const { data: planLimits, error: limitsError } = await supabase
      .from('plan_limits')
      .select('*');

    if (limitsError) {
      console.error('❌ Erro ao buscar limites:', limitsError);
      return;
    }

    console.log(`✅ Encontrados ${planLimits.length} registros de limites:`);
    planLimits.forEach(limit => {
      console.log(`   - Plan ${limit.plan_id}: ${limit.max_clients} clientes, ${limit.max_campaigns_per_client} campanhas`);
    });

    // 3. Verificar organizações e suas assinaturas
    console.log('\n3. Verificando organizações e assinaturas:');
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select(`
        id,
        name,
        subscriptions (
          id,
          status,
          plan_id,
          subscription_plans (
            name,
            price
          )
        )
      `);

    if (orgsError) {
      console.error('❌ Erro ao buscar organizações:', orgsError);
      return;
    }

    console.log(`✅ Encontradas ${orgs.length} organizações:`);
    orgs.forEach(org => {
      console.log(`   - ${org.name} (${org.id}):`);
      if (org.subscriptions && org.subscriptions.length > 0) {
        org.subscriptions.forEach(sub => {
          console.log(`     * Assinatura: ${sub.status} - ${sub.subscription_plans?.name || 'Plano não encontrado'}`);
        });
      } else {
        console.log('     * Sem assinaturas ativas');
      }
    });

    // 4. Verificar usuários e memberships
    console.log('\n4. Verificando usuários e memberships:');
    const { data: memberships, error: memberError } = await supabase
      .from('organization_memberships')
      .select(`
        user_id,
        organization_id,
        organizations (
          name,
          subscriptions (
            status,
            plan_id
          )
        )
      `)
      .limit(5);

    if (memberError) {
      console.error('❌ Erro ao buscar memberships:', memberError);
      return;
    }

    console.log(`✅ Encontrados ${memberships.length} memberships (primeiros 5):`);
    memberships.forEach(member => {
      console.log(`   - User ${member.user_id} -> Org ${member.organizations?.name}`);
      if (member.organizations?.subscriptions) {
        member.organizations.subscriptions.forEach(sub => {
          console.log(`     * Assinatura: ${sub.status} - Plan ${sub.plan_id}`);
        });
      }
    });

    // 5. Testar um usuário específico
    console.log('\n5. Testando verificação de limites para um usuário:');
    if (memberships.length > 0) {
      const testUserId = memberships[0].user_id;
      console.log(`   Testando usuário: ${testUserId}`);

      // Simular a verificação de limites
      const { data: membership } = await supabase
        .from('organization_memberships')
        .select('organization_id')
        .eq('user_id', testUserId)
        .single();

      if (membership) {
        console.log(`   ✅ Membership encontrado: org ${membership.organization_id}`);

        const { data: subscription } = await supabase
          .from('subscriptions')
          .select(`
            status,
            plan_id,
            subscription_plans (
              name,
              max_clients,
              max_campaigns,
              features
            )
          `)
          .eq('organization_id', membership.organization_id)
          .eq('status', 'active')
          .single();

        if (subscription) {
          console.log(`   ✅ Assinatura ativa encontrada:`);
          console.log(`      - Plano: ${subscription.subscription_plans?.name}`);
          console.log(`      - Max clientes: ${subscription.subscription_plans?.max_clients}`);
          console.log(`      - Max campanhas: ${subscription.subscription_plans?.max_campaigns}`);
          console.log(`      - Features:`, subscription.subscription_plans?.features);
        } else {
          console.log('   ❌ Nenhuma assinatura ativa encontrada');
        }
      } else {
        console.log('   ❌ Membership não encontrado');
      }
    }

    // 6. Verificar se plan_limits está sendo usado corretamente
    console.log('\n6. Verificando se plan_limits está sendo usado:');
    
    // Verificar se todos os planos têm limites definidos
    const plansWithoutLimits = [];
    for (const plan of plans) {
      const hasLimits = planLimits.some(limit => limit.plan_id === plan.id);
      if (!hasLimits) {
        plansWithoutLimits.push(plan);
      }
    }

    if (plansWithoutLimits.length > 0) {
      console.log('❌ Planos sem limites definidos:');
      plansWithoutLimits.forEach(plan => {
        console.log(`   - ${plan.name} (${plan.id})`);
      });
    } else {
      console.log('✅ Todos os planos têm limites definidos');
    }

  } catch (error) {
    console.error('❌ Erro durante diagnóstico:', error);
  }
}

debugPlanLimitsIssue();