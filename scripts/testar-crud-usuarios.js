const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testarCrudUsuarios() {
  try {
    console.log('🧪 TESTANDO CRUD DE USUÁRIOS');
    console.log('============================\n');

    // 1. Fazer login como super admin
    console.log('🔐 Fazendo login como super admin...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'admin@sistema.com',
      password: 'admin123456'
    });

    if (authError) {
      console.error('❌ Erro no login:', authError.message);
      return;
    }

    console.log('✅ Login realizado com sucesso');

    // 2. Testar API de listagem de usuários
    console.log('\n📋 Testando API de listagem de usuários...');
    const response1 = await fetch('http://localhost:3000/api/admin/users/simple', {
      headers: {
        'Authorization': `Bearer ${authData.session.access_token}`
      }
    });

    if (response1.ok) {
      const data1 = await response1.json();
      console.log('✅ API de listagem funcionando');
      console.log(`📊 Total de usuários: ${data1.users?.length || 0}`);
      
      if (data1.users && data1.users.length > 0) {
        const testUser = data1.users.find(u => u.email !== 'admin@sistema.com');
        if (testUser) {
          console.log(`🎯 Usuário de teste encontrado: ${testUser.email}`);
          
          // 3. Testar edição de usuário
          console.log('\n✏️ Testando edição de usuário...');
          const editResponse = await fetch(`http://localhost:3000/api/admin/users/${testUser.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authData.session.access_token}`
            },
            body: JSON.stringify({
              action: 'update_profile',
              firstName: 'Nome Editado',
              lastName: 'Sobrenome Editado',
              email: testUser.email
            })
          });

          if (editResponse.ok) {
            console.log('✅ Edição de usuário funcionando');
          } else {
            const editError = await editResponse.json();
            console.log('❌ Erro na edição:', editError.error);
          }

          // 4. Testar suspensão de usuário
          console.log('\n⏸️ Testando suspensão de usuário...');
          const suspendResponse = await fetch(`http://localhost:3000/api/admin/users/${testUser.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authData.session.access_token}`
            },
            body: JSON.stringify({
              action: 'suspend',
              reason: 'Teste de suspensão automática'
            })
          });

          if (suspendResponse.ok) {
            console.log('✅ Suspensão de usuário funcionando');
            
            // 5. Testar reativação de usuário
            console.log('\n▶️ Testando reativação de usuário...');
            const unsuspendResponse = await fetch(`http://localhost:3000/api/admin/users/${testUser.id}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authData.session.access_token}`
              },
              body: JSON.stringify({
                action: 'unsuspend'
              })
            });

            if (unsuspendResponse.ok) {
              console.log('✅ Reativação de usuário funcionando');
            } else {
              const unsuspendError = await unsuspendResponse.json();
              console.log('❌ Erro na reativação:', unsuspendError.error);
            }
          } else {
            const suspendError = await suspendResponse.json();
            console.log('❌ Erro na suspensão:', suspendError.error);
          }

          // 6. Testar visualização de detalhes do usuário
          console.log('\n👁️ Testando visualização de detalhes...');
          const detailsResponse = await fetch(`http://localhost:3000/api/admin/users/${testUser.id}`, {
            headers: {
              'Authorization': `Bearer ${authData.session.access_token}`
            }
          });

          if (detailsResponse.ok) {
            const detailsData = await detailsResponse.json();
            console.log('✅ Visualização de detalhes funcionando');
            console.log(`📋 Usuário: ${detailsData.user.first_name} ${detailsData.user.last_name}`);
            console.log(`📧 Email: ${detailsData.user.email}`);
            console.log(`🔒 Suspenso: ${detailsData.user.is_suspended ? 'Sim' : 'Não'}`);
          } else {
            const detailsError = await detailsResponse.json();
            console.log('❌ Erro nos detalhes:', detailsError.error);
          }

        } else {
          console.log('⚠️ Nenhum usuário de teste encontrado (apenas admin)');
        }
      }
    } else {
      const error1 = await response1.json();
      console.log('❌ Erro na API de listagem:', error1.error);
    }

    // 7. Logout
    await supabase.auth.signOut();
    console.log('\n🚪 Logout realizado');

    console.log('\n🎯 RESUMO DOS TESTES:');
    console.log('====================');
    console.log('✅ Se todos os testes passaram, o CRUD está funcionando');
    console.log('❌ Se há erros, verifique as permissões e o esquema do banco');
    console.log('\n📝 PRÓXIMO PASSO:');
    console.log('Acesse: http://localhost:3000/admin/users');
    console.log('Email: admin@sistema.com');
    console.log('Senha: admin123456');

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

testarCrudUsuarios();