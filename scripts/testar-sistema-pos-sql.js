require('dotenv').config();

console.log('🧪 Teste do Sistema Pós-Execução SQL');
console.log('====================================');

console.log('\n📋 INSTRUÇÕES:');
console.log('1. Execute o SQL do arquivo database/fix-super-admin-rls.sql no Supabase SQL Editor');
console.log('2. Depois execute este script para testar');

console.log('\n🔧 TESTANDO APIS VIA FETCH...');

async function testarAPIs() {
  const baseUrl = 'http://localhost:3000';
  
  // Primeiro, fazer login como super admin
  console.log('\n🔐 Fazendo login como super admin...');
  
  try {
    // Testar API de clientes (deve funcionar para super admin)
    console.log('\n👥 Testando API de clientes...');
    const clientsResponse = await fetch(`${baseUrl}/api/clients`, {
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    console.log(`Status: ${clientsResponse.status}`);
    
    if (clientsResponse.ok) {
      const clientsData = await clientsResponse.json();
      console.log('✅ API de clientes funcionando');
      console.log(`📊 Clientes encontrados: ${clientsData.clients?.length || 0}`);
    } else {
      const errorData = await clientsResponse.json();
      console.log('❌ Erro na API de clientes:', errorData.error);
    }
    
    // Testar API de organizações
    console.log('\n🏢 Testando API de organizações...');
    const orgsResponse = await fetch(`${baseUrl}/api/organizations`, {
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    console.log(`Status: ${orgsResponse.status}`);
    
    if (orgsResponse.ok) {
      const orgsData = await orgsResponse.json();
      console.log('✅ API de organizações funcionando');
      console.log(`📊 Organizações encontradas: ${orgsData.organizations?.length || 0}`);
    } else {
      const errorData = await orgsResponse.json();
      console.log('❌ Erro na API de organizações:', errorData.error);
    }
    
  } catch (error) {
    console.log('❌ Erro ao testar APIs:', error.message);
  }
}

async function testarLogin() {
  console.log('\n🔐 Testando login direto...');
  
  const { createClient } = require('@supabase/supabase-js');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Login como super admin
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'admin@sistema.com',
      password: 'admin123456'
    });
    
    if (error) {
      console.log('❌ Erro no login:', error.message);
      return;
    }
    
    console.log('✅ Login realizado com sucesso');
    
    // Verificar se é super admin
    const { data: superAdminData, error: superError } = await supabase
      .from('super_admins')
      .select('*')
      .eq('user_id', data.user.id)
      .eq('is_active', true)
      .single();
    
    if (superError) {
      console.log('❌ Erro ao verificar super admin:', superError.message);
    } else {
      console.log('✅ Confirmado como super admin');
    }
    
    // Testar acesso direto aos dados
    console.log('\n📊 Testando acesso direto aos dados...');
    
    // Organizações
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select('*');
    
    if (orgsError) {
      console.log('❌ Erro ao acessar organizações:', orgsError.message);
    } else {
      console.log(`✅ Organizações acessíveis: ${orgs.length}`);
    }
    
    // Clientes
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*');
    
    if (clientsError) {
      console.log('❌ Erro ao acessar clientes:', clientsError.message);
    } else {
      console.log(`✅ Clientes acessíveis: ${clients.length}`);
    }
    
    // Memberships
    const { data: memberships, error: membershipsError } = await supabase
      .from('memberships')
      .select('*');
    
    if (membershipsError) {
      console.log('❌ Erro ao acessar memberships:', membershipsError.message);
    } else {
      console.log(`✅ Memberships acessíveis: ${memberships.length}`);
    }
    
    await supabase.auth.signOut();
    console.log('🚪 Logout realizado');
    
  } catch (error) {
    console.log('❌ Erro no teste de login:', error.message);
  }
}

async function executarTestes() {
  await testarLogin();
  await testarAPIs();
  
  console.log('\n🎯 RESUMO DOS TESTES:');
  console.log('====================');
  console.log('✅ Se todos os testes passaram, o sistema está funcionando');
  console.log('❌ Se há erros, verifique se executou o SQL corretamente');
  console.log('\n📝 PRÓXIMO PASSO:');
  console.log('Faça login no dashboard: http://localhost:3000/login');
  console.log('Email: admin@sistema.com');
  console.log('Senha: admin123456');
}

executarTestes().catch(err => {
  console.log('❌ Erro nos testes:', err.message);
});