const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('🧪 TESTANDO DASHBOARD FINAL\n');

  // 1. Verificar usuário
  const { data: users } = await supabase.auth.admin.listUsers();
  const user = users.users[0];
  console.log(`👤 Usuário: ${user.email}`);

  // 2. Verificar membership
  const { data: membership } = await supabase
    .from('memberships')
    .select('*')
    .eq('user_id', user.id)
    .single();

  console.log(`🏢 Organização: ${membership ? 'Conectado' : 'Não conectado'}`);

  // 3. Verificar clientes
  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .eq('org_id', membership?.organization_id);

  console.log(`👥 Clientes: ${clients?.length || 0}`);

  // 4. Testar APIs principais
  console.log('\n🔧 Testando APIs...');

  const baseUrl = 'http://localhost:3000';
  
  try {
    // Simular login
    const { data: { session } } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: 'senha123' // Assumindo que a senha é essa
    });

    if (!session) {
      console.log('⚠️ Não foi possível fazer login para testar APIs');
      return;
    }

    const headers = {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    };

    // Testar API de organizações
    const orgResponse = await fetch(`${baseUrl}/api/organizations`, { headers });
    console.log(`📋 API Organizations: ${orgResponse.status}`);

    // Testar API de clientes
    const clientsResponse = await fetch(`${baseUrl}/api/clients`, { headers });
    console.log(`👥 API Clients: ${clientsResponse.status}`);

    // Testar API de statistics
    const statsResponse = await fetch(`${baseUrl}/api/feature-gate/statistics`, { headers });
    console.log(`📊 API Statistics: ${statsResponse.status}`);

  } catch (error) {
    console.log('⚠️ Erro ao testar APIs:', error.message);
  }

  console.log('\n✅ TESTE CONCLUÍDO!');
  console.log('\n🚀 Agora acesse http://localhost:3000 e faça login com:');
  console.log(`   Email: ${user.email}`);
  console.log('   Senha: senha123');
}

main().catch(console.error);