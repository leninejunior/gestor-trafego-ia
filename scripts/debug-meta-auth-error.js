const fs = require('fs');
const path = require('path');

console.log('🔍 Debugando erro de autenticação Meta...\n');

// 1. Verificar se o arquivo .env existe
const envPath = path.join(process.cwd(), '.env');
console.log('1. Verificando arquivo .env...');
console.log('   Caminho:', envPath);
console.log('   Existe:', fs.existsSync(envPath));

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  
  console.log('\n2. Variáveis Meta encontradas no .env:');
  lines.forEach(line => {
    if (line.includes('META_')) {
      console.log('   ✓', line.split('=')[0]);
    }
  });
}

// 2. Verificar se as variáveis estão sendo carregadas
console.log('\n3. Variáveis de ambiente no processo:');
console.log('   META_APP_ID:', process.env.META_APP_ID ? 'Configurado' : '❌ Não configurado');
console.log('   META_APP_SECRET:', process.env.META_APP_SECRET ? 'Configurado' : '❌ Não configurado');
console.log('   NEXT_PUBLIC_APP_URL:', process.env.NEXT_PUBLIC_APP_URL || '❌ Não configurado');

// 3. Testar a API de auth
console.log('\n4. Testando API Meta Auth...');

async function testMetaAuth() {
  try {
    // Simular uma requisição para a API
    const testClientId = 'test-client-123';
    const url = `http://localhost:3000/api/meta/auth?clientId=${testClientId}`;
    
    console.log('   URL de teste:', url);
    console.log('   ⚠️  Para testar completamente, inicie o servidor com: npm run dev');
    console.log('   ⚠️  E acesse a URL no navegador ou use curl');
    
  } catch (error) {
    console.error('   ❌ Erro:', error.message);
  }
}

testMetaAuth();

console.log('\n5. Próximos passos para resolver:');
console.log('   1. Verifique se o arquivo .env está na raiz do projeto');
console.log('   2. Reinicie o servidor de desenvolvimento (npm run dev)');
console.log('   3. Verifique se as variáveis META_* estão definidas');
console.log('   4. Teste a API diretamente no navegador');