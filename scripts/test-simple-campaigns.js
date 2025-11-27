/**
 * Teste simples para verificar se a API de campanhas está funcionando
 * Usa fetch direto para testar o endpoint
 */

require('dotenv').config();

async function testSimpleCampaigns() {
  console.log('🔧 Testando API de campanhas (simples)...\n');

  try {
    const { default: fetch } = require('node-fetch');
    
    // Testar health check primeiro
    console.log('1️⃣ Testando health check...');
    const healthResponse = await fetch('http://localhost:3000/api/google/health');
    
    if (healthResponse.ok) {
      const health = await healthResponse.json();
      console.log('✅ Health check OK:', health.status);
    } else {
      console.log('⚠️ Health check falhou:', healthResponse.status);
    }

    // Buscar conexões ativas
    console.log('\n2️⃣ Buscando conexões ativas...');
    const connectionsResponse = await fetch('http://localhost:3000/api/google/connections', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!connectionsResponse.ok) {
      console.error('❌ Erro ao buscar conexões:', connectionsResponse.status);
      return;
    }

    const connections = await connectionsResponse.json();
    console.log('✅ Conexões encontradas:', connections.length);

    if (connections.length === 0) {
      console.log('⚠️ Nenhuma conexão ativa encontrada');
      return;
    }

    const connection = connections[0];
    console.log('📋 Usando conexão:', {
      id: connection.id,
      customer_id: connection.customer_id,
      status: connection.status
    });

    // Testar API de campanhas
    console.log('\n3️⃣ Testando API de campanhas...');
    const campaignsResponse = await fetch(`http://localhost:3000/api/google/test-campaigns?connectionId=${connection.id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('📊 Status da resposta:', {
      status: campaignsResponse.status,
      ok: campaignsResponse.ok
    });

    const campaignsData = await campaignsResponse.json();

    if (campaignsResponse.ok) {
      console.log('\n✅ SUCESSO NA API DE CAMPANHAS!');
      console.log(`- Campanhas encontradas: ${campaignsData.campaignsCount || 0}`);
      
      if (campaignsData.campaigns && campaignsData.campaigns.length > 0) {
        console.log('- Primeira campanha:', {
          id: campaignsData.campaigns[0].id,
          name: campaignsData.campaigns[0].name,
          status: campaignsData.campaigns[0].status,
          impressions: campaignsData.campaigns[0].impressions,
          clicks: campaignsData.campaigns[0].clicks,
          cost: campaignsData.campaigns[0].cost
        });
      }
    } else {
      console.log('\n❌ ERRO NA API DE CAMPANHAS:');
      console.log('- Mensagem:', campaignsData.error || campaignsData.message);
      if (campaignsData.stack) {
        console.log('- Stack (primeiras 500 chars):', campaignsData.stack.substring(0, 500));
      }
    }

    // Testar API regular de campanhas
    console.log('\n4️⃣ Testando API regular de campanhas...');
    const regularCampaignsResponse = await fetch(`http://localhost:3000/api/google/campaigns?clientId=${connection.client_id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const regularData = await regularCampaignsResponse.json();

    if (regularCampaignsResponse.ok) {
      console.log('\n✅ SUCESSO NA API REGULAR!');
      console.log(`- Campanhas no banco: ${regularData.count || 0}`);
    } else {
      console.log('\n❌ ERRO NA API REGULAR:');
      console.log('- Mensagem:', regularData.error || regularData.message);
    }

  } catch (error) {
    console.error('\n❌ ERRO GERAL:');
    console.error('Mensagem:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 O servidor não está rodando. Inicie com: npm run dev');
    }
  }
}

// Executar teste
testSimpleCampaigns();