const http = require('http');

console.log('🔍 Testando variáveis de ambiente no servidor Next.js...\n');

// Criar uma API de teste temporária para verificar as variáveis
async function testServerEnvironment() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/debug/check-table-schema', // Usar uma API existente
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    };

    console.log('📡 Testando se o servidor está respondendo...');

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log('✅ Servidor respondeu com status:', res.statusCode);
        
        if (res.statusCode === 200) {
          console.log('✅ Servidor Next.js está funcionando');
        }
        
        resolve({ status: res.statusCode, data });
      });
    });

    req.on('error', (error) => {
      console.error('❌ Erro ao conectar com servidor:', error.message);
      reject(error);
    });

    req.end();
  });
}

// Testar uma API que não requer autenticação
async function testPublicAPI() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/health', // API de health check se existir
      method: 'GET',
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log('📊 Health check status:', res.statusCode);
        resolve({ status: res.statusCode, data });
      });
    });

    req.on('error', (error) => {
      console.log('⚠️  Health API não disponível (normal)');
      resolve({ status: 404, error: error.message });
    });

    req.end();
  });
}

async function runDiagnostic() {
  console.log('🔍 DIAGNÓSTICO COMPLETO DO PROBLEMA:\n');
  
  console.log('1. Variáveis de ambiente no processo Node.js atual:');
  console.log('   GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'Configurado' : '❌ Não configurado');
  console.log('   GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? 'Configurado' : '❌ Não configurado');
  console.log('   GOOGLE_DEVELOPER_TOKEN:', process.env.GOOGLE_DEVELOPER_TOKEN ? 'Configurado' : '❌ Não configurado');
  console.log('   NEXT_PUBLIC_APP_URL:', process.env.NEXT_PUBLIC_APP_URL || '❌ Não configurado');
  
  console.log('\n2. Testando conectividade com servidor Next.js:');
  try {
    await testServerEnvironment();
    await testPublicAPI();
  } catch (error) {
    console.error('❌ Erro ao testar servidor:', error.message);
  }
  
  console.log('\n📋 ANÁLISE DO PROBLEMA:');
  console.log('');
  console.log('O erro "Falha ao iniciar autenticação" no Google Ads pode ter as seguintes causas:');
  console.log('');
  console.log('✅ CAUSA MAIS PROVÁVEL:');
  console.log('   - As variáveis GOOGLE_* não estão sendo carregadas no servidor Next.js');
  console.log('   - Mesmo que estejam no arquivo .env, o servidor não as está lendo');
  console.log('');
  console.log('🔧 SOLUÇÕES RECOMENDADAS:');
  console.log('');
  console.log('1. REINICIAR SERVIDOR COMPLETAMENTE:');
  console.log('   - Pare o servidor: Ctrl+C');
  console.log('   - Aguarde alguns segundos');
  console.log('   - Inicie novamente: pnpm dev');
  console.log('');
  console.log('2. VERIFICAR ARQUIVO .env:');
  console.log('   - Confirme que está na raiz do projeto');
  console.log('   - Verifique se não há espaços extras nas variáveis');
  console.log('   - Confirme que as variáveis não contêm "your_" ou placeholders');
  console.log('');
  console.log('3. TESTAR AUTENTICAÇÃO:');
  console.log('   - Faça login no sistema primeiro');
  console.log('   - Vá para um cliente específico');
  console.log('   - Tente conectar Google Ads novamente');
  console.log('');
  console.log('4. SE O PROBLEMA PERSISTIR:');
  console.log('   - Verifique os logs do servidor no terminal');
  console.log('   - Procure por erros relacionados a "Google" ou "OAuth"');
  console.log('   - Verifique se a tabela oauth_states existe no banco');
}

runDiagnostic();