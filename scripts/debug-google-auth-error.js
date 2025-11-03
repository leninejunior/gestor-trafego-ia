const http = require('http');

console.log('🔍 Debugando erro de autenticação Google...\n');

async function testGoogleAuthAPI() {
  return new Promise((resolve, reject) => {
    const testClientId = 'test-client-123';
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: `/api/google/auth?clientId=${testClientId}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    };

    console.log('📡 Testando API Google Auth...');
    console.log('   URL:', `http://localhost:3000${options.path}`);

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          console.log('✅ Status:', res.statusCode);
          console.log('✅ Headers:', res.headers);
          
          if (data) {
            const response = JSON.parse(data);
            console.log('✅ Response:', JSON.stringify(response, null, 2));
            
            if (res.statusCode === 503) {
              console.log('\n❌ PROBLEMA IDENTIFICADO: Google Ads não configurado');
              console.log('   - As variáveis de ambiente não estão sendo carregadas corretamente');
              console.log('   - Ou as variáveis contêm valores placeholder');
            } else if (res.statusCode === 401) {
              console.log('\n❌ PROBLEMA IDENTIFICADO: Usuário não autenticado');
              console.log('   - É necessário fazer login primeiro');
            } else if (response.authUrl) {
              console.log('\n🎉 SUCESSO! A API Google Auth está funcionando!');
              console.log('🔗 URL de autorização gerada:', response.authUrl.substring(0, 100) + '...');
            } else if (response.error) {
              console.log('\n❌ ERRO na API:', response.error);
              if (response.message) {
                console.log('   Mensagem:', response.message);
              }
            }
          } else {
            console.log('❌ Resposta vazia');
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
      console.log('\n🔧 Possíveis soluções:');
      console.log('1. Verifique se o servidor está rodando: pnpm dev');
      console.log('2. Verifique se está acessível em http://localhost:3000');
      reject(error);
    });

    req.end();
  });
}

async function checkEnvironmentVariables() {
  console.log('\n🔍 Verificando variáveis de ambiente Google...');
  
  const requiredVars = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET', 
    'GOOGLE_DEVELOPER_TOKEN',
    'NEXT_PUBLIC_APP_URL'
  ];
  
  requiredVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      if (value.includes('your_') || value.includes('YOUR_')) {
        console.log(`   ❌ ${varName}: Contém placeholder (${value.substring(0, 20)}...)`);
      } else {
        console.log(`   ✅ ${varName}: Configurado`);
      }
    } else {
      console.log(`   ❌ ${varName}: Não configurado`);
    }
  });
}

async function testWithPOST() {
  return new Promise((resolve, reject) => {
    const testData = JSON.stringify({
      clientId: '550e8400-e29b-41d4-a716-446655440000', // UUID válido para teste
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

    console.log('\n📡 Testando API Google Auth com POST...');

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          console.log('✅ Status POST:', res.statusCode);
          
          if (data) {
            const response = JSON.parse(data);
            console.log('✅ Response POST:', JSON.stringify(response, null, 2));
            
            if (res.statusCode === 503 && !response.configured) {
              console.log('\n❌ CONFIRMADO: Google Ads não configurado');
              console.log('   - Servidor detectou que as credenciais não estão válidas');
            }
          }
          
          resolve(response || {});
        } catch (error) {
          console.error('❌ Erro ao parsear resposta POST:', error.message);
          console.log('Raw response:', data);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Erro na requisição POST:', error.message);
      reject(error);
    });

    req.write(testData);
    req.end();
  });
}

// Executar testes
async function runTests() {
  try {
    checkEnvironmentVariables();
    
    await testGoogleAuthAPI();
    await testWithPOST();
    
    console.log('\n📋 RESUMO DO DIAGNÓSTICO:');
    console.log('1. Se Status 503: Variáveis Google não configuradas ou contêm placeholders');
    console.log('2. Se Status 401: Usuário precisa fazer login primeiro');
    console.log('3. Se Status 500: Erro interno - verificar logs do servidor');
    console.log('4. Se authUrl presente: API funcionando corretamente');
    
    console.log('\n🔧 PRÓXIMOS PASSOS:');
    console.log('1. Verifique as variáveis GOOGLE_* no arquivo .env');
    console.log('2. Reinicie o servidor: pnpm dev');
    console.log('3. Faça login no sistema antes de tentar conectar Google Ads');
    console.log('4. Teste novamente no navegador');
    
  } catch (error) {
    console.error('\n❌ Teste falhou:', error.message);
  }
}

runTests();