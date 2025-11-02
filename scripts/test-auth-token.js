require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function testAuthToken() {
  try {
    console.log('🔍 Testando autenticação e token...\n');

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Tentar fazer login com um super admin
    console.log('Tentando login com lenine.engrene@gmail.com...');
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
        return;
      }
      
      console.log('✅ Autenticado como admin@sistema.com');
    } else {
      console.log('✅ Autenticado como lenine.engrene@gmail.com');
    }

    // Obter sessão atual
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
      console.log('✅ Sessão ativa encontrada');
      console.log('Token de acesso:', session.access_token.substring(0, 50) + '...');
      
      // Testar chamada para API com token
      console.log('\nTestando chamada para API com token...');
      
      const response = await fetch('http://localhost:3000/api/admin/users/simple', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      console.log(`Status da resposta: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ API respondeu com sucesso');
        console.log(`Usuários encontrados: ${data.users?.length || 0}`);
      } else {
        const errorText = await response.text();
        console.log('❌ Erro na API:', errorText);
      }
      
    } else {
      console.log('❌ Nenhuma sessão ativa');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

testAuthToken();