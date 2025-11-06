/**
 * Debug da query que busca conexões Google para clientes
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugQueryConexoes() {
  console.log('🔍 Debugando query de conexões Google...\n');

  try {
    // Primeiro, buscar todos os clientes
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name');

    if (clientsError) {
      console.error('❌ Erro ao buscar clientes:', clientsError);
      return;
    }

    console.log(`📋 ${clients.length} clientes encontrados:`);
    clients.forEach((client, index) => {
      console.log(`   ${index + 1}. ${client.name} (${client.id})`);
    });

    // Agora buscar todas as conexões Google
    console.log('\n🔗 Buscando todas as conexões Google...');
    const { data: allConnections, error: connectionsError } = await supabase
      .from('google_ads_connections')
      .select('*');

    if (connectionsError) {
      console.error('❌ Erro ao buscar conexões:', connectionsError);
      return;
    }

    console.log(`📋 ${allConnections.length} conexões encontradas:`);
    allConnections.forEach((conn, index) => {
      console.log(`   ${index + 1}. Client ID: ${conn.client_id}`);
      console.log(`      Connection ID: ${conn.id}`);
      console.log(`      Customer ID: ${conn.customer_id}`);
      console.log(`      Status: ${conn.status}`);
      console.log('');
    });

    // Testar a query específica para cada cliente
    console.log('🔍 Testando query específica para cada cliente...\n');
    
    for (const client of clients) {
      console.log(`🔍 Cliente: ${client.name} (${client.id})`);
      
      const { data: googleConnections, error: queryError } = await supabase
        .from('google_ads_connections')
        .select('id, customer_id, status')
        .eq('client_id', client.id);

      if (queryError) {
        console.error(`   ❌ Erro na query:`, queryError);
      } else {
        console.log(`   ✅ ${googleConnections.length} conexões encontradas:`);
        googleConnections.forEach((conn, index) => {
          console.log(`      ${index + 1}. Customer ID: ${conn.customer_id}, Status: ${conn.status}`);
        });
      }
      console.log('');
    }

  } catch (error) {
    console.error('💥 Erro:', error);
  }
}

debugQueryConexoes().catch(console.error);