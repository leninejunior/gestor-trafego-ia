/**
 * Teste rápido de sincronização Google Ads
 * Faz uma chamada real para o endpoint de sync
 */

require('dotenv').config();

async function testSync() {
  console.log('🔍 Testando sincronização Google Ads...\n');

  // Pegar o primeiro cliente com conexão ativa
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Buscar conexão ativa
  const { data: connections, error } = await supabase
    .from('google_ads_connections')
    .select('id, client_id, customer_id, status')
    .eq('status', 'active')
    .limit(1);

  if (error || !connections || connections.length === 0) {
    console.error('❌ Nenhuma conexão ativa encontrada');
    console.error('Erro:', error);
    return;
  }

  const connection = connections[0];
  console.log('✅ Conexão encontrada:', {
    connectionId: connection.id,
    clientId: connection.client_id,
    customerId: connection.customer_id,
  });

  // Fazer chamada para o endpoint de sync
  console.log('\n📡 Chamando endpoint de sync...\n');

  try {
    const response = await fetch('http://localhost:3000/api/google/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clientId: connection.client_id,
        connectionId: connection.id,
        syncType: 'campaigns',
        fullSync: false,
      }),
    });

    const data = await response.json();

    console.log('📊 Resposta do servidor:');
    console.log('Status:', response.status);
    console.log('Dados:', JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log('\n✅ Sincronização iniciada com sucesso!');
    } else {
      console.log('\n❌ Erro na sincronização');
    }
  } catch (error) {
    console.error('\n❌ Erro ao chamar API:', error.message);
  }
}

testSync().catch(console.error);
