require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('🧪 TESTANDO ACESSO FINAL');
console.log('========================');

const supabase = createClient(supabaseUrl, supabaseKey);

async function testarAcesso() {
  try {
    const emailLenine = 'lenine.engrene@gmail.com';
    
    // 1. Fazer login
    console.log('🔐 Fazendo login...');
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: emailLenine,
      password: 'senha123'
    });
    
    if (loginError) {
      console.log('❌ Erro no login:', loginError.message);
      return;
    }
    
    console.log('✅ Login realizado com sucesso!');
    console.log('👤 Usuário:', loginData.user.email);
    console.log('🆔 ID:', loginData.user.id);
    
    // 2. Testar acesso às organizações
    console.log('\n🏢 Testando acesso às organizações...');
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select('*');
    
    if (orgsError) {
      console.log('❌ Erro ao acessar organizações:', orgsError.message);
      console.log('🔍 Detalhes:', orgsError);
    } else {
      console.log(`✅ Organizações acessadas! (${orgs.length} encontradas)`);
      orgs.forEach((org, index) => {
        console.log(`  ${index + 1}. ${org.name} (ID: ${org.id})`);
      });
    }
    
    // 3. Testar acesso aos memberships
    console.log('\n👥 Testando acesso aos memberships...');
    const { data: memberships, error: membershipsError } = await supabase
      .from('memberships')
      .select('*');
    
    if (membershipsError) {
      console.log('❌ Erro ao acessar memberships:', membershipsError.message);
      console.log('🔍 Detalhes:', membershipsError);
    } else {
      console.log(`✅ Memberships acessados! (${memberships.length} encontrados)`);
      memberships.forEach((membership, index) => {
        console.log(`  ${index + 1}. User: ${membership.user_id}, Org: ${membership.org_id}, Role: ${membership.role}`);
      });
    }
    
    // 4. Testar acesso aos clientes
    console.log('\n👤 Testando acesso aos clientes...');
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*');
    
    if (clientsError) {
      console.log('❌ Erro ao acessar clientes:', clientsError.message);
      console.log('🔍 Detalhes:', clientsError);
    } else {
      console.log(`✅ Clientes acessados! (${clients.length} encontrados)`);
      clients.forEach((client, index) => {
        console.log(`  ${index + 1}. ${client.name} (ID: ${client.id})`);
      });
    }
    
    // 5. Testar criação de um cliente
    console.log('\n🆕 Testando criação de cliente...');
    const { data: newClient, error: createError } = await supabase
      .from('clients')
      .insert({
        name: 'Cliente Teste',
        org_id: orgs && orgs.length > 0 ? orgs[0].id : null
      })
      .select()
      .single();
    
    if (createError) {
      console.log('❌ Erro ao criar cliente:', createError.message);
      console.log('🔍 Detalhes:', createError);
    } else {
      console.log('✅ Cliente criado com sucesso!');
      console.log('📝 Nome:', newClient.name);
      console.log('🆔 ID:', newClient.id);
      
      // Remover o cliente teste
      const { error: deleteError } = await supabase
        .from('clients')
        .delete()
        .eq('id', newClient.id);
      
      if (!deleteError) {
        console.log('🗑️  Cliente teste removido');
      }
    }
    
    // 6. Verificar se é super admin
    console.log('\n👑 Verificando super admin...');
    const { data: superAdmin, error: superError } = await supabase
      .from('super_admins')
      .select('*')
      .eq('user_id', loginData.user.id)
      .single();
    
    if (superError) {
      console.log('❌ Erro ao verificar super admin:', superError.message);
    } else {
      console.log('✅ É super admin!');
      console.log('📅 Criado em:', superAdmin.created_at);
    }
    
    console.log('\n🎯 RESULTADO FINAL');
    console.log('==================');
    
    const results = {
      login: !loginError,
      organizations: !orgsError,
      memberships: !membershipsError,
      clients: !clientsError,
      create_client: !createError,
      super_admin: !superError
    };
    
    const successCount = Object.values(results).filter(Boolean).length;
    const totalTests = Object.keys(results).length;
    
    console.log(`📊 Testes passaram: ${successCount}/${totalTests}`);
    
    Object.entries(results).forEach(([test, passed]) => {
      console.log(`${passed ? '✅' : '❌'} ${test}`);
    });
    
    if (successCount === totalTests) {
      console.log('\n🎉 SISTEMA FUNCIONANDO PERFEITAMENTE!');
      console.log('✅ Todas as permissões estão corretas');
      console.log('🚀 Lenine pode usar o sistema normalmente');
    } else {
      console.log('\n⚠️  AINDA HÁ PROBLEMAS');
      console.log('❌ Algumas permissões não estão funcionando');
      console.log('💡 Execute o SQL manualmente no Supabase SQL Editor');
    }
    
  } catch (error) {
    console.log('❌ Erro inesperado:', error.message);
  }
}

testarAcesso().catch(err => {
  console.log('❌ Erro na execução:', err.message);
});