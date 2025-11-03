require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugBillingStructure() {
  console.log('🔍 Debugando estrutura do banco para billing...\n');

  try {
    // 1. Verificar usuários
    console.log('1. Verificando usuários...');
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      console.log('❌ Erro ao buscar usuários:', usersError);
      return;
    }
    
    console.log('✅ Usuários encontrados:', users.users?.length || 0);
    const testUser = users.users?.find(u => u.email === 'lenine@amitie.com.br');
    
    if (!testUser) {
      console.log('❌ Usuário lenine@amitie.com.br não encontrado');
      return;
    }
    
    console.log('✅ Usuário teste encontrado:', testUser.email);
    console.log('   ID:', testUser.id);

    // 2. Verificar memberships
    console.log('\n2. Verificando memberships...');
    const { data: memberships, error: membershipError } = await supabase
      .from('organization_memberships')
      .select('*')
      .eq('user_id', testUser.id);

    if (membershipError) {
      console.log('❌ Erro ao buscar memberships:', membershipError);
      return;
    }

    console.log('✅ Memberships encontrados:', memberships?.length || 0);
    if (memberships && memberships.length > 0) {
      console.log('   Organizações:', memberships.map(m => m.organization_id));
    } else {
      console.log('❌ Nenhum membership encontrado para o usuário');
      return;
    }

    const orgId = memberships[0].organization_id;

    // 3. Verificar organizações
    console.log('\n3. Verificando organizações...');
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .single();

    if (orgError) {
      console.log('❌ Erro ao buscar organização:', orgError);
    } else {
      console.log('✅ Organização encontrada:', org.name);
    }

    // 4. Verificar subscription_plans
    console.log('\n4. Verificando subscription_plans...');
    const { data: plans, error: plansError } = await supabase
      .from('subscription_plans')
      .select('*');

    if (plansError) {
      console.log('❌ Erro ao buscar planos:', plansError);
    } else {
      console.log('✅ Planos encontrados:', plans?.length || 0);
      plans?.forEach(plan => {
        console.log(`   - ${plan.name}: max_clients=${plan.max_clients}, max_campaigns=${plan.max_campaigns}`);
      });
    }

    // 5. Verificar subscriptions
    console.log('\n5. Verificando subscriptions...');
    const { data: subscriptions, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('organization_id', orgId);

    if (subError) {
      console.log('❌ Erro ao buscar subscriptions:', subError);
    } else {
      console.log('✅ Subscriptions encontradas:', subscriptions?.length || 0);
      if (subscriptions && subscriptions.length > 0) {
        subscriptions.forEach((sub, index) => {
          console.log(`   Subscription ${index + 1}:`, {
            status: sub.status,
            plan_id: sub.plan_id
          });
        });
      }
    }

    // 6. Verificar clientes
    console.log('\n6. Verificando clientes...');
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, org_id')
      .eq('org_id', orgId);

    if (clientsError) {
      console.log('❌ Erro ao buscar clientes:', clientsError);
    } else {
      console.log('✅ Clientes encontrados:', clients?.length || 0);
    }

    // 7. Testar a query problemática
    console.log('\n7. Testando query problemática...');
    const { data: membershipWithPlan, error: queryError } = await supabase
      .from('organization_memberships')
      .select(`
        organization_id,
        organizations (
          subscriptions (
            status,
            plan:subscription_plans (
              name,
              max_clients,
              max_campaigns,
              max_users,
              features
            )
          )
        )
      `)
      .eq('user_id', testUser.id)
      .single();

    if (queryError) {
      console.log('❌ Erro na query problemática:', queryError);
      
      // Tentar query alternativa
      console.log('\n8. Tentando query alternativa...');
      const { data: altQuery, error: altError } = await supabase
        .from('organization_memberships')
        .select(`
          organization_id,
          organizations!inner (
            id,
            name
          )
        `)
        .eq('user_id', testUser.id)
        .single();

      if (altError) {
        console.log('❌ Erro na query alternativa:', altError);
      } else {
        console.log('✅ Query alternativa funcionou:', altQuery);
      }
    } else {
      console.log('✅ Query problemática funcionou!');
      console.log('   Dados:', JSON.stringify(membershipWithPlan, null, 2));
    }

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

debugBillingStructure();