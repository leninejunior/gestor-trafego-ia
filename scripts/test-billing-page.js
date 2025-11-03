const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testBillingPage() {
  console.log('🧪 Testando página de billing...\n');

  try {
    // 1. Verificar se existem planos
    console.log('1. Verificando planos disponíveis...');
    const { data: plans, error: plansError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true);

    if (plansError) {
      console.error('❌ Erro ao buscar planos:', plansError);
      return;
    }

    console.log(`✅ Encontrados ${plans?.length || 0} planos ativos:`);
    plans?.forEach(plan => {
      console.log(`   - ${plan.name}: R$ ${plan.monthly_price}/mês`);
      console.log(`     Features: ${JSON.stringify(plan.features)}`);
    });

    // 2. Testar API de planos
    console.log('\n2. Testando API /api/subscriptions/plans...');
    const response = await fetch('http://localhost:3000/api/subscriptions/plans');
    
    if (!response.ok) {
      console.error('❌ API retornou erro:', response.status);
      return;
    }

    const apiData = await response.json();
    console.log('✅ API funcionando:', apiData.success);
    console.log(`   Planos retornados: ${apiData.data?.length || 0}`);

    // 3. Verificar se existe usuário de teste
    console.log('\n3. Verificando usuários existentes...');
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();

    if (usersError) {
      console.error('❌ Erro ao buscar usuários:', usersError);
      return;
    }

    if (users && users.length > 0) {
      console.log(`✅ Encontrados ${users.length} usuários autenticados`);
      const firstUser = users[0];
      console.log(`   Primeiro usuário: ${firstUser.email}`);
      
      // 4. Verificar organizações do usuário
      const { data: memberships } = await supabase
        .from('memberships')
        .select(`
          organization_id,
          role,
          organizations (
            id,
            name
          )
        `)
        .eq('user_id', firstUser.id);

      if (memberships && memberships.length > 0) {
        console.log(`✅ Usuário tem ${memberships.length} organização(ões):`);
        memberships.forEach(m => {
          console.log(`   - ${m.organizations.name} (${m.role})`);
        });
      } else {
        console.log('⚠️ Usuário não tem organizações');
      }
    } else {
      console.log('⚠️ Nenhum usuário encontrado');
    }

    console.log('\n✅ Teste concluído! A página de billing deveria estar funcionando.');
    console.log('📝 Para acessar: http://localhost:3000/dashboard/billing');

  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
  }
}

testBillingPage();