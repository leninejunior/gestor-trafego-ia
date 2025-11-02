const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testarSuperAdminFinal() {
  console.log('🔍 Testando Super Admin Final...\n');

  const userId = 'f7313dc4-e5e1-400b-ba3e-1fee686df937';

  try {
    // 1. Verificar estrutura da tabela super_admins
    console.log('1️⃣ Verificando estrutura da tabela super_admins...');
    const { data: tableInfo, error: tableError } = await supabase
      .from('super_admins')
      .select('*')
      .limit(1);

    if (tableError) {
      console.log('❌ Erro ao acessar tabela:', tableError.message);
    } else {
      console.log('✅ Tabela acessível, colunas:', Object.keys(tableInfo[0] || {}));
    }

    // 2. Verificar se usuário está na tabela
    console.log('\n2️⃣ Verificando se usuário está na tabela...');
    const { data: superAdmin, error: superError } = await supabase
      .from('super_admins')
      .select('*')
      .eq('user_id', userId);

    if (superError) {
      console.log('❌ Erro ao buscar super admin:', superError.message);
    } else {
      console.log('✅ Super admin encontrado:', superAdmin.length > 0 ? 'SIM' : 'NÃO');
      if (superAdmin.length > 0) {
        console.log('   Dados:', superAdmin[0]);
      }
    }

    // 3. Testar função sem is_active
    console.log('\n3️⃣ Testando busca sem is_active...');
    const { data: simpleCheck, error: simpleError } = await supabase
      .from('super_admins')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (simpleError) {
      console.log('❌ Erro na busca simples:', simpleError.message);
    } else {
      console.log('✅ Busca simples funcionou:', !!simpleCheck);
    }

    // 4. Testar API com token correto
    console.log('\n4️⃣ Testando API com autenticação...');
    
    // Primeiro fazer login
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'leninejunior@gmail.com',
      password: 'Lenine@2024'
    });

    if (authError) {
      console.log('❌ Erro no login:', authError.message);
    } else {
      console.log('✅ Login realizado com sucesso');
      
      // Testar API com token
      const response = await fetch('http://localhost:3000/api/organizations', {
        headers: {
          'Authorization': `Bearer ${authData.session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log(`📡 Status da API: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ API funcionando:', data);
      } else {
        const error = await response.text();
        console.log('❌ Erro na API:', error);
      }
    }

  } catch (error) {
    console.log('❌ Erro geral:', error.message);
  }
}

testarSuperAdminFinal();