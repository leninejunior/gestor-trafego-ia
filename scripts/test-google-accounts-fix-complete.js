/**
 * Testar Correção Completa da API Google Accounts
 * Verifica se a API agora funciona corretamente para conexões pendentes
 */

const baseUrl = 'https://gestor.engrene.com';

async function testGoogleAccountsFixComplete() {
  console.log('🔧 TESTANDO CORREÇÃO COMPLETA DA API GOOGLE ACCOUNTS');
  console.log('='.repeat(70));
  
  // IDs da conexão pendente
  const connectionId = '6d1fadb2-715b-45ea-8d1d-08c43b5a2bf3';
  const clientId = 'e0ae65bf-1f97-474a-988e-a5418ab28e77';
  
  console.log('\n📋 DADOS DO TESTE:');
  console.log('- Connection ID:', connectionId);
  console.log('- Client ID:', clientId);
  console.log('- Status esperado: customer_id = pending');
  console.log('- Resultado esperado: API retorna contas para seleção');
  
  try {
    const testUrl = `${baseUrl}/api/google/accounts?connectionId=${connectionId}&clientId=${clientId}`;
    console.log('\n📡 FAZENDO REQUISIÇÃO:');
    console.log('URL:', testUrl);
    
    const startTime = Date.now();
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    const endTime = Date.now();
    
    console.log('\n📊 RESPOSTA DA API:');
    console.log('- Status:', response.status);
    console.log('- Status Text:', response.statusText);
    console.log('- Tempo de resposta:', `${endTime - startTime}ms`);
    
    const responseText = await response.text();
    console.log('- Tamanho da resposta:', responseText.length, 'bytes');
    
    try {
      const jsonResponse = JSON.parse(responseText);
      
      console.log('\n🎯 ANÁLISE DA RESPOSTA:');
      
      if (response.status === 200) {
        console.log('✅ STATUS 200 - API FUNCIONANDO!');
        
        // Verificar campos obrigatórios
        const requiredFields = ['connectionId', 'clientId', 'accounts', 'totalAccounts', 'isPending', 'requiresSelection'];
        const missingFields = requiredFields.filter(field => !(field in jsonResponse));
        
        if (missingFields.length === 0) {
          console.log('✅ TODOS OS CAMPOS OBRIGATÓRIOS PRESENTES');
        } else {
          console.log('⚠️ CAMPOS AUSENTES:', missingFields);
        }
        
        // Verificar dados específicos
        console.log('\n📋 DADOS RETORNADOS:');
        console.log('- Connection ID:', jsonResponse.connectionId);
        console.log('- Client ID:', jsonResponse.clientId);
        console.log('- Total de contas:', jsonResponse.totalAccounts);
        console.log('- É pendente:', jsonResponse.isPending);
        console.log('- Requer seleção:', jsonResponse.requiresSelection);
        console.log('- É MCC:', jsonResponse.isMCC);
        console.log('- Tem tokens:', jsonResponse.hasTokens);
        console.log('- É real:', jsonResponse.isReal);
        console.log('- Mensagem:', jsonResponse.message);
        console.log('- Timestamp:', jsonResponse.timestamp);
        
        // Verificar contas
        if (jsonResponse.accounts && jsonResponse.accounts.length > 0) {
          console.log('\n🎯 CONTAS ENCONTRADAS:');
          jsonResponse.accounts.forEach((account, index) => {
            console.log(`${index + 1}. ${account.descriptiveName || account.customerId}`);
            console.log(`   - Customer ID: ${account.customerId}`);
            console.log(`   - Moeda: ${account.currencyCode || 'N/A'}`);
            console.log(`   - Fuso horário: ${account.timeZone || 'N/A'}`);
            console.log(`   - Pode gerenciar: ${account.canManageClients ? 'Sim (MCC)' : 'Não'}`);
            if (account.parentMCC) {
              console.log(`   - MCC pai: ${account.parentMCC}`);
            }
          });
          
          console.log('\n✅ CORREÇÃO FUNCIONANDO PERFEITAMENTE!');
          console.log('- API retorna contas mesmo com conexão pendente');
          console.log('- Usuário pode agora selecionar as contas desejadas');
          
        } else {
          console.log('\n⚠️ NENHUMA CONTA RETORNADA');
          console.log('- Pode ser problema com Developer Token ou API do Google');
        }
        
        // Verificar se é realmente uma conexão pendente
        if (jsonResponse.isPending && jsonResponse.requiresSelection) {
          console.log('\n🎉 CORREÇÃO CONFIRMADA!');
          console.log('- Conexão pendente detectada corretamente');
          console.log('- API indica que seleção é necessária');
          console.log('- Fluxo de seleção de contas pode prosseguir');
        } else if (!jsonResponse.isPending) {
          console.log('\n⚠️ CONEXÃO NÃO É MAIS PENDENTE');
          console.log('- Pode ter sido atualizada durante os testes');
        }
        
      } else if (response.status === 404) {
        console.log('❌ AINDA RETORNA 404');
        console.log('- A correção não foi aplicada corretamente');
        console.log('- Erro:', jsonResponse.error);
        
      } else if (response.status === 500) {
        console.log('❌ ERRO 500 - PROBLEMA NO SERVIDOR');
        console.log('- Erro:', jsonResponse.error);
        console.log('- Mensagem:', jsonResponse.message);
        
      } else {
        console.log(`⚠️ STATUS INESPERADO: ${response.status}`);
        console.log('- Resposta:', JSON.stringify(jsonResponse, null, 2));
      }
      
    } catch (parseError) {
      console.log('❌ ERRO AO PARSEAR JSON:');
      console.log('- Response text (primeiros 500 chars):', responseText.substring(0, 500));
      console.log('- Parse error:', parseError.message);
    }
    
  } catch (error) {
    console.error('\n❌ ERRO NA REQUISIÇÃO:', error.message);
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('🏁 TESTE CONCLUÍDO');
  
  console.log('\n💡 PRÓXIMOS PASSOS:');
  console.log('1. Se a API retornou contas: Teste no navegador');
  console.log('2. Acesse: https://gestor.engrene.com/google/select-accounts');
  console.log('3. Verifique se as contas aparecem para seleção');
  console.log('4. Selecione as contas desejadas e finalize a conexão');
}

// Executar teste
testGoogleAccountsFixComplete().catch(console.error);