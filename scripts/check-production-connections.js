/**
 * Verificar Conexões Google em Produção
 * Testa se existem conexões válidas no banco de dados
 */

const baseUrl = 'https://gestor.engrene.com';

async function checkProductionConnections() {
  console.log('🔍 VERIFICANDO CONEXÕES GOOGLE EM PRODUÇÃO');
  console.log('='.repeat(60));
  
  try {
    // 1. Testar com uma conexão que pode existir
    console.log('\n1️⃣ TESTANDO COM DIFERENTES PARÂMETROS...');
    
    const testCases = [
      // Caso 1: Parâmetros vazios
      { connectionId: '', clientId: '', desc: 'Parâmetros vazios' },
      
      // Caso 2: Parâmetros null
      { connectionId: 'null', clientId: 'null', desc: 'Parâmetros null' },
      
      // Caso 3: UUID válido mas inexistente
      { 
        connectionId: '00000000-0000-0000-0000-000000000000', 
        clientId: '00000000-0000-0000-0000-000000000000', 
        desc: 'UUIDs válidos mas inexistentes' 
      },
      
      // Caso 4: Sem parâmetros
      { connectionId: null, clientId: null, desc: 'Sem parâmetros' }
    ];
    
    for (const testCase of testCases) {
      console.log(`\n📋 Testando: ${testCase.desc}`);
      
      let url = `${baseUrl}/api/google/accounts`;
      const params = new URLSearchParams();
      
      if (testCase.connectionId !== null) {
        params.append('connectionId', testCase.connectionId);
      }
      if (testCase.clientId !== null) {
        params.append('clientId', testCase.clientId);
      }
      
      if (params.toString()) {
        url += '?' + params.toString();
      }
      
      console.log(`📡 URL: ${url}`);
      
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        const responseText = await response.text();
        console.log(`- Status: ${response.status}`);
        console.log(`- Response: ${responseText.substring(0, 200)}${responseText.length > 200 ? '...' : ''}`);
        
        // Tentar parsear como JSON
        try {
          const jsonResponse = JSON.parse(responseText);
          if (jsonResponse.error) {
            console.log(`- Erro: ${jsonResponse.error}`);
          }
          if (jsonResponse.message) {
            console.log(`- Mensagem: ${jsonResponse.message}`);
          }
        } catch (e) {
          // Não é JSON válido
        }
        
      } catch (error) {
        console.log(`- Erro na requisição: ${error.message}`);
      }
    }
    
    // 2. Testar outras APIs para verificar se o problema é geral
    console.log('\n2️⃣ TESTANDO OUTRAS APIs RELACIONADAS...');
    
    const otherApis = [
      '/api/google/auth',
      '/api/google/callback',
      '/api/google/disconnect',
      '/api/google/sync',
      '/api/google/campaigns'
    ];
    
    for (const api of otherApis) {
      try {
        const response = await fetch(`${baseUrl}${api}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        
        const responseText = await response.text();
        console.log(`- ${api}: ${response.status} - ${responseText.substring(0, 100)}${responseText.length > 100 ? '...' : ''}`);
        
      } catch (error) {
        console.log(`- ${api}: ERRO - ${error.message}`);
      }
    }
    
    // 3. Verificar se é problema de autenticação
    console.log('\n3️⃣ TESTANDO DIFERENTES MÉTODOS HTTP...');
    
    const methods = ['GET', 'POST', 'OPTIONS'];
    const testUrl = `${baseUrl}/api/google/accounts?connectionId=test&clientId=test`;
    
    for (const method of methods) {
      try {
        const response = await fetch(testUrl, {
          method: method,
          headers: {
            'Content-Type': 'application/json'
          },
          body: method === 'POST' ? JSON.stringify({ test: true }) : undefined
        });
        
        console.log(`- ${method}: ${response.status} ${response.statusText}`);
        
      } catch (error) {
        console.log(`- ${method}: ERRO - ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error);
    console.error('- Mensagem:', error.message);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🏁 VERIFICAÇÃO CONCLUÍDA');
  
  console.log('\n💡 PRÓXIMOS PASSOS:');
  console.log('1. Se todos os testes retornaram 404 com "Conexão não encontrada":');
  console.log('   - A API está funcionando corretamente');
  console.log('   - O problema é que não existem conexões no banco de dados');
  console.log('   - Usuário precisa fazer OAuth primeiro');
  console.log('');
  console.log('2. Se alguns testes retornaram 400 "Parâmetros obrigatórios":');
  console.log('   - A validação está funcionando');
  console.log('   - API está operacional');
  console.log('');
  console.log('3. Para testar com dados reais:');
  console.log('   - Acesse: https://gestor.engrene.com/dashboard/google');
  console.log('   - Faça a conexão OAuth');
  console.log('   - Use os IDs reais nos testes');
}

// Executar verificação
checkProductionConnections().catch(console.error);