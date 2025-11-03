const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testMetaConnectionLimits() {
  console.log('🔍 Testando limites específicos para conexão Meta Ads...\n');

  try {
    // 1. Buscar um cliente específico
    console.log('1. Buscando cliente para teste:');
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select(`
        id,
        name,
        org_id,
        organizations (
          name
        )
      `)
      .limit(1)
      .single();

    if (clientError || !client) {
      console.error('❌ Nenhum cliente encontrado');
      return;
    }

    console.log(`✅ Cliente: ${client.name} (${client.id})`);
    console.log(`   Organização: ${client.organizations?.name} (${client.org_id})`);

    // 2. Verificar assinatura da organização
    console.log('\n2. Verificando assinatura:');
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select(`
        status,
        plan_id
      `)
      .eq('organization_id', client.org_id)
      .eq('status', 'active')
      .single();

    if (subError || !subscription) {
      console.log('❌ Nenhuma assinatura ativa');
      return;
    }

    console.log(`✅ Assinatura: ${subscription.status}`);

    // 3. Verificar plano
    console.log('\n3. Verificando plano:');
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', subscription.plan_id)
      .single();

    if (planError || !plan) {
      console.error('❌ Erro ao buscar plano:', planError);
      return;
    }

    console.log(`✅ Plano: ${plan.name}`);
    console.log(`   Max campanhas: ${plan.max_campaigns === -1 ? 'Ilimitado' : plan.max_campaigns}`);

    // 4. Contar campanhas Meta existentes para este cliente
    console.log('\n4. Contando campanhas Meta existentes:');
    const { count: metaCampaigns, error: metaError } = await supabase
      .from('meta_campaigns')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', client.id);

    if (metaError) {
      console.error('❌ Erro ao contar campanhas Meta:', metaError);
    } else {
      console.log(`✅ Campanhas Meta atuais: ${metaCampaigns || 0}`);
    }

    // 5. Verificar conexões Meta existentes
    console.log('\n5. Verificando conexões Meta:');
    const { data: connections, error: connError } = await supabase
      .from('client_meta_connections')
      .select('*')
      .eq('client_id', client.id)
      .eq('is_active', true);

    if (connError) {
      console.error('❌ Erro ao buscar conexões:', connError);
    } else {
      console.log(`✅ Conexões Meta ativas: ${connections?.length || 0}`);
      if (connections && connections.length > 0) {
        connections.forEach(conn => {
          console.log(`   - ${conn.account_name} (${conn.ad_account_id})`);
        });
      }
    }

    // 6. Simular a verificação que o componente faz
    console.log('\n6. Simulando verificação do componente:');
    
    const currentCampaigns = metaCampaigns || 0;
    const maxCampaigns = plan.max_campaigns;
    
    console.log(`   Campanhas atuais: ${currentCampaigns}`);
    console.log(`   Limite máximo: ${maxCampaigns === -1 ? 'Ilimitado' : maxCampaigns}`);
    
    const canConnect = maxCampaigns === -1 || currentCampaigns < maxCampaigns;
    console.log(`   Pode conectar Meta: ${canConnect ? '✅ SIM' : '❌ NÃO'}`);
    
    if (!canConnect) {
      console.log(`   ⚠️ PROBLEMA: Limite atingido (${currentCampaigns}/${maxCampaigns})`);
    }

    // 7. Verificar se há algum problema na lógica do hook
    console.log('\n7. Testando lógica do hook useCampaignLimit:');
    
    // Simular o que o hook faz
    console.log('   Simulando chamada para /api/feature-gate/campaign-limit...');
    
    // Verificar se o cliente existe e tem acesso
    const { data: membership, error: memberError } = await supabase
      .from('organization_memberships')
      .select('user_id')
      .eq('organization_id', client.org_id)
      .limit(1)
      .single();

    if (memberError || !membership) {
      console.log('   ❌ Nenhum membership encontrado para a organização');
    } else {
      console.log(`   ✅ Membership encontrado: user ${membership.user_id}`);
      
      // Simular a verificação de acesso
      const { data: accessCheck, error: accessError } = await supabase
        .from('organization_memberships')
        .select('organization_id')
        .eq('user_id', membership.user_id)
        .eq('organization_id', client.org_id)
        .single();

      if (accessError || !accessCheck) {
        console.log('   ❌ Usuário não tem acesso à organização');
      } else {
        console.log('   ✅ Usuário tem acesso à organização');
        console.log('   ✅ Verificação de limites deveria funcionar');
      }
    }

    console.log('\n📋 RESUMO:');
    console.log(`   Cliente: ${client.name}`);
    console.log(`   Plano: ${plan.name}`);
    console.log(`   Limite campanhas: ${maxCampaigns === -1 ? 'Ilimitado' : maxCampaigns}`);
    console.log(`   Campanhas atuais: ${currentCampaigns}`);
    console.log(`   Pode conectar: ${canConnect ? '✅ SIM' : '❌ NÃO'}`);

    if (canConnect && maxCampaigns !== -1) {
      console.log(`   Restante: ${maxCampaigns - currentCampaigns} campanhas`);
    }

  } catch (error) {
    console.error('❌ Erro durante teste:', error);
  }
}

testMetaConnectionLimits();