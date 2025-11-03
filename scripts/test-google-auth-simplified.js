const http = require('http');

console.log('🔧 Testando Google Auth Simplificada...\n');

async function testSimplifiedGoogleAuth() {
  return new Promise((resolve, reject) => {
    const validClientId = '550e8400-e29b-41d4-a716-446655440000';
    const testData = JSON.stringify({
      clientId: validClientId,
      redirectUri: 'http://localhost:3000/api/google/callback'
    });

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/google/auth',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(testData)
      }
    };

    console.log('📡 Testando API Google Auth simplificada (POST)...');
    console.log('   Removidas verificações de organização');
    console.log('   Usando mesmo padrão da Meta Auth');

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          console.log('✅ Status:', res.statusCode);
          
          if (data) {
            const response = JSON.parse(data);
            console.log('✅ Response:', JSON.stringify(response, null, 2));
            
            if (res.statusCode === 401) {
              console.log('\n⚠️  Status 401: Usuário não autenticado (esperado para teste)');
              console.log('   - Isso é normal quando testamos sem login');
              console.log('   - O importante é que não é mais 403!');
            } else if (res.statusCode === 200 && response.authUrl) {
              console.log('\n🎉 SUCESSO TOTAL! Google Auth funcionando!');
              console.log('   - URL de autorização gerada com sucesso');
              console.log('   - Erro 403 foi resolvido');
            } else if (res.statusCode === 503) {
              console.log('\n❌ Ainda há problema de configuração');
              console.log('   - Variáveis Google não carregadas');
            } else {
              console.log('\n⚠️  Status inesperado:', res.statusCode);
            }
          }
          
          resolve(response || {});
        } catch (error) {
          console.error('❌ Erro ao parsear resposta:', error.message);
          console.log('Raw response:', data);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Erro na requisição:', error.message);
      reject(error);
    });

    req.write(testData);
    req.end();
  });
}

async function testGETMethod() {
  return new Promise((resolve, reject) => {
    const validClientId = '550e8400-e29b-41d4-a716-446655440000';
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: `/api/google/auth?clientId=${validClientId}`,
      method: 'GET',
    };

    console.log('\n📡 Testando método GET também...');

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          console.log('✅ Status GET:', res.statusCode);
          
          if (data) {
            const response = JSON.parse(data);
            console.log('✅ Response GET:', JSON.stringify(response, null, 2));
          }
          
          resolve(response || {});
        } catch (error) {
          console.error('❌ Erro ao parsear resposta GET:', error.message);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Erro na requisição GET:', error.message);
      reject(error);
    });

    req.end();
  });
}

async function runTest() {
  try {
    console.log('🎯 OBJETIVO: Verificar se a simplificação resolveu o erro 403\n');
    
    await testSimplifiedGoogleAuth();
    await testGETMethod();
    
    console.log('\n📊 ANÁLISE DOS RESULTADOS:');
    console.log('');
    console.log('✅ SE Status 401 (em vez de 403):');
    console.log('   - SUCESSO! O erro 403 foi resolvido');
    console.log('   - Problema era nas verificações de organização');
    console.log('   - Agora funciona igual ao Meta Auth');
    console.log('');
    console.log('❌ SE ainda Status 403:');
    console.log('   - Problema pode ser em outro lugar');
    console.log('   - Necessário investigação mais profunda');
    console.log('');
    console.log('🎉 SE Status 200 com authUrl:');
    console.log('   - PERFEITO! Sistema totalmente funcional');
    console.log('   - Pode testar no navegador agora');
    console.log('');
    console.log('📋 PRÓXIMOS PASSOS:');
    console.log('1. Se funcionou: testar no navegador com usuário logado');
    console.log('2. Se ainda falha: investigar tabela oauth_states');
    console.log('3. Considerar alinhar Meta Auth com mesmas verificações');
    
  } catch (error) {
    console.error('\n❌ Teste falhou:', error.message);
  }
}

runTest();