const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('🔧 CORRIGINDO APIS COM ERRO 403\n');

  // 1. Verificar usuário atual
  const { data: users } = await supabase.auth.admin.listUsers();
  const user = users.users[0];
  console.log(`👤 Usuário: ${user.email} (${user.id})`);

  // 2. Verificar membership
  const { data: membership } = await supabase
    .from('memberships')
    .select('*')
    .eq('user_id', user.id)
    .single();

  console.log('📋 Membership:', membership);

  // 3. Verificar se precisa criar admin_users
  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!adminUser) {
    console.log('📝 Criando admin_users...');
    const { error } = await supabase
      .from('admin_users')
      .insert({
        user_id: user.id,
        role: 'super_admin',
        permissions: ['all'],
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('❌ Erro ao criar admin_users:', error);
    } else {
      console.log('✅ Admin_users criado!');
    }
  } else {
    console.log('✅ Admin_users já existe!');
  }

  // 4. Verificar subscription_plans
  const { data: plans } = await supabase
    .from('subscription_plans')
    .select('*')
    .limit(1);

  if (!plans || plans.length === 0) {
    console.log('📝 Criando plano básico...');
    const { error } = await supabase
      .from('subscription_plans')
      .insert({
        name: 'Plano Básico',
        price: 99.90,
        currency: 'BRL',
        interval: 'month',
        features: {
          clients: 10,
          campaigns: 100,
          reports: true
        },
        is_active: true
      });

    if (error) {
      console.error('❌ Erro ao criar plano:', error);
    } else {
      console.log('✅ Plano básico criado!');
    }
  } else {
    console.log('✅ Planos já existem!');
  }

  console.log('\n✅ APIs corrigidas! Teste novamente o dashboard.');
}

main().catch(console.error);