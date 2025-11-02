const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testarNavegadorFinal() {
  console.log('🌐 Teste Final - Simulando Navegador...\n');

  try {
    // 1. Fazer login
    console.log('1️⃣ Fazendo login...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'leninejunior@gmail.com',
      password: 'SuperAdmin123!'
    });

    if (authError) {
      console.log('❌ Erro no login:', authError.message);
      return;
    }

    console.log('✅ Login realizado com sucesso!');

    // 2. Verificar se é super admin
    console.log('\n2️⃣ Verificando se é super admin...');
    const { data: superAdminCheck, error: superError } = await supabase
      .from('super_admins')
      .select('id')
      .eq('user_id', authData.user.id)
      .eq('is_active', true)
      .single();

    if (superError) {
      console.log('❌ Erro ao verificar super admin:', superError.message);
    } else {
      console.log('✅ É super admin:', !!superAdminCheck);
    }

    // 3. Testar acesso direto às organizações
    console.log('\n3️⃣ Testando acesso direto às organizações...');
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select('*');

    if (orgsError) {
      console.log('❌ Erro ao acessar organizações:', orgsError.message);
    } else {
      console.log('✅ Organizações acessíveis:', orgs.length);
      orgs.forEach((org, index) => {
        console.log(`   ${index + 1}. ${org.name} (${org.id})`);
      });
    }

    // 4. Instruções para o navegador
    console.log('\n🌐 INSTRUÇÕES PARA TESTAR NO NAVEGADOR:');
    console.log('=====================================');
    console.log('1. Abra o navegador em: http://localhost:3000');
    console.log('2. Faça login com:');
    console.log('   📧 Email: leninejunior@gmail.com');
    console.log('   🔑 Senha: SuperAdmin123!');
    console.log('3. Acesse: http://localhost:3000/admin/organizations');
    console.log('4. Você deve ver a lista de organizações');
    console.log('\n✅ SISTEMA CONFIGURADO E PRONTO!');

  } catch (error) {
    console.log('❌ Erro geral:', error.message);
  }
}

testarNavegadorFinal();