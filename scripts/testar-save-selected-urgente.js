async function testarSaveSelected() {
  console.log('🧪 Testando API /api/meta/save-selected...\n');

  // Dados de teste
  const testData = {
    client_id: 'test-client-123',
    access_token: 'test-token',
    selected_accounts: ['act_123', 'act_456'],
    selected_pages: [],
    ad_accounts: [
      { id: 'act_123', name: 'Conta Teste 1', currency: 'BRL' },
      { id: 'act_456', name: 'Conta Teste 2', currency: 'BRL' }
    ],
    pages: []
  };

  try {
    console.log('📤 Enviando requisição POST para http://localhost:3001/api/meta/save-selected');
    console.log('📦 Dados:', JSON.stringify(testData, null, 2));
    
    const response = await fetch('http://localhost:3001/api/meta/save-selected', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    console.log('\n📊 Status da resposta:', response.status);
    console.log('📋 Headers:', Object.fromEntries(response.headers.entries()));

    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      console.log('\n✅ Resposta JSON:', JSON.stringify(data, null, 2));
    } else {
      const text = await response.text();
      console.log('\n⚠️ Resposta não-JSON:', text);
    }

    if (response.ok) {
      console.log('\n✅ API está funcionando!');
    } else {
      console.log('\n❌ API retornou erro');
    }

  } catch (error) {
    console.error('\n💥 Erro ao testar:', error.message);
    console.error('Stack:', error.stack);
  }
}

testarSaveSelected();
