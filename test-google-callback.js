// Script para testar o fluxo de callback do Google
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testCallback() {
  console.log('🔍 VERIFICANDO CONEXÕES GOOGLE PENDENTES...\n');
  
  // Buscar conexões pendentes
  const { data: connections, error } = await supabase
    .from('google_ads_connections')
    .select('*')
    .eq('customer_id', 'pending')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (error) {
    console.error('❌ Erro ao buscar conexões:', error);
    return;
  }
  
  console.log(`📊 Total de conexões pendentes: ${connections?.length || 0}\n`);
  
  if (connections && connections.length > 0) {
    connections.forEach((conn, index) => {
      console.log(`\n🔗 Conexão ${index + 1}:`);
      console.log(`   ID: ${conn.id}`);
      console.log(`   Client ID: ${conn.client_id}`);
      console.log(`   User ID: ${conn.user_id}`);
      console.log(`   Customer ID: ${conn.customer_id}`);
      console.log(`   Status: ${conn.status}`);
      console.log(`   Criado em: ${conn.created_at}`);
      console.log(`   Token expira em: ${conn.token_expires_at}`);
      console.log(`   Tem access_token: ${!!conn.access_token}`);
      console.log(`   Tem refresh_token: ${!!conn.refresh_token}`);
    });
    
    console.log('\n\n✅ CONEXÕES ENCONTRADAS!');
    console.log('📝 Para completar a conexão, acesse:');
    const firstConn = connections[0];
    console.log(`   http://localhost:3000/google/select-accounts?connectionId=${firstConn.id}&clientId=${firstConn.client_id}`);
  } else {
    console.log('ℹ️  Nenhuma conexão pendente encontrada.');
    console.log('💡 Isso significa que:');
    console.log('   1. O callback não está sendo executado corretamente');
    console.log('   2. Ou as conexões já foram completadas');
    console.log('   3. Ou houve erro na criação da conexão');
  }
  
  // Verificar oauth_states
  console.log('\n\n🔍 VERIFICANDO OAUTH STATES...\n');
  const { data: states, error: statesError } = await supabase
    .from('oauth_states')
    .select('*')
    .eq('provider', 'google')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (statesError) {
    console.error('❌ Erro ao buscar states:', statesError);
    return;
  }
  
  console.log(`📊 Total de states: ${states?.length || 0}\n`);
  
  if (states && states.length > 0) {
    states.forEach((state, index) => {
      const isExpired = new Date(state.expires_at) <= new Date();
      console.log(`\n🎫 State ${index + 1}:`);
      console.log(`   State: ${state.state}`);
      console.log(`   Client ID: ${state.client_id}`);
      console.log(`   User ID: ${state.user_id}`);
      console.log(`   Criado em: ${state.created_at}`);
      console.log(`   Expira em: ${state.expires_at}`);
      console.log(`   Status: ${isExpired ? '❌ EXPIRADO' : '✅ VÁLIDO'}`);
    });
  }
}

testCallback().catch(console.error);
