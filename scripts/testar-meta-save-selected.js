/**
 * Script para testar a API save-selected
 */

const http = require('http');

console.log('🧪 Testando API /api/meta/save-selected...\n');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/meta/save-selected',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  }
};

const testData = JSON.stringify({
  client_id: 'test-client-id',
  access_token: 'test-token',
  selected_accounts: ['123456789'],
  ad_accounts: [{ id: '123456789', name: 'Test Account' }]
});

const req = http.request(options, (res) => {
  console.log(`📡 Status: ${res.statusCode}`);
  console.log(`📋 Headers:`, res.headers);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('\n📦 Resposta:');
    try {
      const json = JSON.parse(data);
      console.log(JSON.stringify(json, null, 2));
    } catch (e) {
      console.log(data);
    }
    
    console.log('\n' + '='.repeat(50));
    if (res.statusCode === 404) {
      console.log('❌ ERRO 404: Rota não encontrada');
      console.log('\n💡 Solução:');
      console.log('1. Execute: scripts\\reiniciar-servidor-meta.bat');
      console.log('2. Ou manualmente:');
      console.log('   - Pare o servidor (Ctrl+C)');
      console.log('   - Limpe o cache: rmdir /s /q .next');
      console.log('   - Reinicie: npm run dev');
    } else if (res.statusCode === 400 || res.statusCode === 401) {
      console.log('✅ Rota encontrada! (erro esperado com dados de teste)');
    } else if (res.statusCode === 200) {
      console.log('✅ Rota funcionando perfeitamente!');
    } else {
      console.log(`⚠️ Status inesperado: ${res.statusCode}`);
    }
    console.log('='.repeat(50));
  });
});

req.on('error', (error) => {
  console.error('💥 Erro na requisição:', error.message);
  console.log('\n💡 Certifique-se de que o servidor está rodando:');
  console.log('   npm run dev');
});

req.write(testData);
req.end();
