/**
 * Testar API de clientes com conexões Google
 */

async function testarAPIClientes() {
  console.log('🔍 Testando API de clientes com conexões Google...\n');

  try {
    const response = await fetch('http://localhost:3000/api/clients?includeGoogleConnections=true');
    const data = await response.json();
    
    console.log('Status:', response.status);
    console.log('Resposta completa:', JSON.stringify(data, null, 2));
    
    if (data.clients) {
      console.log(`\n📋 ${data.clients.length} clientes encontrados:`);
      
      data.clients.forEach((client, index) => {
        console.log(`\n${index + 1}. ${client.name} (${client.id})`);
        
        if (client.googleConnections && client.googleConnections.length > 0) {
          console.log(`   ✅ ${client.googleConnections.length} conexões Google:`);
          client.googleConnections.forEach((conn, connIndex) => {
            console.log(`      ${connIndex + 1}. Customer ID: ${conn.customer_id}`);
            console.log(`         Status: ${conn.status}`);
            console.log(`         Connection ID: ${conn.id}`);
          });
        } else {
          console.log('   ❌ Sem conexões Google');
        }
      });
    }

  } catch (error) {
    console.error('💥 Erro na requisição:', error.message);
  }
}

testarAPIClientes().catch(console.error);