const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testarApiDireta() {
  try {
    console.log('🧪 TESTANDO API DIRETA');
    console.log('======================\n');

    // 1. Fazer login
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'admin@sistema.com',
      password: 'admin123456'
    });

    if (authError) {
      console.error('❌ Erro no login:', authError.message);
      return;
    }

    console.log('✅ Login realizado com sucesso');
    console.log('🔑 Access Token:', authData.session.access_token.substring(0, 50) + '...');

    // 2. Buscar um usuário de teste
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const testUser = authUsers.users.find(u => u.email !== 'admin@sistema.com');
    
    if (!testUser) {
      console.log('❌ Nenhum usuário de teste encontrado');
      return;
    }
    
    console.log('🎯 Usuário de teste:', testUser.email, testUser.id);

    // 3. Testar API GET (detalhes do usuário)
    console.log('\n👁️ Testando GET /api/admin/users/[userId]...');
    const getResponse = await fetch(`http://localhost:3000/api/admin/users/${testUser.id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authData.session.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Status GET:', getResponse.status);
    if (getResponse.ok) {
      const getData = await getResponse.json();
      console.log('✅ GET funcionou:', getData.user?.email);
    } else {
      const getError = await getResponse.json();
      console.log('❌ Erro GET:', getError);
    }

    // 4. Testar API PATCH (editar usuário)
    console.log('\n✏️ Testando PATCH /api/admin/users/[userId]...');
    const patchResponse = await fetch(`http://localhost:3000/api/admin/users/${testUser.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${authData.session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'update_profile',
        firstName: 'Nome Teste',
        lastName: 'Sobrenome Teste',
        email: testUser.email
      })
    });

    console.log('Status PATCH:', patchResponse.status);
    if (patchResponse.ok) {
      const patchData = await patchResponse.json();
      console.log('✅ PATCH funcionou:', patchData.message);
    } else {
      const patchError = await patchResponse.json();
      console.log('❌ Erro PATCH:', patchError);
    }

    // 5. Logout
    await supabase.auth.signOut();
    console.log('\n🚪 Logout realizado');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

testarApiDireta();