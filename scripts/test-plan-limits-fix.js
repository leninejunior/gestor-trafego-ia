const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testPlanLimitsFix() {
  console.log('🧪 Testando correção dos limites de planos...\n');

  try {
    // 1. Buscar um usuário para testar
    console.log('1. Buscando usuário para teste:');
    const { data: membership, error: memberError } = await supabase
      .from('organization_memberships')
      .select(`
        user_id,
        organization_id,
        organizations (
          name
        )
      `)
      .limit(1)
      .single();

    if (memberError || !membership) {
      console.error('❌ Nenhum usuário encontrado para teste');
      return;
    }

    const userId = membership.user_id;
    const orgId = membership.organization_id;
    console.log(`✅ Usuário de teste: ${userId}`);
    console.log(`   Organização: ${membership.organizations?.name} (${orgId})`);

    // 2. Verificar assinatura da organização
    console.log('\n2. Verificando assinatura da organização:');
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select(`
        status,
        plan_id
      `)
      .eq('organization_id', orgId)
      .eq('status', 'active')
      .single();

    if (subError || !subscription) {
      console.log('❌ Nenhuma assinatura ativa encontrada');
      console.log('   Criando assinatura de teste...');
      
      // Buscar um plano para criar assinatura de teste
      const { data: plan } = await supabase
        .from('subscription_plans')
        .select('id, name')
        .limit(1)
        .single();

      if (plan) {
        const { data: newSub, error: createError } = await supabase
          .from('subscriptions')
          .insert({
            organization_id: orgId,
            plan_id: plan.id,
            status: 'active',
            current_period_start: new Date().toISOString(),
            current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          })
          .select()
          .single();

        if (createError) {
          console.error('❌ Erro ao criar assinatura de teste:', createError);
          return;
        }

        console.log(`✅ Assinatura de teste criada: ${plan.name}`);
        subscription.plan_id = plan.id;
      } else {
        console.error('❌ Nenhum plano encontrado para criar assinatura');
        return;
      }
    } else {
      console.log(`✅ Assinatura ativa encontrada: ${subscription.status}`);
    }

    // 3. Buscar detalhes do plano
    console.log('\n3. Verificando detalhes do plano:');
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
    console.log(`   Max clientes: ${plan.max_clients === -1 ? 'Ilimitado' : plan.max_clients}`);
    console.log(`   Max campanhas: ${plan.max_campaigns === -1 ? 'Ilimitado' : plan.max_campaigns}`);
    console.log(`   Features:`, plan.features);

    // 4. Testar verificação de limite de clientes
    console.log('\n4. Testando verificação de limite de clientes:');
    
    // Contar clientes atuais
    const { count: clientCount } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId);

    console.log(`   Clientes atuais: ${clientCount || 0}`);
    console.log(`   Limite: ${plan.max_clients === -1 ? 'Ilimitado' : plan.max_clients}`);
    
    const canAddClient = plan.max_clients === -1 || (clientCount || 0) < plan.max_clients;
    console.log(`   Pode adicionar cliente: ${canAddClient ? '✅ SIM' : '❌ NÃO'}`);

    // 5. Testar verificação de limite de campanhas para um cliente
    console.log('\n5. Testando verificação de limite de campanhas:');
    
    const { data: client } = await supabase
      .from('clients')
      .select('id, name')
      .eq('org_id', orgId)
      .limit(1)
      .single();

    if (client) {
      console.log(`   Cliente de teste: ${client.name} (${client.id})`);
      
      // Contar campanhas do cliente
      const { count: campaignCount } = await supabase
        .from('meta_campaigns')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', client.id);

      console.log(`   Campanhas atuais: ${campaignCount || 0}`);
      console.log(`   Limite: ${plan.max_campaigns === -1 ? 'Ilimitado' : plan.max_campaigns}`);
      
      const canAddCampaign = plan.max_campaigns === -1 || (campaignCount || 0) < plan.max_campaigns;
      console.log(`   Pode adicionar campanha: ${canAddCampaign ? '✅ SIM' : '❌ NÃO'}`);
    } else {
      console.log('   ⚠️ Nenhum cliente encontrado para teste de campanhas');
    }

    // 6. Testar a API de feature-gate
    console.log('\n6. Testando API de feature-gate:');
    
    if (client) {
      try {
        const response = await fetch(`http://localhost:3000/api/feature-gate/campaign-limit?clientId=${client.id}`, {
          headers: {
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('   ✅ API funcionando:');
          console.log(`      Permitido: ${data.allowed}`);
          console.log(`      Atual: ${data.current}`);
          console.log(`      Limite: ${data.limit}`);
          console.log(`      Restante: ${data.remaining}`);
        } else {
          console.log(`   ❌ API retornou erro: ${response.status}`);
        }
      } catch (error) {
        console.log('   ⚠️ Não foi possível testar API (servidor pode não estar rodando)');
      }
    }

    console.log('\n✅ Teste concluído!');

  } catch (error) {
    console.error('❌ Erro durante teste:', error);
  }
}

testPlanLimitsFix();