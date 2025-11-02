require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testarLoginExistente() {
  console.log('🔐 Testando login com usuários existentes...');
  
  // Usuários confirmados do sistema
  const usuariosParaTestar = [
    { email: 'admin@sistema.com', senha: 'admin123456' },
    { email: 'leninejunior@gmail.com', senha: 'senha123' },
    { email: 'lenine.engrene@gmail.com', senha: 'senha123' }
  ];
  
  for (const usuario of usuariosParaTestar) {
    console.log(`\n👤 Testando login: ${usuario.email}`);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: usuario.email,
        password: usuario.senha,
      });
      
      if (error) {
        console.log(`❌ Erro no login: ${error.message}`);
      } else {
        console.log(`✅ Login realizado com sucesso!`);
        console.log(`📧 Email: ${data.user.email}`);
        console.log(`🆔 ID: ${data.user.id}`);
        console.log(`🔑 Token: ${data.session.access_token.substring(0, 20)}...`);
        
        // Fazer logout para testar o próximo usuário
        await supabase.auth.signOut();
        console.log(`🚪 Logout realizado`);
        break; // Se conseguiu fazer login, não precisa testar os outros
      }
      
    } catch (error) {
      console.log(`❌ Erro inesperado: ${error.message}`);
    }
  }
}

testarLoginExistente().then(() => {
  console.log('\n✅ Teste de login concluído');
}).catch(err => {
  console.log('❌ Erro no teste:', err.message);
});