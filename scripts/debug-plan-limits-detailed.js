require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugPlanLimitsDetailed() {
  console.log('🔍 Debug detalhado da API plan-limits...\n');

  try {
    // Simular o que a API faz
    const { data: users } = await supabase.auth.admin.listUsers();
    const testUser = users.users?.find(u => u.email === 'lenine@amitie.com.br');
    
    if (!testUser) {
      console.log('❌ Usuário não encontrado');
      return;
    }

    console.log('✅ Usuário encontrado:', testUser.id);

    // Passo 1: Buscar membership
    console.log('\n1. Buscando membership...');
    const { data: membership, error: membershipError } = await supabase
      .from('organization_memberships')
      .select('organization_id')
      .eq('user_id', testUser.id)
      .limit(1)
      .single();

    if (membershipError) {
      console.log('❌ Erro no membership:', membershipError);
      return;
    }

    console.log('✅ Membership encontrado:', membership.organization_id);

    // Passo 2: Buscar subscription
    console.log('\n2. Buscando subscription...');
    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select(`
        status,
        subscription_plans (
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
      console.log('❌ Erro na subscription:', subscriptionError);
      return;
    }

    console.log('✅ Subscription encontrada:', subscription);

    // Passo 3: Buscar usage - clientes
    console.log('\n3. Buscando clientes...');
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id')
      .eq('org_id', membership.organization_id);

    if (clientsError) {
      console.log('❌ Erro nos clientes:', clientsError);
    } else {
      console.log('✅ Clientes encontrados:', clients?.length || 0);
    }

    // Passo 4: Buscar usage - campanhas
    console.log('\n4. Buscando campanhas...');
    const { data: campaigns, error: campaignsError } = await supabase
      .from('meta_campaigns')
      .select('id')
      .eq('organization_id', membership.organization_id);

    if (campaignsError) {
      console.log('❌ Erro nas campanhas:', campaignsError);
    } else {
      console.log('✅ Campanhas encontradas:', campaigns?.length || 0);
    }

    // Passo 5: Buscar usage - usuários
    console.log('\n5. Buscando usuários...');
    const { data: memberships, error: membershipsError } = await supabase
      .from('organization_memberships')
      .select('id')
      .eq('organization_id', membership.organization_id);

    if (membershipsError) {
      console.log('❌ Erro nos memberships:', membershipsError);
    } else {
      console.log('✅ Memberships encontrados:', memberships?.length || 0);
    }

    // Simular resposta da API
    console.log('\n6. Simulando resposta da API...');
    const limits = {
      max_clients: subscription.subscription_plans.max_clients,
      max_campaigns: subscription.subscription_plans.max_campaigns,
      max_users: 10,
      features: subscription.subscription_plans.features
    };

    const usage = {
      clients: clients?.length || 0,
      campaigns: campaigns?.length || 0,
      users: memberships?.length || 0
    };

    console.log('✅ Limites:', limits);
    console.log('✅ Uso:', usage);

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

debugPlanLimitsDetailed();