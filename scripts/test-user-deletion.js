require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Variáveis de ambiente não configuradas');
  process.exit(1);
}

async function testUserDeletion() {
  try {
    console.log('🔍 Testando deleção de usuário...\n');

    // Simular login como super admin
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Tentar fazer login com o super admin
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'lenine.engrene@gmail.com',
      password: 'senha123' // Você precisará usar a senha correta
    });

    if (authError) {
      console.log('❌ Erro de autenticação:', authError.message);
      console.log('Tentando com admin@sistema.com...');
      
      const { data: authData2, error: authError2 } = await supabase.auth.signInWithPassword({
        email: 'admin@sistema.com',
        password: 'admin123' // Você precisará usar a senha correta
      });

      if (authError2) {
        console.log('❌ Erro de autenticação com admin@sistema.com:', authError2.message);
        console.log('Testando sem autenticação (simulando chamada da API)...');
        
        // Testar a função checkSuperAdmin diretamente
        await testCheckSuperAdminFunction();
        return;
      }
    }

    const user = authData?.user || authData2?.user;
    if (!user) {
      console.log('❌ Não foi possível autenticar');
      return;
    }

    console.log(`✅ Autenticado como: ${user.email}`);

    // Testar a API de deleção
    const userIdToDelete = '9eceeafc-9a92-4287-9b30-2bd05487cac8'; // ID do usuário teste@exemplo.co
    
    const response = await fetch('http://localhost:3000/api/admin/users/' + userIdToDelete, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabase.auth.session()?.access_token}`
      }
    });

    console.log(`Status da resposta: ${response.status}`);
    const responseData = await response.text();
    console.log('Resposta:', responseData);

  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

async function testCheckSuperAdminFunction() {
  console.log('\n🔍 Testando função checkSuperAdmin...');
  
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey);

  // Testar com usuários conhecidos
  const testUsers = [
    { id: '980d1d5f-6bca-4d3f-b756-0fc0999b7658', email: 'lenine.engrene@gmail.com' },
    { id: '5522b698-f20d-4669-853c-cac60e5f7edf', email: 'admin@sistema.com' },
    { id: '9eceeafc-9a92-4287-9b30-2bd05487cac8', email: 'teste@exemplo.co' }
  ];

  for (const testUser of testUsers) {
    console.log(`\nTestando usuário: ${testUser.email}`);
    
    const { data: memberships } = await serviceSupabase
      .from("memberships")
      .select(`
        role,
        role_id,
        user_roles (
          name
        )
      `)
      .eq("user_id", testUser.id)
      .eq("status", "active");

    console.log('Memberships encontradas:', memberships);

    if (!memberships || memberships.length === 0) {
      console.log('❌ Não é super admin (sem memberships)');
      continue;
    }

    const isSuperAdmin = memberships.some(membership => 
      membership.role === 'super_admin' || 
      membership.user_roles?.name === 'super_admin'
    );

    console.log(`${isSuperAdmin ? '✅' : '❌'} É super admin: ${isSuperAdmin}`);
  }
}

testUserDeletion();