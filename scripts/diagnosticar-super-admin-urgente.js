require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function diagnosticar() {
  console.log('🔍 DIAGNÓSTICO SUPER ADMIN URGENTE\n');

  // 1. Verificar usuário master
  const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
  
  if (usersError) {
    console.error('❌ Erro ao buscar usuários:', usersError);
    return;
  }

  console.log('👥 Usuários encontrados:', users.users.length);
  
  const lenine = users.users.find(u => u.email?.includes('lenine') || u.email?.includes('amitie'));
  
  if (lenine) {
    console.log('\n✅ Usuário Master encontrado:');
    console.log('   Email:', lenine.email);
    console.log('   ID:', lenine.id);
    console.log('   Confirmado:', lenine.email_confirmed_at ? 'Sim' : 'Não');
  } else {
    console.log('\n❌ Usuário master não encontrado!');
  }

  // 2. Verificar tabela super_admins
  const { data: superAdmins, error: saError } = await supabase
    .from('super_admins')
    .select('*');

  console.log('\n🔐 Super Admins na tabela:');
  if (saError) {
    console.error('   ❌ Erro:', saError.message);
  } else {
    console.log('   Total:', superAdmins?.length || 0);
    superAdmins?.forEach(sa => {
      console.log(`   - User ID: ${sa.user_id}`);
    });
  }

  // 3. Verificar memberships
  if (lenine) {
    const { data: memberships, error: memError } = await supabase
      .from('memberships')
      .select('*, organizations(*)')
      .eq('user_id', lenine.id);

    console.log('\n🏢 Memberships do usuário:');
    if (memError) {
      console.error('   ❌ Erro:', memError.message);
    } else {
      console.log('   Total:', memberships?.length || 0);
      memberships?.forEach(m => {
        console.log(`   - Org: ${m.organizations?.name || 'N/A'} (${m.role})`);
      });
    }

    // 4. Verificar clientes
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*, organizations(*)');

    console.log('\n👥 Clientes no sistema:');
    if (clientsError) {
      console.error('   ❌ Erro:', clientsError.message);
    } else {
      console.log('   Total:', clients?.length || 0);
    }
  }

  // 5. Verificar RLS policies
  const { data: policies, error: polError } = await supabase
    .rpc('pg_policies')
    .select('*');

  console.log('\n🛡️ Status RLS:');
  console.log('   Verificação manual necessária no Supabase');

  console.log('\n📋 RESUMO:');
  console.log('   1. Usuário master existe?', lenine ? '✅' : '❌');
  console.log('   2. É super admin?', superAdmins?.some(sa => sa.user_id === lenine?.id) ? '✅' : '❌');
  console.log('   3. Tem memberships?', lenine ? '⚠️ Verificar acima' : '❌');
  console.log('   4. Clientes existem?', '⚠️ Verificar acima');
}

diagnosticar().catch(console.error);
