require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

console.log('🐛 Debug do Erro no Console');
console.log('===========================');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function debugErroConsole() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    console.log('\n🔐 1. Testando login...');
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: 'admin@sistema.com',
      password: 'admin123456'
    });
    
    if (loginError) {
      console.log('❌ Erro no login:', loginError.message);
      return;
    }
    
    console.log('✅ Login OK - User ID:', loginData.user.id);
    
    console.log('\n👑 2. Verificando super admin...');
    const { data: superAdminData, error: superError } = await supabase
      .from('super_admins')
      .select('*')
      .eq('user_id', loginData.user.id)
      .eq('is_active', true)
      .single();
    
    if (superError) {
      console.log('❌ Erro ao verificar super admin:', superError.message);
    } else {
      console.log('✅ É super admin:', !!superAdminData);
    }
    
    console.log('\n🏢 3. Testando acesso a organizações...');
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select('*');
    
    if (orgsError) {
      console.log('❌ Erro organizações:', orgsError.message);
    } else {
      console.log('✅ Organizações acessíveis:', orgs.length);
    }
    
    console.log('\n👥 4. Testando acesso a clientes...');
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*');
    
    if (clientsError) {
      console.log('❌ Erro clientes:', clientsError.message);
    } else {
      console.log('✅ Clientes acessíveis:', clients.length);
    }
    
    console.log('\n🔗 5. Testando acesso a memberships...');
    const { data: memberships, error: membershipsError } = await supabase
      .from('memberships')
      .select('*');
    
    if (membershipsError) {
      console.log('❌ Erro memberships:', membershipsError.message);
    } else {
      console.log('✅ Memberships acessíveis:', memberships.length);
    }
    
    console.log('\n🌐 6. Testando API via fetch...');
    
    // Obter token de sessão
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      console.log('❌ Sem sessão ativa');
      return;
    }
    
    // Testar API de clientes
    const response = await fetch('http://localhost:3000/api/clients', {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Status API clientes:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API clientes OK - Clientes:', data.clients?.length || 0);
    } else {
      const errorData = await response.json();
      console.log('❌ Erro API clientes:', errorData.error);
    }
    
    await supabase.auth.signOut();
    
  } catch (error) {
    console.log('❌ Erro geral:', error.message);
  }
}

async function verificarEstadoSistema() {
  console.log('\n📊 VERIFICANDO ESTADO DO SISTEMA');
  console.log('================================');
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Verificar se tabela super_admins existe
  console.log('\n🔍 Verificando tabela super_admins...');
  const { data: superAdmins, error: superError } = await supabase
    .from('super_admins')
    .select('*')
    .limit(5);
  
  if (superError) {
    console.log('❌ Tabela super_admins:', superError.message);
    console.log('💡 SOLUÇÃO: Execute o SQL do arquivo database/fix-super-admin-rls.sql');
  } else {
    console.log('✅ Tabela super_admins OK - Registros:', superAdmins.length);
  }
  
  // Verificar outras tabelas
  const tabelas = ['organizations', 'memberships', 'clients'];
  
  for (const tabela of tabelas) {
    const { data, error } = await supabase
      .from(tabela)
      .select('*')
      .limit(1);
    
    if (error) {
      console.log(`❌ Tabela ${tabela}:`, error.message);
    } else {
      console.log(`✅ Tabela ${tabela}: OK`);
    }
  }
}

async function executarTudo() {
  await verificarEstadoSistema();
  await debugErroConsole();
  
  console.log('\n🎯 RESUMO DO DEBUG');
  console.log('==================');
  console.log('Se há erros acima, execute:');
  console.log('1. SQL do arquivo database/fix-super-admin-rls.sql no Supabase');
  console.log('2. Reinicie o servidor Next.js');
  console.log('3. Teste novamente');
}

executarTudo().catch(err => {
  console.log('❌ Erro no debug:', err.message);
});