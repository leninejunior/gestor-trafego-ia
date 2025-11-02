const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function resetarSenhaLenine() {
  console.log('🔧 Resetando senha do Lenine...\n');

  try {
    // Resetar senha do usuário
    const { data, error } = await supabase.auth.admin.updateUserById(
      'f7313dc4-e5e1-400b-ba3e-1fee686df937',
      {
        password: 'SuperAdmin123!'
      }
    );

    if (error) {
      console.log('❌ Erro ao resetar senha:', error.message);
      return;
    }

    console.log('✅ Senha resetada com sucesso!');
    console.log('📧 Email:', data.user.email);
    console.log('🔑 Nova senha: SuperAdmin123!');

    // Testar login com nova senha
    console.log('\n🔍 Testando login com nova senha...');
    
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'leninejunior@gmail.com',
      password: 'SuperAdmin123!'
    });

    if (authError) {
      console.log('❌ Erro no login:', authError.message);
    } else {
      console.log('✅ Login realizado com sucesso!');
      console.log('🎯 Token gerado:', authData.session.access_token.substring(0, 50) + '...');
      
      // Testar API
      console.log('\n📡 Testando API /api/organizations...');
      const response = await fetch('http://localhost:3000/api/organizations', {
        headers: {
          'Authorization': `Bearer ${authData.session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log(`Status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ API funcionando!');
        console.log('📊 Organizações:', data.organizations?.length || 0);
      } else {
        const error = await response.text();
        console.log('❌ Erro na API:', error);
      }
    }

  } catch (error) {
    console.log('❌ Erro geral:', error.message);
  }
}

resetarSenhaLenine();