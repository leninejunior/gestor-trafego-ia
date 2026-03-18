require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function diagnosticar() {
  console.log('🔍 DIAGNÓSTICO SUPER ADMIN - ACESSO\n');

  try {
    // 1. Verificar usuário Lenine
    console.log('1️⃣ Verificando usuário Lenine...');
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      console.error('❌ Erro ao buscar usuários:', usersError);
      return;
    }

    const lenine = users.users.find(u => u.email === 'lenine@amitie.com.br');
    if (!lenine) {
      console.error('❌ Usuário Lenine não encontrado!');
      return;
    }

    console.log('✅ Usuário encontrado:', lenine.id);
    console.log('   Email:', lenine.email);
    console.log('   Email confirmado:', lenine.email_confirmed_at ? 'Sim' : 'Não');

    // 2. Verificar tabela super_admins
    console.log('\n2️⃣ Verificando tabela super_admins...');
    const { data: superAdmins, error: saError } = await supabase
      .from('super_admins')
      .select('*')
      .eq('user_id', lenine.id);

    if (saError) {
      console.error('❌ Erro ao verificar super_admins:', saError);
    } else if (!superAdmins || superAdmins.length === 0) {
      console.log('⚠️  Usuário NÃO está na tabela super_admins!');
    } else {
      console.log('✅ Super admin encontrado:', superAdmins[0]);
    }

    // 3. Verificar memberships
    console.log('\n3️⃣ Verificando memberships...');
    const { data: memberships, error: memError } = await supabase
      .from('memberships')
      .select('*, organizations(*)')
      .eq('user_id', lenine.id);

    if (memError) {
      console.error('❌ Erro ao verificar memberships:', memError);
    } else if (!memberships || memberships.length === 0) {
      console.log('⚠️  Usuário NÃO tem memberships!');
    } else {
      console.log('✅ Memberships encontrados:', memberships.length);
      memberships.forEach(m => {
        console.log(`   - Org: ${m.organizations?.name || 'N/A'} (${m.organization_id})`);
        console.log(`     Role: ${m.role}`);
      });
    }

    // 4. Verificar organizations
    console.log('\n4️⃣ Verificando organizations...');
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select('*');

    if (orgsError) {
      console.error('❌ Erro ao verificar organizations:', orgsError);
    } else {
      console.log(`✅ Total de organizações: ${orgs?.length || 0}`);
      if (orgs && orgs.length > 0) {
        orgs.forEach(org => {
          console.log(`   - ${org.name} (${org.id})`);
        });
      }
    }

    // 5. Verificar clients
    console.log('\n5️⃣ Verificando clients...');
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*, organizations(name)');

    if (clientsError) {
      console.error('❌ Erro ao verificar clients:', clientsError);
    } else {
      console.log(`✅ Total de clientes: ${clients?.length || 0}`);
      if (clients && clients.length > 0) {
        clients.forEach(client => {
          console.log(`   - ${client.name} (Org: ${client.organizations?.name || 'N/A'})`);
        });
      }
    }

    // 6. Verificar subscription_plans
    console.log('\n6️⃣ Verificando subscription_plans...');
    const { data: plans, error: plansError } = await supabase
      .from('subscription_plans')
      .select('*');

    if (plansError) {
      console.error('❌ Erro ao verificar plans:', plansError);
    } else {
      console.log(`✅ Total de planos: ${plans?.length || 0}`);
      if (plans && plans.length > 0) {
        plans.forEach(plan => {
          console.log(`   - ${plan.name} (${plan.id})`);
        });
      }
    }

    // 7. Testar RLS policies
    console.log('\n7️⃣ Testando RLS policies...');
    
    // Criar cliente temporário com user_id do Lenine
    const testClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${lenine.id}` // Simulação
          }
        }
      }
    );

    // Testar acesso a organizations
    const { data: testOrgs, error: testOrgsError } = await testClient
      .from('organizations')
      .select('*');

    console.log('   Organizations (com RLS):', testOrgsError ? '❌ Erro' : `✅ ${testOrgs?.length || 0} registros`);
    if (testOrgsError) console.log('     Erro:', testOrgsError.message);

    // Testar acesso a clients
    const { data: testClients, error: testClientsError } = await testClient
      .from('clients')
      .select('*');

    console.log('   Clients (com RLS):', testClientsError ? '❌ Erro' : `✅ ${testClients?.length || 0} registros`);
    if (testClientsError) console.log('     Erro:', testClientsError.message);

    // RESUMO E RECOMENDAÇÕES
    console.log('\n' + '='.repeat(60));
    console.log('📋 RESUMO DO DIAGNÓSTICO');
    console.log('='.repeat(60));

    const problemas = [];

    if (!superAdmins || superAdmins.length === 0) {
      problemas.push('❌ Usuário não está na tabela super_admins');
    }

    if (!memberships || memberships.length === 0) {
      problemas.push('❌ Usuário não tem memberships (sem acesso a organizações)');
    }

    if (!orgs || orgs.length === 0) {
      problemas.push('⚠️  Não existem organizações no sistema');
    }

    if (!clients || clients.length === 0) {
      problemas.push('⚠️  Não existem clientes no sistema');
    }

    if (!plans || plans.length === 0) {
      problemas.push('⚠️  Não existem planos de assinatura');
    }

    if (problemas.length > 0) {
      console.log('\n🚨 PROBLEMAS ENCONTRADOS:');
      problemas.forEach(p => console.log(p));
      
      console.log('\n💡 SOLUÇÕES RECOMENDADAS:');
      
      if (!superAdmins || superAdmins.length === 0) {
        console.log('\n1. Adicionar usuário à tabela super_admins:');
        console.log(`   INSERT INTO super_admins (user_id) VALUES ('${lenine.id}');`);
      }

      if (!memberships || memberships.length === 0) {
        console.log('\n2. Criar membership para o usuário:');
        if (orgs && orgs.length > 0) {
          console.log(`   INSERT INTO memberships (user_id, organization_id, role)`);
          console.log(`   VALUES ('${lenine.id}', '${orgs[0].id}', 'owner');`);
        } else {
          console.log('   Primeiro crie uma organização!');
        }
      }

      if (!orgs || orgs.length === 0) {
        console.log('\n3. Criar organização:');
        console.log(`   INSERT INTO organizations (name, created_by)`);
        console.log(`   VALUES ('Minha Organização', '${lenine.id}');`);
      }

    } else {
      console.log('\n✅ Nenhum problema crítico encontrado!');
      console.log('   O usuário tem todas as permissões necessárias.');
    }

  } catch (error) {
    console.error('\n❌ Erro durante diagnóstico:', error);
  }
}

diagnosticar();
