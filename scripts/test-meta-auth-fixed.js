const https = require('https');

console.log('🔍 Testando API Meta Auth após reinicialização...\n');

async function testMetaAuthAPI() {
  return new Promise((resolve, reject) => {
    const testClientId = 'test-client-123';
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: `/api/meta/auth?clientId=${testClientId}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Ignorar certificados SSL para localhost
      rejectUnauthorized: false
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log('✅ Status:', res.statusCode);
          console.log('✅ Response:', JSON.stringify(response, null, 2));
          
          if (response.authUrl) {
            console.log('\n🎉 SUCESSO! A API Meta Auth está funcionando!');
            console.log('🔗 URL de autorização gerada:', response.authUrl.substring(0, 100) + '...');
          } else if (response.error) {
            console.log('\n❌ ERRO na API:', response.error);
          }
          
          resolve(response);
        } catch (error) {
          console.error('❌ Erro ao parsear resposta:', error.message);
          console.log('Raw response:', data);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      // Tentar com HTTP se HTTPS falhar
      if (error.code === 'ECONNREFUSED' || error.code === 'EPROTO') {
        console.log('⚠️  HTTPS falhou, tentando HTTP...');
        testWithHTTP(testClientId).then(resolve).catch(reject);
      } else {
        console.error('❌ Erro na requisição:', error.message);
        reject(error);
      }
    });

    req.end();
  });
}

function testWithHTTP(clientId) {
  const http = require('http');
  
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: `/api/meta/auth?clientId=${clientId}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log('✅ Status (HTTP):', res.statusCode);
          console.log('✅ Response (HTTP):', JSON.stringify(response, null, 2));
          
          if (response.authUrl) {
            console.log('\n🎉 SUCESSO! A API Meta Auth está funcionando!');
            console.log('🔗 URL de autorização gerada:', response.authUrl.substring(0, 100) + '...');
          } else if (response.error) {
            console.log('\n❌ ERRO na API:', response.error);
          }
          
          resolve(response);
        } catch (error) {
          console.error('❌ Erro ao parsear resposta:', error.message);
          console.log('Raw response:', data);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Erro na requisição HTTP:', error.message);
      reject(error);
    });

    req.end();
  });
}

// Executar teste
testMetaAuthAPI()
  .then(() => {
    console.log('\n✅ Teste concluído com sucesso!');
    console.log('\n📋 Próximos passos:');
    console.log('1. Acesse http://localhost:3000/dashboard');
    console.log('2. Vá para um cliente específico');
    console.log('3. Clique em "Conectar Meta Ads"');
    console.log('4. Verifique se o erro "Falha ao iniciar autenticação" foi resolvido');
  })
  .catch((error) => {
    console.error('\n❌ Teste falhou:', error.message);
    console.log('\n🔧 Possíveis soluções:');
    console.log('1. Verifique se o servidor está rodando em http://localhost:3000');
    console.log('2. Verifique se as variáveis META_* estão no arquivo .env');
    console.log('3. Reinicie o servidor: pnpm dev');
  });