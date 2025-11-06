/**
 * Teste simples da API Google Ads
 */

async function testarGoogleAds() {
  console.log('🔍 Testando API Google Ads...\n');

  try {
    // Testar se o servidor está rodando
    console.log('📡 Testando servidor...');
    const healthResponse = await fetch('http://localhost:3000/api/health');
    
    if (healthResponse.ok) {
      console.log('✅ Servidor está rodando');
    } else {
      console.log('❌ Servidor não está respondendo');
      return;
    }

    // Testar API de contas com uma conexão existente
    const connectionId = '92e769bc-691c-4faf-87e3-1c138716d9bf';
    console.log(`\n🏢 Testando API de contas com connectionId: ${connectionId}`);
    
    const accountsUrl = `http://localhost:3000/api/google/accounts?connectionId=${connectionId}`;
    const accountsResponse = await fetch(accountsUrl);
    const accountsData = await accountsResponse.json();
    
    console.log('Status:', accountsResponse.status);
    console.log('Resposta:', JSON.stringify(accountsData, null, 2));

    if (accountsData.error) {
      console.log('\n❌ Erro encontrado:', accountsData.error);
      console.log('Mensagem:', accountsData.message);
      
      if (accountsData.needsReauth) {
        console.log('🔄 Precisa fazer nova autenticação OAuth');
        console.log('Para testar o OAuth, acesse:');
        console.log(`http://localhost:3000/api/google/auth?clientId=e0ae65bf-1f97-474a-988e-a5418ab28e77`);
      }
    } else if (accountsData.accounts) {
      console.log('\n✅ Contas encontradas:', accountsData.accounts.length);
      accountsData.accounts.forEach((account, index) => {
        console.log(`Conta ${index + 1}: ${account.descriptiveName} (${account.customerId})`);
      });
    }

  } catch (error) {
    console.error('💥 Erro:', error.message);
  }
}

testarGoogleAds().catch(console.error);