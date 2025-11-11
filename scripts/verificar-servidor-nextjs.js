const http = require('http');

console.log('🔍 VERIFICANDO SERVIDOR NEXT.JS\n');

// Verificar se o servidor está rodando
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/health',
  method: 'GET',
  timeout: 5000
};

console.log('📡 Testando endpoint de health check...');

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('✅ Servidor respondeu!');
    console.log('Status:', res.statusCode);
    console.log('Headers:', res.headers);
    console.log('Body:', data);
    
    try {
      const json = JSON.parse(data);
      console.log('\n📊 HEALTH CHECK:');
      console.log(JSON.stringify(json, null, 2));
    } catch (e) {
      console.log('⚠️ Resposta não é JSON');
    }
  });
});

req.on('error', (error) => {
  console.error('❌ ERRO:', error.message);
  console.log('\n💡 O servidor Next.js está rodando?');
  console.log('Execute: pnpm dev');
});

req.on('timeout', () => {
  console.error('❌ TIMEOUT: Servidor não respondeu em 5 segundos');
  req.destroy();
});

req.end();
