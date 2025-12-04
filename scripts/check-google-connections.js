require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function checkConnections() {
  console.log('🔍 Verificando conexões do Google Ads...');
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // Buscar todas as conexões Google Ads
    const { data: connections, error } = await supabase
      .from('google_ads_connections')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Erro ao buscar conexões:', error);
      return;
    }

    console.log(`✅ Encontradas ${connections?.length || 0} conexões no total:`);
    
    if (connections && connections.length > 0) {
      connections.forEach((conn, index) => {
        console.log(`\n📊 Conexão ${index + 1}:`);
        console.log(`   ID: ${conn.id}`);
        console.log(`   Client ID: ${conn.client_id}`);
        console.log(`   Customer ID: ${conn.customer_id}`);
        console.log(`   Status: ${conn.status}`);
        console.log(`   Account Name: ${conn.account_name || 'N/A'}`);
        console.log(`   Currency: ${conn.currency || 'N/A'}`);
        console.log(`   Primary Customer ID: ${conn.primary_customer_id || 'N/A'}`);
        console.log(`   Última sincronização: ${conn.last_sync_at || 'Nunca'}`);
        console.log(`   Token expira em: ${conn.token_expires_at || 'N/A'}`);
        console.log(`   Data de criação: ${conn.created_at}`);
        console.log(`   Data de atualização: ${conn.updated_at}`);
      });
    } else {
      console.log('⚠️ Nenhuma conexão encontrada no banco de dados.');
    }

    // Verificar conexões por cliente
    console.log('\n🔍 Resumo por cliente:');
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name');

    if (clients) {
      for (const client of clients) {
        const { data: clientConnections } = await supabase
          .from('google_ads_connections')
          .select('*')
          .eq('client_id', client.id);

        const activeConnections = clientConnections?.filter(c => c.status === 'active') || [];
        const expiredConnections = clientConnections?.filter(c => c.status === 'expired') || [];
        
        console.log(`   ${client.name} (${client.id}):`);
        console.log(`     - Ativas: ${activeConnections.length}`);
        console.log(`     - Expiradas: ${expiredConnections.length}`);
        console.log(`     - Total: ${clientConnections?.length || 0}`);
      }
    }

    // Verificar campanhas por cliente
    console.log('\n📊 Campanhas por cliente:');
    for (const client of clients) {
      const { data: campaigns } = await supabase
        .from('google_ads_campaigns')
        .select('*')
        .eq('client_id', client.id);

      console.log(`   ${client.name}: ${campaigns?.length || 0} campanhas`);
    }

  } catch (error) {
    console.error('💥 Erro geral:', error);
  }
}

checkConnections();