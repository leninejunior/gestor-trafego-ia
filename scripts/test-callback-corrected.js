/**
 * Testar callback corrigido no localhost
 */

const baseUrl = 'http://localhost:3000';

async function testCallbackCorrected() {
  console.log('🔧 TESTANDO CALLBACK CORRIGIDO');
  console.log('='.repeat(50));
  
  try {
    // Testar callback com parâmetros OAuth reais
    const callbackUrl = `${baseUrl}/api/google/callback?code=test_code_123&state=test_state_456`;
    console.log(`\n📡 Testando callback: ${callbackUrl}`);
    
    const response = await fetch(callbackUrl);
    console.log(`Status: ${response.status}`);
    
    const text = await response.text();
    
    if (text.includes('window.location.href')) {
      console.log('✅ Callback funcionando!');
      
      // Extrair URL de redirecionamento
      const match = text.match(/window\\.location\\.href = '([^']+)'/);
      if (match) {
        const redirectUrl = match[1];
        console.log(`🎯 Redireciona para: ${redirectUrl}`);
        
        // Verificar se tem connectionId e clientId
        if (redirectUrl.includes('connectionId=') && redirectUrl.includes('clientId=')) {
          console.log('✅ Parâmetros connectionId e clientId presentes!');
          
          // Testar a API de contas
          console.log('\n📡 Testando API de contas...');
          const accountsUrl = redirectUrl.replace('/google/select-accounts', '/api/google/accounts');
          const accountsResponse = await fetch(`${baseUrl}${accountsUrl}`);
          
          console.log(`Status API contas: ${accountsResponse.status}`);
          
          if (accountsResponse.ok) {
            const accountsData = await accountsResponse.json();
            console.log('✅ API de contas funcionando!');
            console.log(`Contas encontradas: ${accountsData.accounts?.length || 0}`);
            
            if (accountsData.accounts?.length > 0) {
              console.log('🎉 FLUXO COMPLETO FUNCIONANDO!');
              console.log('Contas disponíveis:');
              accountsData.accounts.forEach((account, index) => {
                console.log(`  ${index + 1}. ${account.descriptiveName} (${account.customerId})`);
              });
            }
          } else {
            console.log('❌ API de contas com erro');
          }
          
        } else {
          console.log('⚠️ Parâmetros connectionId/clientId ausentes');
        }
      }
    } else {
      console.log('❌ Callback não funcionando');
    }
    
  } catch (error) {
    console.log(`❌ Erro: ${error.message}`);
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('🎯 RESULTADO:');
  console.log('Se viu "FLUXO COMPLETO FUNCIONANDO!", está tudo certo!');
}

testCallbackCorrected().catch(console.error);