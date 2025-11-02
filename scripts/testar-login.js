require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testarLogin() {
  console.log('🔐 Testando sistema de login...');
  
  console.log('💡 Pulando verificação de usuários (sem permissões de admin)');
  
  // Testar criação de usuário de teste (se necessário)
  console.log('\n🆕 Tentando criar usuário de teste...');
  
  const testEmail = 'lenine@example.com';
  const testPassword = 'senha123';
  
  try {
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
    });
    
    if (error) {
      if (error.message.includes('already registered')) {
        console.log('✅ Usuário de teste já existe');
        
        // Tentar fazer login
        console.log('🔑 Tentando fazer login...');
        const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
          email: testEmail,
          password: testPassword,
        });
        
        if (loginError) {
          console.log('❌ Erro no login:', loginError.message);
        } else {
          console.log('✅ Login realizado com sucesso!');
          console.log('👤 Usuário logado:', loginData.user.email);
        }
      } else {
        console.log('❌ Erro ao criar usuário:', error.message);
      }
    } else {
      console.log('✅ Usuário de teste criado com sucesso');
      console.log('📧 Verifique o email para confirmação');
    }
    
  } catch (error) {
    console.log('❌ Erro inesperado:', error.message);
  }
}

testarLogin().then(() => {
  console.log('\n✅ Teste de login concluído');
}).catch(err => {
  console.log('❌ Erro no teste:', err.message);
});