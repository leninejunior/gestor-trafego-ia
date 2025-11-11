/**
 * Verificar conexão Google diretamente via API existente
 */

const baseUrl = 'https://gestor.engrene.com';

async function checkGoogleConnectionDirect() {
  console.log('🔍 VERIFICANDO CONEXÃO GOOGLE DIRETAMENTE');
  console.log('='.repeat(60));
  
  const connectionId = '6d1fadb2-715b-45ea-8d1d-08c43b5a2bf3';
  const clientId = 'e0ae65bf-1f97-474a-988e-a5418ab28e77';
  
  console.log('\n📋 DADOS DA CONEXÃO:');
  console.log('- Connection ID:', connectionId);
  console.log('- Client ID:', clientId);
  
  try {
    // Vamos tentar diferentes abordagens para verificar a conexão
    
    console.log('\n🔍 TESTE 1: Verificar se a conexão existe via API de debug simples');
    
    // Criar uma URL de teste que pode nos dar mais informações
    const debugUrl = `${baseUrl}/api/debug/check-connection?connectionId=${connectionId}&clientId=${clientId}`;
    console.log('URL de debug:', debugUrl);
    
    const debugResponse = await fetch(debugUrl);
    console.log('Status do debug:', debugResponse.status);
    
    if (debugResponse.status === 404) {
      console.log('⚠️ API de debug não existe, vamos tentar outra abordagem');
      
      console.log('\n🔍 TESTE 2: Verificar via API de callback do Google');
      
      // Vamos verificar se há alguma API que liste conexões
      const callbackUrl = `${baseUrl}/api/google/callback`;
      console.log('Testando URL de callback:', callbackUrl);
      
      const callbackResponse = await fetch(callbackUrl);
      console.log('Status do callback:', callbackResponse.status);
      
      console.log('\n🔍 TESTE 3: Verificar se o problema é na query SQL');
      
      // Vamos tentar uma abordagem diferente - criar uma conexão de teste
      console.log('Vamos verificar se conseguimos criar uma nova conexão...');
      
      // Primeiro, vamos ver se conseguimos acessar a API de auth do Google
      const authUrl = `${baseUrl}/api/google/auth?clientId=${clientId}`;
      console.log('URL de auth:', authUrl);
      
      const authResponse = await fetch(authUrl);
      console.log('Status da auth:', authResponse.status);
      
      if (authResponse.ok) {
        const authData = await authResponse.json();
        console.log('✅ API de auth funciona');
        console.log('- Auth URL gerada:', !!authData.authUrl);
      } else {
        console.log('❌ API de auth não funciona');
        const authError = await authResponse.text();
        console.log('- Erro:', authError.substring(0, 200));
      }
      
    } else {
      const debugData = await debugResponse.text();
      console.log('Resposta do debug:', debugData.substring(0, 500));
    }
    
    console.log('\n🔍 TESTE 4: Verificar se o problema é específico da nossa conexão');
    
    // Vamos tentar com IDs diferentes para ver se o problema é geral
    const testConnectionId = 'test-connection-id';
    const testUrl = `${baseUrl}/api/google/accounts?connectionId=${testConnectionId}&clientId=${clientId}`;
    
    console.log('Testando com connection ID fictício:', testConnectionId);
    const testResponse = await fetch(testUrl);
    console.log('Status do teste:', testResponse.status);
    
    const testData = await testResponse.text();
    console.log('Resposta do teste (primeiros 200 chars):', testData.substring(0, 200));
    
    if (testResponse.status === 404 && testData.includes('Conexão não encontrada')) {
      console.log('✅ A API está funcionando - o problema é que a conexão não existe');
    } else if (testResponse.status === 404 && testData.includes('<!DOCTYPE html>')) {
      console.log('❌ A API não está funcionando - retorna página 404 do Next.js');
    }
    
  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🏁 VERIFICAÇÃO CONCLUÍDA');
  
  console.log('\n💡 CONCLUSÕES:');
  console.log('1. Se a API retorna "Conexão não encontrada": A conexão foi deletada');
  console.log('2. Se a API retorna HTML 404: Há problema de roteamento');
  console.log('3. Próximo passo: Criar uma nova conexão Google Ads');
}

// Executar verificação
checkGoogleConnectionDirect().catch(console.error);