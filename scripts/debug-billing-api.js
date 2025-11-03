require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔧 Configuração Supabase:');
console.log('   URL:', supabaseUrl);
console.log('   Key:', supabaseKey ? 'Definida' : 'Não definida');

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente do Supabase não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugBillingAPI() {
  console.log('🔍 Debugando API de Billing...\n');

  try {
    // 1. Verificar usuário atual
    console.log('1. Verificando usuário atual...');
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.log('❌ Usuário não autenticado');
      return;
    }
    
    console.log('✅ Usuário encontrado:', user.email);
    console.log('   ID:', user.id);

    // 2. Verificar memberships
    console.log('\n2. Verificando memberships...');
    const { data: memberships, error: membershipError } = await supabase
      .from('organization_memberships')
      .select('*')
      .eq('user_id', user.id);

    if (membershipError) {
      console.log('❌ Erro ao buscar memberships:', membershipError);
      return;
    }

    console.log('✅ Memberships encontrados:', memberships?.length || 0);
    if (memberships && memberships.length > 0) {
      console.log('   Organizações:', memberships.map(m => m.organization_id));
    }

    // 3. Verificar organizações
    if (memberships && memberships.length > 0) {
      console.log('\n3. Verificando organizações...');
      const orgId = memberships[0].organization_id;
      
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

      // 4. Verificar subscriptions
      console.log('\n4. Verificando subscriptions...');
      const { data: subscriptions, error: subError } = await supabase
        .from('subscriptions')
        .select(`
          *,
          subscription_plans (*)
        `)
        .eq('organization_id', orgId);

      if (subError) {
        console.log('❌ Erro ao buscar subscriptions:', subError);
      } else {
        console.log('✅ Subscriptions encontradas:', subscriptions?.length || 0);
        if (subscriptions && subscriptions.length > 0) {
          subscriptions.forEach((sub, index) => {
            console.log(`   Subscription ${index + 1}:`, {
              status: sub.status,
              plan: sub.subscription_plans?.name || 'N/A'
            });
          });
        }
      }

      // 5. Verificar clientes
      console.log('\n5. Verificando clientes...');
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('id, name')
        .eq('org_id', orgId);

      if (clientsError) {
        console.log('❌ Erro ao buscar clientes:', clientsError);
      } else {
        console.log('✅ Clientes encontrados:', clients?.length || 0);
      }

      // 6. Testar a query completa da API
      console.log('\n6. Testando query completa da API...');
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
        .eq('user_id', user.id)
        .single();

      if (queryError) {
        console.log('❌ Erro na query completa:', queryError);
      } else {
        console.log('✅ Query completa executada com sucesso');
        console.log('   Dados:', JSON.stringify(membershipWithPlan, null, 2));
      }
    }

    // 7. Testar API diretamente
    console.log('\n7. Testando API /api/plan-limits...');
    try {
      const response = await fetch('http://localhost:3000/api/plan-limits');
      const data = await response.json();
      
      if (response.ok) {
        console.log('✅ API funcionando corretamente');
        console.log('   Limites:', data.limits);
        console.log('   Uso:', data.usage);
      } else {
        console.log('❌ API retornou erro:', response.status, data);
      }
    } catch (fetchError) {
      console.log('❌ Erro ao chamar API:', fetchError.message);
    }

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

debugBillingAPI();