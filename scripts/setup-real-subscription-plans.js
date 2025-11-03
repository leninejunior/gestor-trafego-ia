const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente do Supabase não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupRealSubscriptionPlans() {
  try {
    console.log('🚀 Configurando planos de subscription reais...');

    // 1. Limpar planos existentes
    console.log('🧹 Limpando planos existentes...');
    const { error: deleteError } = await supabase
      .from('subscription_plans')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (deleteError) {
      console.log('⚠️ Aviso ao limpar planos:', deleteError.message);
    }

    // 2. Inserir planos reais
    console.log('📋 Inserindo planos reais...');
    const plans = [
      {
        name: 'Básico',
        description: 'Para pequenas empresas iniciantes',
        monthly_price: 49.90,
        annual_price: 499.90,
        max_clients: 1,
        max_campaigns: 3,
        features: {
          advancedAnalytics: false,
          customReports: false,
          apiAccess: false,
          whiteLabel: false,
          prioritySupport: false
        },
        is_active: true
      },
      {
        name: 'Pro',
        description: 'Para agências em crescimento',
        monthly_price: 99.90,
        annual_price: 999.90,
        max_clients: 10,
        max_campaigns: -1, // Ilimitado
        features: {
          advancedAnalytics: true,
          customReports: true,
          apiAccess: true,
          whiteLabel: false,
          prioritySupport: true
        },
        is_active: true
      },
      {
        name: 'Enterprise',
        description: 'Para grandes agências',
        monthly_price: 199.90,
        annual_price: 1999.90,
        max_clients: -1, // Ilimitado
        max_campaigns: -1, // Ilimitado
        features: {
          advancedAnalytics: true,
          customReports: true,
          apiAccess: true,
          whiteLabel: true,
          prioritySupport: true
        },
        is_active: true
      }
    ];

    const { data: insertedPlans, error: insertError } = await supabase
      .from('subscription_plans')
      .insert(plans)
      .select();

    if (insertError) {
      console.error('❌ Erro ao inserir planos:', insertError);
      return;
    }

    console.log('✅ Planos inseridos:', insertedPlans.length);

    // 3. Buscar usuário lenine@amitie.com.br
    console.log('👤 Buscando usuário lenine@amitie.com.br...');
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();
    
    if (userError) {
      console.error('❌ Erro ao buscar usuários:', userError);
      return;
    }

    const lenineUser = users.users.find(u => u.email === 'lenine@amitie.com.br');
    if (!lenineUser) {
      console.error('❌ Usuário lenine@amitie.com.br não encontrado');
      return;
    }

    console.log('✅ Usuário encontrado:', lenineUser.email);

    // 4. Buscar organização do usuário
    console.log('🏢 Buscando organização do usuário...');
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('org_id')
      .eq('user_id', lenineUser.id)
      .single();

    if (membershipError || !membership) {
      console.error('❌ Organização não encontrada para o usuário:', membershipError?.message);
      return;
    }

    // Buscar nome da organização
    const { data: organization } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', membership.org_id)
      .single();

    console.log('✅ Organização encontrada:', organization?.name || membership.org_id);

    // 5. Verificar se já existe subscription
    const { data: existingSubscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('organization_id', membership.org_id)
      .single();

    if (existingSubscription) {
      console.log('⚠️ Subscription já existe para esta organização');
      
      // Atualizar para plano Pro
      const proPlan = insertedPlans.find(p => p.name === 'Pro');
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({
          plan_id: proPlan.id,
          status: 'active',
          billing_cycle: 'monthly',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // +30 dias
        })
        .eq('id', existingSubscription.id);

      if (updateError) {
        console.error('❌ Erro ao atualizar subscription:', updateError);
        return;
      }

      console.log('✅ Subscription atualizada para plano Pro');
    } else {
      // 6. Criar subscription Pro para o usuário
      console.log('💳 Criando subscription Pro para o usuário...');
      const proPlan = insertedPlans.find(p => p.name === 'Pro');
      
      const { data: newSubscription, error: subscriptionError } = await supabase
        .from('subscriptions')
        .insert({
          organization_id: membership.org_id,
          plan_id: proPlan.id,
          status: 'active',
          billing_cycle: 'monthly',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // +30 dias
        })
        .select()
        .single();

      if (subscriptionError) {
        console.error('❌ Erro ao criar subscription:', subscriptionError);
        return;
      }

      console.log('✅ Subscription Pro criada:', newSubscription.id);
    }

    // 7. Verificar dados finais
    console.log('🔍 Verificando configuração final...');
    const { data: finalCheck } = await supabase
      .from('subscriptions')
      .select(`
        *,
        subscription_plans(*)
      `)
      .eq('organization_id', membership.org_id)
      .single();

    if (finalCheck) {
      console.log('✅ Configuração final:');
      console.log(`   - Plano: ${finalCheck.subscription_plans.name}`);
      console.log(`   - Status: ${finalCheck.status}`);
      console.log(`   - Clientes máx: ${finalCheck.subscription_plans.max_clients}`);
      console.log(`   - Campanhas máx: ${finalCheck.subscription_plans.max_campaigns}`);
      console.log(`   - Preço: R$ ${finalCheck.subscription_plans.monthly_price}/mês`);
    }

    console.log('🎉 Setup de planos concluído com sucesso!');

  } catch (error) {
    console.error('❌ Erro no setup:', error);
  }
}

setupRealSubscriptionPlans();