const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkCurrentPlanStructure() {
  console.log('🔍 Verificando estrutura atual dos planos...\n');

  try {
    // 1. Verificar estrutura da tabela subscription_plans
    console.log('1. Estrutura da tabela subscription_plans:');
    const { data: plans, error: plansError } = await supabase
      .from('subscription_plans')
      .select('*')
      .limit(1);

    if (plansError) {
      console.error('❌ Erro ao buscar planos:', plansError);
      return;
    }

    if (plans.length > 0) {
      console.log('✅ Campos disponíveis na tabela subscription_plans:');
      Object.keys(plans[0]).forEach(key => {
        console.log(`   - ${key}: ${typeof plans[0][key]} = ${plans[0][key]}`);
      });
    }

    // 2. Verificar todos os planos
    console.log('\n2. Todos os planos existentes:');
    const { data: allPlans, error: allPlansError } = await supabase
      .from('subscription_plans')
      .select('*');

    if (allPlansError) {
      console.error('❌ Erro ao buscar todos os planos:', allPlansError);
      return;
    }

    allPlans.forEach(plan => {
      console.log(`\n   📋 Plano: ${plan.name} (${plan.id})`);
      console.log(`      - Preço: R$ ${plan.price || 'não definido'}`);
      console.log(`      - Max clientes: ${plan.max_clients || 'não definido'}`);
      console.log(`      - Max campanhas: ${plan.max_campaigns || 'não definido'}`);
      console.log(`      - Features: ${JSON.stringify(plan.features || {}, null, 2)}`);
      console.log(`      - Ativo: ${plan.active}`);
    });

    // 3. Verificar se existe tabela plan_limits
    console.log('\n3. Verificando se tabela plan_limits existe:');
    try {
      const { data, error } = await supabase
        .from('plan_limits')
        .select('*')
        .limit(1);
      
      if (error) {
        console.log('❌ Tabela plan_limits NÃO existe:', error.message);
      } else {
        console.log('✅ Tabela plan_limits existe');
      }
    } catch (err) {
      console.log('❌ Tabela plan_limits NÃO existe:', err.message);
    }

    // 4. Verificar uma organização específica e sua assinatura
    console.log('\n4. Verificando assinatura de uma organização:');
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select(`
        id,
        name,
        subscriptions (
          id,
          status,
          plan_id,
          subscription_plans (
            id,
            name,
            price,
            max_clients,
            max_campaigns,
            features,
            active
          )
        )
      `)
      .limit(1)
      .single();

    if (orgError) {
      console.error('❌ Erro ao buscar organização:', orgError);
    } else {
      console.log(`✅ Organização: ${org.name}`);
      if (org.subscriptions && org.subscriptions.length > 0) {
        const sub = org.subscriptions[0];
        console.log(`   - Assinatura: ${sub.status}`);
        console.log(`   - Plano: ${sub.subscription_plans?.name}`);
        console.log(`   - Max clientes: ${sub.subscription_plans?.max_clients}`);
        console.log(`   - Max campanhas: ${sub.subscription_plans?.max_campaigns}`);
        console.log(`   - Features:`, sub.subscription_plans?.features);
      } else {
        console.log('   - Sem assinaturas');
      }
    }

  } catch (error) {
    console.error('❌ Erro durante verificação:', error);
  }
}

checkCurrentPlanStructure();