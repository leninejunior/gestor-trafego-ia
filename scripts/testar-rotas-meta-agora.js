/**
 * Script para testar se as rotas Meta estão acessíveis
 */

async function testarRotasMeta() {
  console.log('🧪 Testando rotas Meta...\n');

  const baseUrl = 'http://localhost:3000';
  
  // Dados de teste
  const testData = {
    client_id: 'e3ab33da-79f9-45e9-a43f-6ce76ceb9751',
    access_token: 'test_token',
    selected_accounts: ['123456789'],
    ad_accounts: [
      { id: '123456789', name: 'Conta Teste', currency: 'BRL' }
    ]
  };

  // Testar rota save-selected
  console.log('1️⃣ Testando POST /api/meta/save-selected...');
  try {
    const response1 = await fetch(`${baseUrl}/api/meta/save-selected`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    });
    
    console.log(`   Status: ${response1.status}`);
    const data1 = await response1.json();
    console.log(`   Resposta:`, data1);
  } catch (error) {
    console.error('   ❌ Erro:', error.message);
  }

  console.log('\n2️⃣ Testando POST /api/meta/save...');
  try {
    const response2 = await fetch(`${baseUrl}/api/meta/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    });
    
    console.log(`   Status: ${response2.status}`);
    const data2 = await response2.json();
    console.log(`   Resposta:`, data2);
  } catch (error) {
    console.error('   ❌ Erro:', error.message);
  }

  console.log('\n✅ Teste concluído!');
}

testarRotasMeta().catch(console.error);
