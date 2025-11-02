require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('🧪 TESTANDO API /api/admin/users');
console.log('=================================');

const supabase = createClient(supabaseUrl, supabaseKey);

async function testarApiAdminUsers() {
  try {
    const emailLenine = 'lenine.engrene@gmail.com';
    
    // 1. Fazer login
    console.log('🔐 Fazendo login...');
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: emailLenine,
      password: 'senha123'
    });
    
    if (loginError) {
      console.log('❌ Erro no login:', loginError.message);
      return;
    }
    
    console.log('✅ Login realizado com sucesso!');
    console.log('🆔 User ID:', loginData.user.id);
    
    // 2. Testar APIs de usuários
    const apisToTest = [
      'http://localhost:3000/api/admin/users',
      'http://localhost:3000/api/admin/users/simple',
      'http://localhost:3000/api/admin/users/debug'
    ];
    
    for (const apiUrl of apisToTest) {
      console.log(`\n🌐 Testando ${apiUrl}...`);
      
      try {
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        console.log('📊 Status da resposta:', response.status);
        
        const responseText = await response.text();
        
        if (response.ok) {
          try {
            const data = JSON.parse(responseText);
            console.log('✅ API funcionou!');
            
            if (data.users) {
              console.log(`👥 Usuários encontrados: ${data.users.length}`);
            }
            
            if (data.stats) {
              console.log('📊 Estatísticas:', data.stats);
            }
            
            if (data.debug) {
              console.log('🔍 Debug info:', data.debug);
            }
            
            if (data.error) {
              console.log('⚠️  Erro reportado:', data.error);
            }
            
          } catch (parseError) {
            console.log('⚠️  Resposta não é JSON válido:', parseError.message);
            console.log('📄 Resposta:', responseText.substring(0, 200));
          }
        } else {
          console.log('❌ API retornou erro:', response.status);
          console.log('📄 Mensagem:', responseText.substring(0, 200));
        }
        
      } catch (fetchError) {
        console.log('❌ Erro na requisição:', fetchError.message);
      }
    }
    
    console.log('\n🎯 TESTE CONCLUÍDO!');
    
  } catch (error) {
    console.log('❌ Erro inesperado:', error.message);
  }
}

testarApiAdminUsers().catch(err => {
  console.log('❌ Erro na execução:', err.message);
});