require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testBillingAPIFixed() {
  console.log('🔍 Testando API de Billing corrigida...\n');

  try {
    // Pegar usuário teste
    const { data: users } = await supabase.auth.admin.listUsers();
    const testUser = users.users?.find(u => u.email === 'lenine@amitie.com.br');
    
    if (!testUser) {
      console.log('❌ Usuário teste não encontrado');
      return;
    }

    console.log('✅ Usuário teste:', testUser.email);

    // Testar nova lógica
    console.log('\n1. Testando nova lógica de membership...');
    const { data: membership, error: membershipError } = await supabase
      .from('organization_memberships')
      .select('organization_id')
      .eq('user_id', testUser.id)
      .limit(1)
      .single();

    if (membershipError) {
      console.log('❌ Erro ao buscar membership:', membershipError);
      return;
    }

    console.log('✅ Membership encontrado:', membership.organization_id);

    // Testar nova lógica de subscription
    console.log('\n2. Testando nova lógica de subscription...');
    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select(`
        status,
        subscription_plans (
          name,
          max_clients,
          max_campaigns,
          features
        )
      `)
      .eq('organization_id', membership.organization_id)
      .eq('status', 'active')
      .limit(1)
      .single();

    if (subscriptionError) {
      console.log('❌ Erro ao buscar subscription:', subscriptionError);
      return;
    }

    console.log('✅ Subscription encontrada:', {
      status: subscription.status,
      plan: subscription.subscription_plans?.name
    });

    // Testar contagem de clientes
    console.log('\n3. Testando contagem de clientes...');
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id')
      .eq('org_id', membership.organization_id);

    if (clientsError) {
      console.log('❌ Erro ao contar clientes:', clientsError);
    } else {
      console.log('✅ Clientes encontrados:', clients?.length || 0);
    }

    // Testar contagem de usuários
    console.log('\n4. Testando contagem de usuários...');
    const { data: memberships, error: membershipsError } = await supabase
      .from('organization_memberships')
      .select('id')
      .eq('organization_id', membership.organization_id);

    if (membershipsError) {
      console.log('❌ Erro ao contar usuários:', membershipsError);
    } else {
      console.log('✅ Usuários encontrados:', memberships?.length || 0);
    }

    console.log('\n✅ Teste da lógica corrigida concluído com sucesso!');

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

testBillingAPIFixed();