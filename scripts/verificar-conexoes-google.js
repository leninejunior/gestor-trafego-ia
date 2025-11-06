/**
 * Verificar conexões Google existentes no banco
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verificarConexoes() {
  console.log('🔍 Verificando conexões Google no banco...\n');

  try {
    // Verificar todas as conexões Google
    const { data: connections, error } = await supabase
      .from('google_ads_connections')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Erro ao buscar conexões:', error);
      return;
    }

    console.log(`📊 Total de conexões encontradas: ${connections.length}\n`);

    if (connections.length === 0) {
      console.log('⚠️  Nenhuma conexão Google encontrada no banco!');
      console.log('   Isso explica por que a API retorna "Conexão não encontrada"');
      console.log('   Você precisa fazer uma nova conexão OAuth com o Google.');
      return;
    }

    connections.forEach((conn, index) => {
      console.log(`🔗 Conexão ${index + 1}:`);
      console.log(`   ID: ${conn.id}`);
      console.log(`   Client ID: ${conn.client_id}`);
      console.log(`   Customer ID: ${conn.customer_id}`);
      console.log(`   Status: ${conn.status}`);
      console.log(`   Tem access_token: ${!!conn.access_token}`);
      console.log(`   Tem refresh_token: ${!!conn.refresh_token}`);
      console.log(`   Expira em: ${conn.expires_at}`);
      console.log(`   Criado em: ${conn.created_at}`);
      console.log(`   Atualizado em: ${conn.updated_at}`);
      
      // Verificar se o token expirou
      if (conn.expires_at) {
        const expired = new Date(conn.expires_at) < new Date();
        console.log(`   Token expirado: ${expired ? '❌ SIM' : '✅ NÃO'}`);
      }
      
      console.log('');
    });

    // Mostrar a URL correta para testar
    if (connections.length > 0) {
      const firstConnection = connections[0];
      console.log('🌐 Para testar com uma conexão real, use:');
      console.log(`   http://localhost:3000/google/select-accounts?connectionId=${firstConnection.id}&clientId=${firstConnection.client_id}`);
    }

  } catch (error) {
    console.error('💥 Erro:', error);
  }
}

verificarConexoes().catch(console.error);