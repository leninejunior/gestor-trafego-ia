const http = require('http');

console.log('🔍 Debugando erro 403 (Forbidden) - Google Auth...\n');

async function testGoogleAuth403() {
  return new Promise((resolve, reject) => {
    // Usar um UUID válido para evitar erro de validação
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

    console.log('📡 Testando API Google Auth (POST) - Investigando 403...');
    console.log('   Client ID:', validClientId);

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          console.log('✅ Status:', res.statusCode);
          console.log('✅ Headers:', JSON.stringify(res.headers, null, 2));
          
          if (data) {
            const response = JSON.parse(data);
            console.log('✅ Response:', JSON.stringify(response, null, 2));
            
            // Analisar diferentes cenários de erro 403
            if (res.statusCode === 403) {
              console.log('\n❌ ERRO 403 DETECTADO:');
              
              if (response.error === 'Acesso negado ao cliente especificado') {
                console.log('   - Problema: Cliente não pertence à organização do usuário');
                console.log('   - Causa: RLS (Row Level Security) bloqueando acesso');
                console.log('   - Solução: Verificar se o cliente existe e pertence ao usuário logado');
              } else if (response.error === 'Usuário não possui organização') {
                console.log('   - Problema: Usuário não tem organização associada');
                console.log('   - Causa: Tabela organization_memberships vazia ou incorreta');
                console.log('   - Solução: Criar membership para o usuário');
              } else if (response.error.includes('Não autorizado')) {
                console.log('   - Problema: Usuário não está autenticado');
                console.log('   - Causa: Token de sessão inválido ou expirado');
                console.log('   - Solução: Fazer login novamente');
              } else {
                console.log('   - Erro genérico 403:', response.error);
              }
            } else if (res.statusCode === 401) {
              console.log('\n⚠️  Status 401: Usuário não autenticado (esperado)');
            } else if (res.statusCode === 400) {
              console.log('\n⚠️  Status 400: Erro de validação');
              console.log('   - Pode ser UUID inválido ou dados malformados');
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

async function testWithRealClientId() {
  return new Promise((resolve, reject) => {
    // Primeiro, vamos tentar obter um cliente real da API
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/clients',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    };

    console.log('\n📡 Tentando obter clientes reais...');

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          console.log('✅ Status API Clients:', res.statusCode);
          
          if (res.statusCode === 200 && data) {
            const clients = JSON.parse(data);
            console.log('✅ Clientes encontrados:', clients.length || 0);
            
            if (clients.length > 0) {
              const firstClient = clients[0];
              console.log('✅ Primeiro cliente:', firstClient.id);
              
              // Agora testar com cliente real
              testGoogleAuthWithRealClient(firstClient.id);
            } else {
              console.log('⚠️  Nenhum cliente encontrado');
            }
          } else {
            console.log('❌ Erro ao obter clientes:', res.statusCode);
            if (data) {
              const response = JSON.parse(data);
              console.log('   Erro:', response.error);
            }
          }
          
          resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null });
        } catch (error) {
          console.error('❌ Erro ao parsear resposta de clientes:', error.message);
          resolve({ status: res.statusCode, error: error.message });
        }
      });
    });

    req.on('error', (error) => {
      console.log('⚠️  API Clients não disponível (normal se não logado)');
      resolve({ status: 0, error: error.message });
    });

    req.end();
  });
}

async function testGoogleAuthWithRealClient(clientId) {
  console.log(`\n📡 Testando Google Auth com cliente real: ${clientId}`);
  
  const testData = JSON.stringify({
    clientId: clientId,
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

  const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      try {
        console.log('✅ Status com cliente real:', res.statusCode);
        
        if (data) {
          const response = JSON.parse(data);
          console.log('✅ Response com cliente real:', JSON.stringify(response, null, 2));
        }
      } catch (error) {
        console.error('❌ Erro ao parsear resposta com cliente real:', error.message);
      }
    });
  });

  req.on('error', (error) => {
    console.error('❌ Erro na requisição com cliente real:', error.message);
  });

  req.write(testData);
  req.end();
}

async function runDiagnostic() {
  try {
    console.log('🎯 OBJETIVO: Entender por que a API Google Auth retorna 403 Forbidden\n');
    
    await testGoogleAuth403();
    await testWithRealClientId();
    
    console.log('\n📊 ANÁLISE DO ERRO 403:');
    console.log('');
    console.log('O erro 403 (Forbidden) indica que:');
    console.log('1. O usuário está autenticado (não é 401)');
    console.log('2. Mas não tem permissão para acessar o recurso');
    console.log('3. Pode ser problema de RLS (Row Level Security)');
    console.log('4. Ou cliente não pertence à organização do usuário');
    console.log('');
    console.log('🔧 POSSÍVEIS SOLUÇÕES:');
    console.log('1. Verificar se o usuário tem organização associada');
    console.log('2. Verificar se o cliente pertence à organização do usuário');
    console.log('3. Verificar políticas RLS no banco de dados');
    console.log('4. Testar com um cliente real em vez de UUID fictício');
    console.log('');
    console.log('📋 PRÓXIMOS PASSOS:');
    console.log('1. Fazer login no sistema');
    console.log('2. Ir para um cliente real no dashboard');
    console.log('3. Tentar conectar Google Ads novamente');
    console.log('4. Se persistir, verificar logs do servidor');
    
  } catch (error) {
    console.error('\n❌ Diagnóstico falhou:', error.message);
  }
}

runDiagnostic();