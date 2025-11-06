/**
 * Debug Google Accounts API - Verificar dados reais vs mockados
 */

// Usar fetch nativo do Node.js 18+

async function debugGoogleAccountsAPI() {
  console.log('🔍 Debugando API de contas do Google Ads...\n');

  const connectionId = 'a64fd66d-dfb2-4a10-972d-d8c266870da2';
  const url = `http://localhost:3000/api/google/accounts?connectionId=${connectionId}`;

  try {
    console.log(`📡 Fazendo requisição para: ${url}`);
    
    const response = await fetch(url);
    const data = await response.json();

    console.log('\n📊 Resposta da API:');
    console.log('Status:', response.status);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));
    console.log('\n📋 Dados retornados:');
    console.log(JSON.stringify(data, null, 2));

    if (data.accounts) {
      console.log('\n🏢 Análise das contas:');
      console.log(`Total de contas: ${data.accounts.length}`);
      
      data.accounts.forEach((account, index) => {
        console.log(`\nConta ${index + 1}:`);
        console.log(`  ID: ${account.customerId}`);
        console.log(`  Nome: ${account.descriptiveName}`);
        console.log(`  Moeda: ${account.currencyCode}`);
        console.log(`  Timezone: ${account.timeZone}`);
        console.log(`  É MCC: ${account.canManageClients}`);
        
        // Verificar se parece com dados mockados
        if (account.descriptiveName.includes('Conta de Teste') || 
            account.descriptiveName.includes('Mock') ||
            account.customerId === '1234567890') {
          console.log('  ⚠️  PARECE SER DADOS MOCKADOS!');
        } else {
          console.log('  ✅ Parece ser dados reais');
        }
      });
    }

    if (data.error) {
      console.log('\n❌ Erro encontrado:');
      console.log(`Erro: ${data.error}`);
      console.log(`Mensagem: ${data.message}`);
      console.log(`Detalhes: ${data.details}`);
      console.log(`Precisa reautenticar: ${data.needsReauth}`);
    }

    // Verificar flags importantes
    console.log('\n🏷️  Flags importantes:');
    console.log(`isPending: ${data.isPending}`);
    console.log(`isMCC: ${data.isMCC}`);
    console.log(`hasTokens: ${data.hasTokens}`);
    console.log(`isReal: ${data.isReal}`);

  } catch (error) {
    console.error('\n💥 Erro na requisição:', error.message);
  }
}

// Executar o debug
debugGoogleAccountsAPI().catch(console.error);