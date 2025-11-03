const { default: fetch } = require('node-fetch');

async function testEndpoint(url, description) {
  try {
    console.log(`\n🔍 Testando: ${description}`);
    console.log(`📡 URL: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    
    const data = await response.text();
    
    if (response.ok) {
      try {
        const jsonData = JSON.parse(data);
        console.log('✅ Resposta JSON válida');
        console.log('📋 Dados:', JSON.stringify(jsonData, null, 2).substring(0, 500) + '...');
      } catch (e) {
        console.log('⚠️ Resposta não é JSON válido');
        console.log('📋 Resposta:', data.substring(0, 200) + '...');
      }
    } else {
      console.log('❌ Erro na resposta');
      console.log('📋 Resposta:', data.substring(0, 200) + '...');
    }
    
  } catch (error) {
    console.log('❌ Erro na requisição:', error.message);
  }
}

async function main() {
  const baseUrl = 'http://localhost:3000';
  
  await testEndpoint(
    `${baseUrl}/api/admin/subscription-management/organizations`,
    'API de Organizações'
  );
  
  await testEndpoint(
    `${baseUrl}/api/admin/subscriptions/audit-history?limit=50`,
    'API de Histórico de Auditoria'
  );
  
  await testEndpoint(
    `${baseUrl}/api/admin/plans`,
    'API de Planos'
  );
}

main();