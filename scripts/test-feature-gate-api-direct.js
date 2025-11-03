const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testFeatureGateApiDirect() {
  console.log('🧪 Testando API de feature-gate diretamente...\n');

  try {
    // 1. Buscar um usuário e cliente para teste
    const { data: client } = await supabase
      .from('clients')
      .select('id, name, org_id')
      .limit(1)
      .single();

    const { data: membership } = await supabase
      .from('memberships')
      .select('user_id')
      .eq('organization_id', client.org_id)
      .eq('status', 'active')
      .limit(1)
      .single();

    console.log(`Cliente: ${client.name} (${client.id})`);
    console.log(`Usuário: ${membership.user_id}`);
    console.log(`Organização: ${client.org_id}`);

    // 2. Simular a verificação da API step by step
    console.log('\n🔍 Simulando verificação da API step by step:');

    // Step 1: Verificar se cliente existe
    console.log('\nStep 1: Verificar cliente');
    const { data: clientCheck, error: clientError } = await supabase
      .from('clients')
      .select('id, org_id')
      .eq('id', client.id)
      .single();

    if (clientError) {
      console.log(`❌ Cliente não encontrado: ${clientError.message}`);
      return;
    }
    console.log(`✅ Cliente encontrado: ${clientCheck.id}`);

    // Step 2: Verificar acesso do usuário
    console.log('\nStep 2: Verificar acesso do usuário');
    const { data: membershipCheck, error: membershipError } = await supabase
      .from('memberships')
      .select('organization_id')
      .eq('user_id', membership.user_id)
      .eq('organization_id', clientCheck.org_id)
      .single();

    if (membershipError) {
      console.log(`❌ Acesso negado: ${membershipError.message}`);
      return;
    }
    console.log(`✅ Acesso confirmado: org ${membershipCheck.organization_id}`);

    // Step 3: Buscar assinatura
    console.log('\nStep 3: Buscar assinatura');
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('plan_id, status')
      .eq('organization_id', clientCheck.org_id)
      .eq('status', 'active')
      .single();

    if (subError) {
      console.log(`❌ Assinatura não encontrada: ${subError.message}`);
      return;
    }
    console.log(`✅ Assinatura encontrada: ${subscription.status} - Plan ${subscription.plan_id}`);

    // Step 4: Buscar plano
    console.log('\nStep 4: Buscar plano');
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('name, max_campaigns')
      .eq('id', subscription.plan_id)
      .single();

    if (planError) {
      console.log(`❌ Plano não encontrado: ${planError.message}`);
      return;
    }
    console.log(`✅ Plano encontrado: ${plan.name} - Max campanhas: ${plan.max_campaigns === -1 ? 'Ilimitado' : plan.max_campaigns}`);

    // Step 5: Contar campanhas
    console.log('\nStep 5: Contar campanhas');
    const { count, error: countError } = await supabase
      .from('meta_campaigns')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', client.id);

    if (countError) {
      console.log(`❌ Erro ao contar campanhas: ${countError.message}`);
      // Vamos tentar com outras tabelas
      console.log('Tentando com tabela campaigns...');
      
      const { count: count2, error: countError2 } = await supabase
        .from('campaigns')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', client.id);

      if (countError2) {
        console.log(`❌ Erro com campaigns também: ${countError2.message}`);
        console.log('Assumindo 0 campanhas para continuar teste...');
        var currentCount = 0;
      } else {
        console.log(`✅ Campanhas contadas (campaigns): ${count2 || 0}`);
        var currentCount = count2 || 0;
      }
    } else {
      console.log(`✅ Campanhas contadas (meta_campaigns): ${count || 0}`);
      var currentCount = count || 0;
    }

    // Step 6: Calcular resultado
    console.log('\nStep 6: Calcular resultado');
    const isUnlimited = plan.max_campaigns === -1;
    const allowed = isUnlimited || currentCount < plan.max_campaigns;
    const remaining = isUnlimited ? -1 : Math.max(0, plan.max_campaigns - currentCount);

    console.log(`Campanhas atuais: ${currentCount}`);
    console.log(`Limite: ${isUnlimited ? 'Ilimitado' : plan.max_campaigns}`);
    console.log(`Permitido: ${allowed ? '✅ SIM' : '❌ NÃO'}`);
    console.log(`Restante: ${isUnlimited ? 'Ilimitado' : remaining}`);

    // 7. Resultado final
    console.log('\n📋 RESULTADO FINAL:');
    const result = {
      allowed: allowed,
      current: currentCount,
      limit: plan.max_campaigns,
      remaining: remaining,
      isUnlimited: isUnlimited,
      reason: allowed ? undefined : `Campaign limit reached. Your plan allows ${plan.max_campaigns} campaigns per client, and this client currently has ${currentCount}.`,
      upgradeRequired: !allowed,
    };

    console.log(JSON.stringify(result, null, 2));

    // 8. Testar se o problema está no frontend
    console.log('\n🎯 DIAGNÓSTICO:');
    if (allowed) {
      console.log('✅ A API deveria retornar que é permitido conectar Meta Ads');
      console.log('❓ Se ainda aparece "Limite Atingido", o problema pode ser:');
      console.log('   1. Cache no frontend');
      console.log('   2. Erro na autenticação da API');
      console.log('   3. Problema no hook useCampaignLimit');
      console.log('   4. Componente não está atualizando');
    } else {
      console.log('❌ A API está corretamente bloqueando (limite realmente atingido)');
    }

  } catch (error) {
    console.error('❌ Erro durante teste:', error);
  }
}

testFeatureGateApiDirect();