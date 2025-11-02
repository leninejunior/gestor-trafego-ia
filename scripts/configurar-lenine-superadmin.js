const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('👤 CONFIGURANDO LENINE COMO SUPERADMIN\n');

  // 1. Buscar usuário lenine.engrene@gmail.com
  const { data: users } = await supabase.auth.admin.listUsers();
  const user = users.users.find(u => u.email === 'lenine.engrene@gmail.com');
  
  if (!user) {
    console.log('❌ Usuário lenine.engrene@gmail.com não encontrado');
    console.log('📝 Criando usuário...');
    
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: 'lenine.engrene@gmail.com',
      password: 'senha123',
      email_confirm: true,
      user_metadata: {
        name: 'Lenine Engrene'
      }
    });
    
    if (createError) {
      console.error('❌ Erro ao criar usuário:', createError);
      return;
    }
    
    console.log('✅ Usuário criado!');
    user = newUser.user;
  } else {
    console.log(`✅ Usuário encontrado: ${user.email} (${user.id})`);
    
    // Confirmar email se necessário
    if (!user.email_confirmed_at) {
      console.log('📧 Confirmando email...');
      await supabase.auth.admin.updateUserById(user.id, {
        email_confirm: true
      });
      console.log('✅ Email confirmado!');
    }
    
    // Resetar senha
    console.log('🔧 Resetando senha...');
    await supabase.auth.admin.updateUserById(user.id, {
      password: 'senha123'
    });
    console.log('✅ Senha resetada para: senha123');
  }

  // 2. Verificar organizações
  const { data: orgs } = await supabase
    .from('organizations')
    .select('*');

  console.log(`\n🏢 Organizações encontradas: ${orgs?.length || 0}`);
  orgs?.forEach(org => {
    console.log(`   - ${org.name} (${org.id})`);
  });

  if (!orgs || orgs.length === 0) {
    console.log('📝 Criando organização padrão...');
    const { data: newOrg, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: 'Engrene Connecting Ideas',
        slug: 'engrene-connecting-ideas-' + Date.now()
      })
      .select()
      .single();
    
    if (orgError) {
      console.error('❌ Erro ao criar organização:', orgError);
      return;
    }
    
    console.log('✅ Organização criada!');
    orgs = [newOrg];
  }

  // 3. Verificar membership
  const { data: membership } = await supabase
    .from('memberships')
    .select('*')
    .eq('user_id', user.id);

  console.log(`\n👥 Memberships: ${membership?.length || 0}`);

  if (!membership || membership.length === 0) {
    console.log('📝 Criando membership de superadmin...');
    const { error: membershipError } = await supabase
      .from('memberships')
      .insert({
        user_id: user.id,
        organization_id: orgs[0].id,
        org_id: orgs[0].id,
        role: 'super_admin',
        status: 'active',
        accepted_at: new Date().toISOString()
      });
    
    if (membershipError) {
      console.error('❌ Erro ao criar membership:', membershipError);
      return;
    }
    
    console.log('✅ Membership de superadmin criada!');
  } else {
    // Atualizar role para super_admin
    console.log('🔧 Atualizando role para super_admin...');
    const { error: updateError } = await supabase
      .from('memberships')
      .update({ role: 'super_admin' })
      .eq('user_id', user.id);
    
    if (updateError) {
      console.error('❌ Erro ao atualizar role:', updateError);
    } else {
      console.log('✅ Role atualizada para super_admin!');
    }
  }

  // 4. Verificar clientes
  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .eq('org_id', orgs[0].id);

  console.log(`\n👥 Clientes: ${clients?.length || 0}`);

  if (!clients || clients.length === 0) {
    console.log('📝 Criando clientes de teste...');
    const clientsToCreate = [
      { name: 'Cliente Teste 1', org_id: orgs[0].id },
      { name: 'Cliente Teste 2', org_id: orgs[0].id },
      { name: 'Cliente Teste 3', org_id: orgs[0].id }
    ];

    for (const client of clientsToCreate) {
      const { data, error } = await supabase
        .from('clients')
        .insert(client)
        .select()
        .single();

      if (error) {
        console.error(`❌ Erro ao criar ${client.name}:`, error);
      } else {
        console.log(`✅ ${client.name} criado!`);
      }
    }
  }

  // 5. Testar login
  console.log('\n🧪 Testando login...');
  const testSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const { data: session, error: loginError } = await testSupabase.auth.signInWithPassword({
    email: 'lenine.engrene@gmail.com',
    password: 'senha123'
  });

  if (loginError) {
    console.error('❌ Erro no login:', loginError.message);
  } else {
    console.log('✅ Login funcionando!');
  }

  console.log('\n🎉 CONFIGURAÇÃO COMPLETA!');
  console.log('\n🚀 Agora você pode fazer login:');
  console.log('   Email: lenine.engrene@gmail.com');
  console.log('   Senha: senha123');
  console.log('\n✅ Você deve ver:');
  console.log('   - 1 organização: Engrene Connecting Ideas');
  console.log('   - 3 clientes de teste');
  console.log('   - Acesso de superadmin a tudo');
}

main().catch(console.error);