const http = require('http');

console.log('🔍 Verificação Final - Google Auth\n');

function testAPI(method, path, data = null) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (data) {
      options.headers['Content-Length'] = Buffer.byteLength(data);
    }

    const req = http.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = responseData ? JSON.parse(responseData) : {};
          resolve({ status: res.statusCode, data: parsed });
        } catch (error) {
          resolve({ status: res.statusCode, data: responseData, error: error.message });
        }
      });
    });

    req.on('error', (error) => {
      resolve({ status: 0, error: error.message });
    });

    if (data) {
      req.write(data);
    }
    req.end();
  });
}

async function runVerification() {
  console.log('📡 Testando API Google Auth...');
  
  // Teste GET simples
  const getResult = await testAPI('GET', '/api/google/auth?clientId=550e8400-e29b-41d4-a716-446655440000');
  
  console.log('✅ Resultado GET:');
  console.log('   Status:', getResult.status);
  console.log('   Data:', JSON.stringify(getResult.data, null, 2));
  
  // Análise do resultado
  console.log('\n📊 ANÁLISE:');
  
  if (getResult.status === 503) {
    console.log('❌ PROBLEMA: Google Ads não configurado');
    console.log('   - As variáveis GOOGLE_* não estão sendo carregadas');
    console.log('   - Verifique o arquivo .env');
    console.log('   - Reinicie o servidor completamente');
  } else if (getResult.status === 401) {
    console.log('✅ CONFIGURAÇÃO OK: Google Ads configurado!');
    console.log('   - Erro 401 é esperado (usuário não logado)');
    console.log('   - As variáveis GOOGLE_* estão carregadas');
    console.log('   - O erro "Falha ao iniciar autenticação" deve estar resolvido');
  } else if (getResult.status === 200 && getResult.data.authUrl) {
    console.log('🎉 PERFEITO: Google Auth funcionando 100%!');
    console.log('   - URL de autorização gerada com sucesso');
    console.log('   - Sistema totalmente funcional');
  } else {
    console.log('⚠️  Status inesperado:', getResult.status);
    console.log('   - Pode indicar outro problema');
  }
  
  console.log('\n🎯 CONCLUSÃO:');
  if (getResult.status === 401) {
    console.log('✅ O erro "Falha ao iniciar autenticação" foi RESOLVIDO!');
    console.log('');
    console.log('📋 Para testar completamente:');
    console.log('1. Acesse: http://localhost:3000/dashboard');
    console.log('2. Faça login no sistema');
    console.log('3. Vá para um cliente');
    console.log('4. Clique em "Conectar Google Ads"');
    console.log('5. Você deve ser redirecionado para o Google (sem erro)');
  } else if (getResult.status === 503) {
    console.log('❌ O problema ainda persiste');
    console.log('   - Variáveis de ambiente não carregadas');
    console.log('   - Necessário investigar mais');
  }
}

runVerification();