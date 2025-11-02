require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔧 Verificando configurações do Supabase...');
console.log('===============================================');

console.log('\n📋 Variáveis de ambiente:');
console.log('URL:', supabaseUrl);
console.log('Anon Key:', supabaseKey ? `${supabaseKey.substring(0, 20)}...` : 'Não definida');
console.log('Service Key:', serviceKey ? `${serviceKey.substring(0, 20)}...` : 'Não definida');

// Testar com service role key
if (serviceKey) {
  console.log('\n🔑 Testando com Service Role Key...');
  
  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  async function testarAdmin() {
    try {
      // Tentar listar usuários com service key
      const { data: users, error } = await supabaseAdmin.auth.admin.listUsers();
      
      if (error) {
        console.log('❌ Erro ao listar usuários com service key:', error.message);
      } else {
        console.log(`✅ Service key funcionando! Usuários encontrados: ${users.users.length}`);
        
        if (users.users.length > 0) {
          console.log('\n👥 Usuários no sistema:');
          users.users.forEach((user, index) => {
            console.log(`  ${index + 1}. ${user.email} (ID: ${user.id.substring(0, 8)}...)`);
            console.log(`     Confirmado: ${user.email_confirmed_at ? 'Sim' : 'Não'}`);
            console.log(`     Criado em: ${new Date(user.created_at).toLocaleString('pt-BR')}`);
          });
        }
        
        // Tentar criar um usuário de teste
        console.log('\n🆕 Tentando criar usuário de teste com service key...');
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: 'admin@sistema.com',
          password: 'admin123456',
          email_confirm: true
        });
        
        if (createError) {
          if (createError.message.includes('already registered')) {
            console.log('✅ Usuário admin@sistema.com já existe');
          } else {
            console.log('❌ Erro ao criar usuário:', createError.message);
          }
        } else {
          console.log('✅ Usuário criado com sucesso!');
          console.log('📧 Email:', newUser.user.email);
          console.log('🆔 ID:', newUser.user.id);
        }
      }
      
    } catch (error) {
      console.log('❌ Erro inesperado:', error.message);
    }
  }
  
  testarAdmin().then(() => {
    console.log('\n✅ Verificação concluída');
  }).catch(err => {
    console.log('❌ Erro na verificação:', err.message);
  });
} else {
  console.log('❌ Service Role Key não encontrada');
  console.log('\n✅ Verificação concluída');
}