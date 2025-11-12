/**
 * Script para testar as rotas /api/meta/save-selected e /api/meta/save
 */

async function testarRotas() {
  console.log('🧪 Testando rotas Meta Save...\n');

  const baseUrl = 'http://localhost:3000';
  
  // Dados de teste
  const testData = {
    client_id: 'e3ab33da-79f9-45e9-a43f-6ce76ceb9751',
    access_token: 'test_token_123',
    selected_accounts: ['act_123456789'],
    ad_accounts: [
      {
        id: 'act_123456789',
        name: 'Conta Teste',
        currency: 'BRL'
      }
    ]
  };

  // Testar /api/meta/save-selected
  console.log('1️⃣ Testando POST /api/meta/save-selected');
  try {
    const response1 = await fetch(`${baseUrl}/api/meta/save-selected`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    console.log(`   Status: ${response1.status}`);
    console.log(`   Status Text: ${response1.statusText}`);
    
    if (response1.ok) {
      const data = await response1.json();
      console.log('   ✅ Resposta:', data);
    } else {
      const error = await response1.text();
      console.log('   ❌ Erro:', error);
    }
  } catch (error) {
    console.log('   ❌ Erro de conexão:', error.message);
  }

  console.log('\n2️⃣ Testando POST /api/meta/save');
  try {
    const response2 = await fetch(`${baseUrl}/api/meta/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    console.log(`   Status: ${response2.status}`);
    console.log(`   Status Text: ${response2.statusText}`);
    
    if (response2.ok) {
      const data = await response2.json();
      console.log('   ✅ Resposta:', data);
    } else {
      const error = await response2.text();
      console.log('   ❌ Erro:', error);
    }
  } catch (error) {
    console.log('   ❌ Erro de conexão:', error.message);
  }

  console.log('\n✅ Testes concluídos!');
}

testarRotas();
