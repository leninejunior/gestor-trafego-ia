const http = require('http');

console.log('🔍 Teste Final - Google Auth após reinicialização completa...\n');

async function testGoogleAuthWithAuth() {
  return new Promise((resolve, reject) => {
    // Testar com um UUID válido para evitar erro de validação
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

    console.log('📡 Testando API Google Auth (POST)...');
    console.log('   Client ID:', validClientId);

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
            
            // Analisar diferentes cenários
            if (res.statusCode === 503) {
              if (response.configured === false) {
                console.log('\n❌ PROBLEMA: Google Ads não configurado no servidor');
                console.log('   - As variáveis GOOGLE_* não estão válidas no servidor Next.js');
                console.log('   - Ou contêm valores placeholder');
              }
            } else if (res.statusCode === 401) {
              console.log('\n⚠️  ESPERADO: Usuário não autenticado');
              console.log('   - Este erro é normal quando não há usuário logado');
              console.log('   - O importante é que o servidor está processando a requisição');
            } else if (res.statusCode === 400) {
              console.log('\n⚠️  Erro de validação (normal para teste)');
            } else if (response.authUrl) {
              console.log('\n🎉 SUCESSO! Google Auth funcionando!');
              console.log('🔗 URL gerada:', response.authUrl.substring(0, 100) + '...');
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

async function testGoogleAuthGET() {
  return new Promise((resolve, reject) => {
    const validClientId = '550e8400-e29b-41d4-a716-446655440000';
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: `/api/google/auth?clientId=${validClientId}`,
      method: 'GET',
    };

    console.log('\n📡 Testando API Google Auth (GET)...');

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
            
            if (res.statusCode === 503) {
              console.log('\n❌ CONFIRMADO: Google Ads não configurado');
              console.log('   - Servidor Next.js não consegue acessar as variáveis GOOGLE_*');
            } else if (response.configured === true) {
              console.log('\n🎉 CONFIGURAÇÃO OK: Google Ads configurado no servidor!');
            }
          }
          
          resolve(response || {});
        } catch (error) {
          console.error('❌ Erro ao parsear resposta GET:', error.message);
          console.log('Raw response:', data);
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

async function runFinalTest() {
  try {
    console.log('🎯 OBJETIVO: Verificar se o erro "Falha ao iniciar autenticação" foi resolvido\n');
    
    await testGoogleAuthWithAuth();
    await testGoogleAuthGET();
    
    console.log('\n📊 ANÁLISE DOS RESULTADOS:');
    console.log('');
    console.log('✅ SE Status 401 "Não autorizado":');
    console.log('   - Normal quando não há usuário logado');
    console.log('   - Indica que o servidor está processando corretamente');
    console.log('   - Solução: Fazer login no sistema primeiro');
    console.log('');
    console.log('❌ SE Status 503 "Google Ads não configurado":');
    console.log('   - Variáveis GOOGLE_* não estão sendo carregadas');
    console.log('   - Necessário verificar arquivo .env');
    console.log('   - Pode precisar reiniciar servidor novamente');
    console.log('');
    console.log('🎉 SE authUrl presente:');
    console.log('   - Google Auth funcionando perfeitamente!');
    console.log('   - Erro "Falha ao iniciar autenticação" resolvido');
    console.log('');
    console.log('📋 PRÓXIMOS PASSOS:');
    console.log('1. Acesse http://localhost:3000/dashboard');
    console.log('2. Faça login no sistema');
    console.log('3. Vá para um cliente específico');
    console.log('4. Clique em "Conectar Google Ads"');
    console.log('5. Verifique se o erro foi resolvido');
    
  } catch (error) {
    console.error('\n❌ Teste falhou:', error.message);
  }
}

runFinalTest();