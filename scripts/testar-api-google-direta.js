/**
 * Testar API Google diretamente com a conexão específica
 */

async function testarAPIGoogle() {
  console.log('🔍 Testando API Google diretamente...\n');

  // Usar o connectionId da URL que você acessou
  const connectionId = 'c1073792-9840-4187-be35-6a4cc46c9ff4';
  
  try {
    console.log(`📡 Testando connectionId: ${connectionId}`);
    
    const url = `http://localhost:3000/api/google/accounts?connectionId=${connectionId}`;
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('Status:', response.status);
    console.log('Resposta completa:', JSON.stringify(data, null, 2));
    
    if (data.accounts) {
      console.log('\n📋 Contas encontradas:');
      data.accounts.forEach((account, index) => {
        console.log(`${index + 1}. ${account.descriptiveName} (${account.customerId})`);
        console.log(`   Moeda: ${account.currencyCode}`);
        console.log(`   Timezone: ${account.timeZone}`);
        console.log(`   É MCC: ${account.canManageClients}`);
      });
      
      console.log(`\n🏷️  Flags:`);
      console.log(`   isReal: ${data.isReal}`);
      console.log(`   isTest: ${data.isTest}`);
      console.log(`   hasTokens: ${data.hasTokens}`);
    }
    
    if (data.error) {
      console.log('\n❌ Erro:', data.error);
      console.log('Mensagem:', data.message);
    }

  } catch (error) {
    console.error('💥 Erro na requisição:', error.message);
  }
}

testarAPIGoogle().catch(console.error);