/**
 * Debug: Verificar se a conexão ainda existe no banco
 */

const baseUrl = 'https://gestor.engrene.com';

async function debugConnectionExistence() {
  console.log('🔍 VERIFICANDO EXISTÊNCIA DA CONEXÃO NO BANCO');
  console.log('='.repeat(60));
  
  const connectionId = '6d1fadb2-715b-45ea-8d1d-08c43b5a2bf3';
  const clientId = 'e0ae65bf-1f97-474a-988e-a5418ab28e77';
  
  console.log('\n📋 IDs PARA VERIFICAÇÃO:');
  console.log('- Connection ID:', connectionId);
  console.log('- Client ID:', clientId);
  
  try {
    // Primeiro, vamos listar todas as conexões para este cliente
    console.log('\n🔍 LISTANDO TODAS AS CONEXÕES GOOGLE PARA O CLIENTE...');
    
    const listUrl = `${baseUrl}/api/debug/list-google-connections?clientId=${clientId}`;
    console.log('URL de listagem:', listUrl);
    
    const listResponse = await fetch(listUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('\n📊 RESPOSTA DA LISTAGEM:');
    console.log('- Status:', listResponse.status);
    
    if (listResponse.ok) {
      const listData = await listResponse.json();
      console.log('- Total de conexões encontradas:', listData.connections?.length || 0);
      
      if (listData.connections && listData.connections.length > 0) {
        console.log('\n📋 CONEXÕES ENCONTRADAS:');
        listData.connections.forEach((conn, index) => {
          console.log(`${index + 1}. ID: ${conn.id}`);
          console.log(`   - Client ID: ${conn.client_id}`);
          console.log(`   - Customer ID: ${conn.customer_id}`);
          console.log(`   - Status: ${conn.status}`);
          console.log(`   - Criado: ${conn.created_at}`);
          console.log(`   - Atualizado: ${conn.updated_at}`);
          
          if (conn.id === connectionId) {
            console.log('   ✅ ESTA É A CONEXÃO QUE ESTAMOS PROCURANDO!');
          }
        });
        
        // Verificar se nossa conexão específica existe
        const targetConnection = listData.connections.find(conn => conn.id === connectionId);
        if (targetConnection) {
          console.log('\n✅ CONEXÃO ENCONTRADA NA LISTAGEM!');
          console.log('- A conexão existe no banco de dados');
          console.log('- Problema pode estar na query da API /api/google/accounts');
          
          // Testar a API accounts novamente com logs detalhados
          console.log('\n🔄 TESTANDO API ACCOUNTS NOVAMENTE...');
          const accountsUrl = `${baseUrl}/api/google/accounts?connectionId=${connectionId}&clientId=${clientId}`;
          
          const accountsResponse = await fetch(accountsUrl);
          console.log('- Status da API accounts:', accountsResponse.status);
          
          const accountsText = await accountsResponse.text();
          console.log('- Resposta da API accounts:', accountsText);
          
        } else {
          console.log('\n❌ CONEXÃO NÃO ENCONTRADA NA LISTAGEM');
          console.log('- A conexão pode ter sido deletada');
          console.log('- Ou os IDs estão incorretos');
        }
        
      } else {
        console.log('\n⚠️ NENHUMA CONEXÃO ENCONTRADA PARA ESTE CLIENTE');
      }
      
    } else {
      console.log('❌ Erro ao listar conexões:', listResponse.status);
      const errorText = await listResponse.text();
      console.log('- Erro:', errorText);
    }
    
  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🏁 DEBUG CONCLUÍDO');
}

// Executar debug
debugConnectionExistence().catch(console.error);