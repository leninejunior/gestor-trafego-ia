const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function diagnosticar() {
  console.log('🔍 DIAGNÓSTICO COMPLETO DO SUPER ADMIN\n');

  try {
    // 1. Verificar usuários
    console.log('1️⃣ Verificando usuários...');
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      console.error('❌ Erro ao buscar usuários:', usersError);
    } else {
      console.log(`✅ Total de usuários: ${users.users.length}`);
      users.users.forEach(user => {
        console.log(`   - ${user.email} (ID: ${user.id})`);
      });
    }

    // 2. Verificar tabela super_admins
    console.log('\n2️⃣ Verificando tabela super_admins...');
    const { data: superAdmins, error: superAdminsError } = await supabase
      .from('super_admins')
      .select('*');
    
    if (superAdminsError) {
      console.error('❌ Erro ao buscar super_admins:', superAdminsError);
    } else {
      console.log(`✅ Total de super admins: ${superAdmins?.length || 0}`);
      if (superAdmins && superAdmins.length > 0) {
        superAdmins.forEach(admin => {
          console.log(`   - User ID: ${admin.user_id}, Ativo: ${admin.is_active}`);
        });
      } else {
        console.log('   ⚠️ Nenhum super admin encontrado!');
      }
    }

    // 3. Verificar organizações
    console.log('\n3️⃣ Verificando organizações...');
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select('*');
    
    if (orgsError) {
      console.error('❌ Erro ao buscar organizações:', orgsError);
    } else {
      console.log(`✅ Total de organizações: ${orgs?.length || 0}`);
      if (orgs && orgs.length > 0) {
        orgs.forEach(org => {
          console.log(`   - ${org.name} (ID: ${org.id})`);
        });
      }
    }

    // 4. Verificar memberships
    console.log('\n4️⃣ Verificando memberships...');
    const { data: memberships, error: membershipsError } = await supabase
      .from('memberships')
      .select('*, organizations(name)');
    
    if (membershipsError) {
      console.error('❌ Erro ao buscar memberships:', membershipsError);
    } else {
      console.log(`✅ Total de memberships: ${memberships?.length || 0}`);
      if (memberships && memberships.length > 0) {
        memberships.forEach(m => {
          console.log(`   - User: ${m.user_id}, Org: ${m.organizations?.name || m.organization_id}, Role: ${m.role}`);
        });
      }
    }

    // 5. Verificar clientes
    console.log('\n5️⃣ Verificando clientes...');
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*, organizations(name)');
    
    if (clientsError) {
      console.error('❌ Erro ao buscar clientes:', clientsError);
    } else {
      console.log(`✅ Total de clientes: ${clients?.length || 0}`);
      if (clients && clients.length > 0) {
        clients.forEach(c => {
          console.log(`   - ${c.name} (Org: ${c.organizations?.name || c.org_id})`);
        });
      }
    }

    // 6. Verificar planos
    console.log('\n6️⃣ Verificando planos de assinatura...');
    const { data: plans, error: plansError } = await supabase
      .from('subscription_plans')
      .select('*');
    
    if (plansError) {
      console.error('❌ Erro ao buscar planos:', plansError);
    } else {
      console.log(`✅ Total de planos: ${plans?.length || 0}`);
      if (plans && plans.length > 0) {
        plans.forEach(p => {
          console.log(`   - ${p.name} (${p.price_monthly}/mês)`);
        });
      }
    }

    // 7. Verificar RLS policies
    console.log('\n7️⃣ Verificando políticas RLS...');
    const { data: policies, error: policiesError } = await supabase
      .rpc('get_policies_info')
      .catch(() => null);
    
    if (policiesError || !policies) {
      console.log('⚠️ Não foi possível verificar políticas RLS (função não existe)');
    }

    console.log('\n✅ Diagnóstico completo!');

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

diagnosticar();
