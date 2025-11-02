const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('📧 CONFIRMANDO EMAIL DO USUÁRIO\n');

  // 1. Buscar usuário
  const { data: users } = await supabase.auth.admin.listUsers();
  const user = users.users.find(u => u.email === 'teste@exemplo.co');
  
  if (!user) {
    console.log('❌ Usuário não encontrado');
    return;
  }

  console.log(`👤 Usuário: ${user.email}`);
  console.log(`📧 Email confirmado: ${user.email_confirmed_at ? 'Sim' : 'Não'}`);

  // 2. Confirmar email
  if (!user.email_confirmed_at) {
    console.log('🔧 Confirmando email...');
    
    const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
      email_confirm: true
    });

    if (error) {
      console.error('❌ Erro ao confirmar email:', error);
    } else {
      console.log('✅ Email confirmado!');
    }
  }

  // 3. Resetar senha
  console.log('🔧 Resetando senha...');
  const { error: passwordError } = await supabase.auth.admin.updateUserById(user.id, {
    password: 'senha123'
  });

  if (passwordError) {
    console.error('❌ Erro ao resetar senha:', passwordError);
  } else {
    console.log('✅ Senha resetada para: senha123');
  }

  // 4. Testar login
  console.log('🧪 Testando login...');
  const testSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const { data: session, error: loginError } = await testSupabase.auth.signInWithPassword({
    email: 'teste@exemplo.co',
    password: 'senha123'
  });

  if (loginError) {
    console.error('❌ Erro no login:', loginError.message);
  } else {
    console.log('✅ Login funcionando!');
    console.log(`🎯 Session: ${session.user.email}`);
  }

  console.log('\n🚀 PRONTO! Agora você pode fazer login:');
  console.log('   Email: teste@exemplo.co');
  console.log('   Senha: senha123');
}

main().catch(console.error);