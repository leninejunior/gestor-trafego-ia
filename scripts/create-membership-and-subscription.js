const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createMembershipAndSubscription() {
  try {
    console.log('🚀 Criando membership e subscription...');

    // 1. Buscar usuário lenine
    const { data: users } = await supabase.auth.admin.listUsers();
    const lenineUser = users.users.find(u => u.email === 'lenine@amitie.com.br');
    
    if (!lenineUser) {
      console.error('❌ Usuário não encontrado');
      return;
    }

    console.log('👤 Usuário encontrado:', lenineUser.email);

    // 2. Buscar primeira organização disponível
    const { data: orgs } = await supabase
      .from('organizations')
      .select('*')
      .limit(1)
      .single();

    if (!orgs) {
      console.error('❌ Nenhuma organização encontrada');
      return;
    }

    console.log('🏢 Organização encontrada:', orgs.name);

    // 3. Verificar se já existe membership
    const { data: existingMembership } = await supabase
      .from('memberships')
      .select('*')
      .eq('user_id', lenineUser.id)
      .eq('organization_id', orgs.id)
      .single();

    if (existingMembership) {
      console.log('✅ Membership já existe');
    } else {
      // Criar membership
      console.log('👥 Criando membership...');
      const { data: membership, error: membershipError } = await supabase
        .from('memberships')
        .insert({
          user_id: lenineUser.id,
          organization_id: orgs.id,
          org_id: orgs.id,
          role: 'owner'
        })
        .select()
        .single();

      if (membershipError) {
        console.error('❌ Erro ao criar membership:', membershipError.message);
        return;
      }

      console.log('✅ Membership criado');
    }

    // 4. Buscar planos disponíveis
    console.log('📋 Buscando planos...');
    const { data: plans } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true);

    if (!plans || plans.length === 0) {
      console.error('❌ Nenhum plano encontrado');
      return;
    }

    console.log('✅ Planos encontrados:', plans.length);

    // 5. Criar subscription Pro
    const proPlan = plans.find(p => p.name === 'Pro') || plans[1] || plans[0];
    console.log('💳 Criando subscription para plano:', proPlan.name);

    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .insert({
        organization_id: orgs.id,
        plan_id: proPlan.id,
        status: 'active',
        billing_cycle: 'monthly',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      })
      .select()
      .single();

    if (subscriptionError) {
      console.error('❌ Erro ao criar subscription:', subscriptionError.message);
      return;
    }

    console.log('✅ Subscription criada:', subscription.id);

    // 6. Verificar configuração final
    console.log('🔍 Verificando configuração final...');
    const { data: finalCheck } = await supabase
      .from('subscriptions')
      .select(`
        *,
        subscription_plans(*)
      `)
      .eq('organization_id', orgs.id)
      .single();

    if (finalCheck) {
      console.log('🎉 Configuração final:');
      console.log(`   - Organização: ${orgs.name}`);
      console.log(`   - Plano: ${finalCheck.subscription_plans.name}`);
      console.log(`   - Status: ${finalCheck.status}`);
      console.log(`   - Clientes máx: ${finalCheck.subscription_plans.max_clients}`);
      console.log(`   - Campanhas máx: ${finalCheck.subscription_plans.max_campaigns}`);
      console.log(`   - Preço: R$ ${finalCheck.subscription_plans.monthly_price}/mês`);
    }

    console.log('🎉 Setup concluído com sucesso!');

  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

createMembershipAndSubscription();